const {setGlobalOptions} = require("firebase-functions");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineSecret, defineString} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {chunk, hasUsableEmail, buildEmail} = require("./email-utils");
 
// Initialise the Admin SDK before anything that might use it.
initializeApp();
const db = getFirestore();
 
// Cost control: cap concurrent containers (per function).
setGlobalOptions({maxInstances: 5});
 
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
 
// Set with: firebase functions:secrets:set SMTP2GO_API_KEY
// In the emulator it's read from functions/.secret.local instead.
const SMTP2GO_API_KEY = defineSecret("SMTP2GO_API_KEY");
 
// Defaults to the real API. In the emulator, functions/.env.local can override
// it to point at the local mock server (see dev/mock-smtp2go.js).
const SMTP2GO_BATCH_URL = defineString("SMTP2GO_BATCH_URL", {
  default: "https://api.smtp2go.com/v3/email/batch",
});
 
const SENDER = "\"Togather\" <TogatherInvites@mikulastik.live>";
const APP_URL = "https://togather-64b0b.web.app";
 
// A conservative, self-imposed batch size. SMTP2GO's batch endpoint is
// documented as allowing more than this, so 50 is a safe choice, not a limit.
const EMAILS_PER_REQUEST = 50;
// Firestore allows at most 500 writes per batch/transaction.
const FIRESTORE_WRITE_LIMIT = 500;
const REQUEST_TIMEOUT_MS = 30_000;
 
// Values are kept identical to what's already stored in Firestore.
// "sending" is new: it marks invitees a running invocation has claimed.
const EmailStatus = Object.freeze({
  PENDING: "pending",
  SENDING: "sending",
  RECEIVED: "received", // SMTP2GO accepted it; not proof the guest got it
  FAILED: "failed",
});
 
// ---------------------------------------------------------------------------
// Firestore / network helpers
// ---------------------------------------------------------------------------
 
/**
 * Atomically finds invitees who still need an email and flips them to
 * "sending". Because this happens in a transaction, two overlapping
 * invocations can't both claim the same invitee.
 */
function claimPendingInvitees(invitationId) {
  // atomic transaction operation https://firebase.google.com/docs/firestore/manage-data/transactions
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
        db.collection("invitee")
            .where("weddingId", "==", invitationId)
            .where("emailStatus", "in", [EmailStatus.PENDING, EmailStatus.FAILED])
            .limit(FIRESTORE_WRITE_LIMIT),
    );
 
    snap.docs.forEach((doc) => {
      tx.update(doc.ref, {
        emailStatus: EmailStatus.SENDING,
        emailStatusUpdatedAt: FieldValue.serverTimestamp(),
      });
    });
 
    return snap.docs.map((doc) => ({id: doc.id, ...doc.data()}));
  });
}
 
/** Writes the same status to many invitees, respecting Firestore's limits. */
async function setStatus(invitees, status, extraFields = {}) {
  for (const group of chunk(invitees, FIRESTORE_WRITE_LIMIT)) {
    const batch = db.batch();
    group.forEach((invitee) => {
      batch.update(db.collection("invitee").doc(invitee.id), {
        emailStatus: status,
        emailStatusUpdatedAt: FieldValue.serverTimestamp(),
        ...extraFields,
      });
    });
    await batch.commit();
  }
}
 
/** Sends one batch request. Throws on network errors / timeouts. */
async function postBatch(emails) {
  const response = await fetch(SMTP2GO_BATCH_URL.value(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header auth keeps the key out of the request body.
      "X-Smtp2go-Api-Key": SMTP2GO_API_KEY.value(),
    },
    body: JSON.stringify({emails}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
 
  // Error responses may not be JSON, so don't let parsing blow up.
  const body = await response.json().catch(() => null);
  return {ok: response.ok, status: response.status, body};
}
 
// ---------------------------------------------------------------------------
// Send Invites Trigger
// ---------------------------------------------------------------------------
 
exports.sendInvitesOnPublish = onDocumentUpdated(
    {
      document: "invitations/{invitationId}",
      secrets: [SMTP2GO_API_KEY],
    },
    async (event) => {
      // check if valid on isPublish change
      const {invitationId} = event.params;
      const before = event.data.before.data();
      const after = event.data.after.data();
      // Only act on the false -> true transition of isPublished.
      const justPublished = !before.isPublished && Boolean(after.isPublished);
      if (!justPublished) return;
 
      logger.info("Invitation published", {invitationId});
 
      const claimed = await claimPendingInvitees(invitationId);
      if (claimed.length === 0) {
        logger.info("No invitees need an email", {invitationId});
        return;
      }
 
      // Anyone we can't email gets marked failed instead of stuck "sending".
      const sendable = claimed.filter(hasUsableEmail);
      const unsendable = claimed.filter((i) => !hasUsableEmail(i));
      if (unsendable.length > 0) {
        logger.warn("Invitees missing a usable email", {
          invitationId,
          invitees: unsendable.map((i) => i.id), // ids only: emails are PII
        });
        await setStatus(unsendable, EmailStatus.FAILED, {
          emailError: "missing or invalid email",
        });
      }
      
      // break our invitees into chunks(groups)
      // only sendable emails, so one bad chunk doesn't fail everyone.
      let sentCount = 0;
      let failedCount = unsendable.length;
      const groups = chunk(sendable, EMAILS_PER_REQUEST);
 
      for (const [index, group] of groups.entries()) {
        const requestInfo = {
          invitationId,
          request: `${index + 1}/${groups.length}`,
          size: group.length,
        };
 
        try {
          // build all email structures
          const emails = group.map((i) => buildEmail(i, {
            sender: SENDER,
            appUrl: APP_URL,
          }));
          // call our API
          const {ok, status, body} = await postBatch(emails);
 
          // handle errors and successes
          if (ok) {
            // if good we set our emailstatus' for the group to received
            await setStatus(group, EmailStatus.RECEIVED, {emailError: null});
            sentCount += group.length;
            logger.info("Batch accepted", requestInfo);
          } else {
            // if failed we set status to failed and continue
            logger.error("SMTP2GO rejected batch", {...requestInfo, status, body});
            await setStatus(group, EmailStatus.FAILED, {
              emailError: `SMTP2GO HTTP ${status}`,
            });
            failedCount += group.length;
          }
        } catch (err) {
          // Network error, timeout, or a Firestore write failure.
          logger.error("Batch failed", {...requestInfo, error: err.message});
          await setStatus(group, EmailStatus.FAILED, {
            emailError: err.message,
          }).catch((writeErr) => {
            logger.error("Could not record failure", {
              ...requestInfo,
              error: writeErr.message,
            });
          });
          failedCount += group.length;
        }
      }
 
      logger.info("Invite send complete", {
        invitationId,
        sent: sentCount,
        failed: failedCount,
      });
    },
);
 