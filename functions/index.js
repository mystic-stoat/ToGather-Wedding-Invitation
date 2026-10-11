const {setGlobalOptions} = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const {onTaskDispatched} = require("firebase-functions/v2/tasks");
const {defineSecret, defineString} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getFunctions} = require("firebase-admin/functions");
const Anthropic = require("@anthropic-ai/sdk");
const {hasUsableEmail, buildEmail} = require("./email-utils");
const {
  newestUserMessageId,
  buildClaudeMessages,
  extractReplyText,
} = require("./chat-utils");

// Initialise the Admin SDK before anything that might use it.
initializeApp();
const db = getFirestore();

// Cost control: cap concurrent containers (per function).
setGlobalOptions({maxInstances: 5});

// ---------------------------------------------------------------------------
// Configurations and constants
// ---------------------------------------------------------------------------
// Set with: firebase functions:secrets:set SMTP2GO_API_KEY
// In the emulator it's read from functions/.secret.local instead.
const SMTP2GO_API_KEY = defineSecret("SMTP2GO_API_KEY");

// In the emulator, functions/.env.local can override it to point at the local
// mock server (see dev/mock-smtp2go.js).
const SMTP2GO_SEND_URL = defineString("SMTP2GO_SEND_URL", {
  default: "https://api.smtp2go.com/v3/email/send",
});

const SENDER = "\"Togather\" <TogatherInvites@mikulastik.live>";
const APP_URL = "https://togather-64b0b.web.app"; // our app's current domain name,
// TODO this will be a static domain in the near future

// How many workers (task invocations) run at once. Enforced by Cloud Tasks.
const MAX_CONCURRENT_WORKERS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

const EmailStatus = Object.freeze({
  PENDING: "pending",
  SENDING: "sending",
  RECEIVED: "received", // SMTP2GO accepted it
  FAILED: "failed",
});

// --- Wedding assistant chat ---
// Set with: firebase functions:secrets:set ANTHROPIC_API_KEY
// In the emulator it's read from functions/.secret.local instead.
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const CLAUDE_MODEL = "claude-haiku-5-5";
const CLAUDE_MAX_TOKENS = 512; // explicit so a reply can never run away
const CLAUDE_MAX_HISTORY = 20; // last N messages sent each turn

const ASSISTANT_SYSTEM_PROMPT =
  "You are a warm, concise wedding planning assistant helping a host " +
  "enter details for their wedding invitation website.\n" +
  "Ask one friendly question at a time to collect what is needed " +
  "(for example the wedding date, the location, and what time guests " +
  "should arrive).\n" +
  "Keep replies to 1-3 sentences.";

// Shown in the chat UI on failure; the real error only goes to the logs.
const CHAT_USER_ERROR = "The assistant couldn't reply. Please try again.";

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * "Worker claims emailStatus to sending using Transaction".
 *
 * Reads the invitee and only flips pending -> sending if it is STILL pending.
 * If another worker/run got there first, returns null and the caller exits
 * silently. Firestore re-runs this callback if the document changes underneath
 * the transaction, so the status check always sees fresh data.
 */
function claimInvitee(inviteeId) {
  const ref = db.collection("invitee").doc(inviteeId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().emailStatus !== EmailStatus.PENDING) {
      return null;
    }
    tx.update(ref, {
      emailStatus: EmailStatus.SENDING,
      emailStatusUpdatedAt: FieldValue.serverTimestamp(),
    });
    return {id: snap.id, ...snap.data()};
  });
}

/** Ends an invitee's run as "failed", with a short reason. */
function markFailed(inviteeId, reason) {
  return db.collection("invitee").doc(inviteeId).update({
    emailStatus: EmailStatus.FAILED,
    emailStatusUpdatedAt: FieldValue.serverTimestamp(),
    emailError: String(reason).slice(0, 500),
  });
}

/** "Worker sends POST request to API". Throws on network errors / timeouts. */
async function postEmail(email) {
  const response = await fetch(SMTP2GO_SEND_URL.value(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header auth keeps the key out of the request body.
      "X-Smtp2go-Api-Key": SMTP2GO_API_KEY.value(),
    },
    // SMTP2GO says fastaccept will become the default. With it on, the
    // response no longer includes failed/failures, so pin it to false to keep
    // this code's behaviour from changing underneath us.
    body: JSON.stringify({...email, fastaccept: false}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Error responses may not be JSON, so don't let parsing blow up.
  const body = await response.json().catch(() => null);
  return {ok: response.ok, status: response.status, body};
}

/**
 * "Status message is failed?" Reads the response BODY, because /email/send can
 * return HTTP 200 while reporting failures inside it. Success needs an OK
 * status, no failures, and an email_id.
 */
function readResult({ok, status, body}) {
  const data = (body && body.data) || {};

  if (ok && data.email_id && !data.failed) {
    return {emailId: data.email_id};
  }

  const detail = data.failures && data.failures.length > 0 ?
    JSON.stringify(data.failures) :
    data.error || "no email_id in response";
  return {error: `rejected (HTTP ${status}): ${detail}`};
}

// ---------------------------------------------------------------------------
// Trigger: onDocChange
// ---------------------------------------------------------------------------
// delegates invitees to worker threads
exports.sendInvitesOnPublish = onDocumentUpdated(
    "invitations/{invitationId}",
    async (event) => {
      const {invitationId} = event.params;
      const before = event.data.before.data();
      const after = event.data.after.data();
      // Only act on the false -> true transition of isPublished.
      const justPublished = !before.isPublished && Boolean(after.isPublished);
      if (!justPublished) return;

      logger.info("Invitation published", {invitationId});

      // grab pending emails related to wedding
      // use select to grab docID's
      const snap = await db.collection("invitee")
          .where("weddingId", "==", invitationId)
          .where("emailStatus", "==", EmailStatus.PENDING)
          .select()
          .get();

      // if we don't have any work get outta here
      if (snap.empty) {
        logger.info("No pending invitees", {invitationId});
        return;
      }

      // fill our queue and set workers to complete emails for each invitee
      const queue = getFunctions().taskQueue("sendInviteEmail");
      const results = await Promise.allSettled(
          snap.docs.map((doc) =>
            queue.enqueue({inviteeId: doc.id}).catch(async (err) => {
              logger.error("Could not enqueue invitee", {
                invitationId,
                inviteeId: doc.id,
                error: err.message,
              });
              await markFailed(doc.id, "enqueue_failed");
              throw err;
            }),
          ),
      );

      const notQueued = results.filter((r) => r.status === "rejected").length;
      logger.info("Invites queued", {
        invitationId,
        queued: snap.size - notQueued,
        notQueued,
      });
    },
);

// ---------------------------------------------------------------------------
// Worker: sent off with invitee information, to send email (best effort)
// ---------------------------------------------------------------------------
exports.sendInviteEmail = onTaskDispatched(
    {
      secrets: [SMTP2GO_API_KEY],
      // No retries: any failure is recorded as "failed" and that's the end.
      retryConfig: {maxAttempts: 1},
      // set limits to number of workers
      rateLimits: {maxConcurrentDispatches: MAX_CONCURRENT_WORKERS},
    },
    async (req) => {
      const {inviteeId} = req.data;

      // Claim. If it was already claimed, exit silently without writing.
      // ensure only one claim => email per invitee
      let invitee;
      try {
        invitee = await claimInvitee(inviteeId);
      } catch (err) {
        logger.error("Claim failed", {inviteeId, error: err.message});
        return;
      }
      if (!invitee) return;

      try {
        // email valid?
        if (!hasUsableEmail(invitee)) {
          await markFailed(inviteeId, "invalid_email");
          return;
        }

        // Format contents -> POST -> read the reply.
        const email = buildEmail(invitee, {sender: SENDER, appUrl: APP_URL});
        const result = readResult(await postEmail(email));
        
        if (result.emailId) {
          await db.collection("invitee").doc(inviteeId).update({
            emailStatus: EmailStatus.RECEIVED,
            emailStatusUpdatedAt: FieldValue.serverTimestamp(),
            emailId: result.emailId,
            emailError: null,
          });
        } else {
          await markFailed(inviteeId, result.error);
        }
      } catch (err) {
        // Catch-all: a timeout, a network error, or anything unexpected.
        const reason = err.name === "TimeoutError" ?
          "timeout" :
          `error: ${err.message}`;
        logger.error("Invite send failed", {inviteeId, errorName: err.name});
        await markFailed(inviteeId, reason).catch((writeErr) => {
          logger.error("Could not record failure", {
            inviteeId,
            error: writeErr.message,
          });
        });
      }
    },
);

// ---------------------------------------------------------------------------
// Trigger: wedding assistant chat
// ---------------------------------------------------------------------------
// The client only writes a user message to betrothed/{uid}/messages and
// listens for new docs. This is the ONLY code that talks to Claude: it reads
// recent history, asks Claude, and writes the reply as reply-{msgId}.
exports.replyToUserMessage = onDocumentCreated(
    {
      document: "betrothed/{uid}/messages/{msgId}",
      secrets: [ANTHROPIC_API_KEY],
      // The default timeout can be too short for a slow reply.
      timeoutSeconds: 120,
      // NOTE: a Firestore trigger must run in the same region as the
      // database. If it isn't the default region, add: region: "<region>"
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const {uid, msgId} = event.params;
      const message = snap.data();

      // LOOP GUARD: the reply we write is also a new message document, which
      // fires this trigger again. Anything that isn't a user message exits
      // immediately, so the function can never answer its own replies.
      if (message.role !== "user") return;

      const messagesRef = db.collection("betrothed").doc(uid)
          .collection("messages");
      // Deterministic ID: a duplicate trigger overwrites, never double-replies.
      const replyRef = messagesRef.doc(`reply-${msgId}`);

      try {
        // Events are delivered at least once. If this message already has a
        // reply, skip so a repeat delivery doesn't pay for a second API call.
        if ((await replyRef.get()).exists) return;

        // Last N messages, newest first (flipped to chronological in helper).
        const recent = await messagesRef
            .orderBy("createdAt", "desc")
            .limit(CLAUDE_MAX_HISTORY)
            .get();
        const docs = recent.docs.map((d) => ({id: d.id, ...d.data()}));

        // Message was deleted before we got to it (chat cleared): do nothing.
        if (!docs.some((d) => d.id === msgId)) return;

        // DOUBLE-SUBMIT GUARD: if a newer user message exists, that message's
        // own run answers with the full context. Replying here would double up.
        if (newestUserMessageId(docs) !== msgId) {
          await snap.ref.update({status: "superseded"});
          return;
        }

        const messages = buildClaudeMessages(docs);
        if (messages.length === 0) {
          throw new Error("No sendable messages in history.");
        }

        // Created per call: the secret's value only exists at runtime.
        const client = new Anthropic({apiKey: ANTHROPIC_API_KEY.value()});
        const response = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: ASSISTANT_SYSTEM_PROMPT,
          messages,
        });

        const text = extractReplyText(response);
        if (!text) {
          throw new Error(`Empty reply (stop: ${response.stop_reason}).`);
        }

        // Reply + status flip in ONE batch: both happen or neither. If the
        // chat was cleared mid-call, the update fails and no orphan is saved.
        const batch = db.batch();
        batch.set(replyRef, {
          role: "assistant",
          content: [{type: "text", text}],
          createdAt: FieldValue.serverTimestamp(),
          status: "complete",
        });
        batch.update(snap.ref, {status: "replied"});
        await batch.commit();
      } catch (err) {
        logger.error("replyToUserMessage failed", {
          uid,
          msgId,
          error: err.message,
        });

        // A trigger can't return an error to the client, so record it on the
        // user message: the UI shows it and offers a retry. No automatic
        // retry is enabled on purpose, so a persistent failure can't loop.
        await snap.ref
            .update({status: "error", errorMessage: CHAT_USER_ERROR})
            .catch((writeErr) => {
              // e.g. the message was deleted while we were working
              logger.warn("Could not mark message as error", {
                uid,
                msgId,
                error: writeErr.message,
              });
            });
      }
    },
);