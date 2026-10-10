// src/lib/firestore.ts
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Central hub for ALL database reads and writes.
//   No page should import from "firebase/firestore" directly —
//   they all go through these helper functions instead.
//   This keeps Firebase logic in one place so if the schema changes,
//   you only update it here, not in every page.
//
// DATABASE STRUCTURE (matches your ER diagram):
//   betrothed/{userId}      — host user profile (created on signup)
//   betrothed/{userId}/messages/{messageId} — one chat message per doc
//   invitations/{weddingId}  — wedding details + invitation style
//   invitee/{inviteeId}      — one doc per guest
//   rsvp/{rsvpId}            — one doc per RSVP submission
// ─────────────────────────────────────────────────────────────────────────────

import { doc,
// reference to a single document by ID
getDoc,
// read a single document
setDoc,
// write a document (overwrites or creates)
collection,
// reference to a collection
addDoc,
// add a document with auto-generated ID
getDocs,
// read all documents from a query
updateDoc,
// update specific fields in a document
deleteDoc,
// delete a document
query,
// build a query
where,
// filter condition for a query
orderBy,
// sort order for a query
serverTimestamp, // Firebase server time (more reliable than client time)
runTransaction, // atomic read-modify-write — used for the embedded registries array
writeBatch,
// batched writes — used for retry and for clearing the chat
onSnapshot
// live listener — the chat uses it to stream new messages
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ══════════════════════════════════════════════════════════════════════════════
// TYPESCRIPT TYPES
// These define the shape of each document in Firestore.
// Use these types in pages so TypeScript catches typos and missing fields.
// ══════════════════════════════════════════════════════════════════════════════

/** Shape of a document in the `betrothed` collection */

/** Shape of a document in the `invitations` collection */

/** Shape of a document in the `invitee` collection */

/** Shape of a document in the `rsvp` collection */

// ══════════════════════════════════════════════════════════════════════════════
// BETROTHED — User Profile Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * createUserProfile
 * Called right after signup to create the user's profile in Firestore.
 * We use setDoc with the uid as the document ID so it's easy to look up later.
 */
export const createUserProfile = async (uid, name, email) => {
  // doc(db, "collection", "documentId") — creates a reference to a specific doc
  const ref = doc(db, "betrothed", uid);
  await setDoc(ref, {
    userId: uid,
    email,
    name,
    preferences: "",
    joinDate: serverTimestamp() // Firebase records the exact server time
  });
};

/**
 * getUserProfile
 * Fetch a user's profile by their uid.
 * Returns null if they don't have a profile yet.
 */
export const getUserProfile = async uid => {
  const ref = doc(db, "betrothed", uid);
  const snap = await getDoc(ref);
  // snap.exists() is false if no document was found
  return snap.exists() ? snap.data() : null;
};

// ══════════════════════════════════════════════════════════════════════════════
// INVITATIONS — Wedding Details Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * getInvitationByUser
 * Fetches the invitation that belongs to a specific host.
 * In v1 each host has only one invitation, so we return the first result.
 * Returns null if they haven't created one yet.
 */
export const getInvitationByUser = async uid => {
  const ref = collection(db, "invitations");
  // query() lets us filter: only return docs where userId == uid
  const q = query(ref, where("userId", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  // snap.docs[0].id is the Firestore auto-generated document ID (weddingId)
  const d = snap.docs[0];
  return {
    weddingId: d.id,
    ...d.data()
  };
};

/**
 * saveInvitation
 * Creates or updates a wedding invitation document.
 * - If weddingId is provided: updates the existing document
 * - If weddingId is undefined: creates a new document and returns the new ID
 *
 * Returns the weddingId so the caller can store it for future updates.
 */
export const saveInvitation = async (uid, data, weddingId) => {
  if (weddingId) {
    // UPDATE — doc already exists, just change the fields
    const ref = doc(db, "invitations", weddingId);
    await updateDoc(ref, {
      ...data
    });
    return weddingId;
  } else {
    // CREATE — new document with auto-generated ID
    const ref = collection(db, "invitations");
    const newDoc = await addDoc(ref, {
      ...data,
      userId: uid,
      isPublished: false,
      // always starts unpublished
      createdAt: serverTimestamp()
    });
    return newDoc.id; // return the new ID so WeddingDetails.tsx can save it
  }
};

/**
 * publishInvitation
 * Flips isPublished to true — makes the guest RSVP link active.
 * Call this when the host clicks a "Publish" button.
 */
export const publishInvitation = async weddingId => {
  const ref = doc(db, "invitations", weddingId);
  await updateDoc(ref, {
    isPublished: true
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// INVITEE — Guest List Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * getInvitees
 * Fetches all guests for a wedding, sorted alphabetically by name.
 * Used in the Dashboard and Guest List page.
 */
export const getInvitees = async weddingId => {
  const ref = collection(db, "invitee");
  const q = query(ref, where("weddingId", "==", weddingId), orderBy("guestName") // sorts A → Z
  );
  const snap = await getDocs(q);
  // Map each doc to an Invitee object, adding the doc ID as inviteeId
  return snap.docs.map(d => ({
    inviteeId: d.id,
    ...d.data()
  }));
};

/**
 * addInvitee
 * Adds a new guest to the guest list.
 * Automatically generates a unique token for their personal RSVP link.
 * Their RSVP link will be: yourdomain.com/rsvp/<token>
 */
export const addInvitee = async (
  weddingId,
  guestName,
  plusOneLimit = 0, // default: no plus ones allowed
  email = "",       // optional — shown in the guest list table
  group = "",        // optional — Family, Friends, Coworkers, etc.
  emailStatus = "pending",
  childrenPolicyOverride = "inherit" // "inherit" (use wedding setting) | "allowed" | "adults_only"
) => {
  // crypto.randomUUID() generates a unique token like "a3f2c1d4-..."
  // This token is embedded in the guest's personal RSVP link
  const token = crypto.randomUUID();
  const ref = collection(db, "invitee");
  const newDoc = await addDoc(ref, {
    weddingId,
    guestName,
    email,             // stored for display in the guest list
    group,             // stored for filtering guests by group
    emailStatus,
    plusOneLimit,
    childrenPolicyOverride, // per-guest override of the wedding's childrenPolicy
    token,
    tokenUsed: false,  // becomes true after they submit their RSVP
    rsvpStatus: "Pending", // starts Pending until they respond
    attending: null,   // null until they RSVP (true = accepted, false = declined)
    dietaryRestrictions: "",
    plusOnes: [],      // filled in when guest submits RSVP: [{ name, mealId, meal, dietaryRestrictions }]
    addedAt: serverTimestamp(),
  });
  return newDoc.id; // return the new inviteeId
};

/**
 * updateInvitee
 * Update specific fields on a guest document.
 * Used by submitRSVP to record their response.
 */
export const updateInvitee = async (inviteeId, updates) => {
  const ref = doc(db, "invitee", inviteeId);
  await updateDoc(ref, {
    ...updates
  });
};

/**
 * deleteInvitee
 * Removes a guest from the guest list.
 * Note: does NOT delete their rsvp document if they already responded.
 */
export const deleteInvitee = async inviteeId => {
  const ref = doc(db, "invitee", inviteeId);
  await deleteDoc(ref);
};

// ══════════════════════════════════════════════════════════════════════════════
// RSVP — Guest Response Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * getInviteeByToken
 * Looks up a guest by their unique RSVP token.
 * This is the first thing the RSVP page does when it loads —
 * it reads the token from the URL and uses it to find the guest.
 */
export const getInviteeByToken = async token => {
  const ref = collection(db, "invitee");
  const q = query(ref, where("token", "==", token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    inviteeId: d.id,
    ...d.data()
  };
};

/**
 * submitRSVP
 * The main function called when a guest submits their RSVP form.
 * Does three things in order:
 *   1. Validates the token (makes sure the link is real and not already used)
 *   2. Prevents duplicate submissions using tokenUsed
 *   3. Updates the `invitee` document with their RSVP response
 *
 *   RSVP stored directly in invitee doc
 * 
 * Returns { success: true } or { success: false, error: "message" }
 */
export const submitRSVP = async (token, response) => {
  try {
    // Step 1: Find the guest by their token
    const invitee = await getInviteeByToken(token);

    if (!invitee || !invitee.inviteeId) {
      return {
        success: false,
        error: "Invalid or expired invitation link."
      };
    }

    // Step 2: Prevent duplicate submissions
    // tokenUsed becomes true after their first submission
    if (invitee.tokenUsed) {
      return {
        success: false,
        error: "This RSVP has already been submitted."
      };
    }

    //Describes how the RSVP worked if we ever need again

    // Step 3: Write their response to the `rsvp` collection.
    // IMPORTANT: `token` must be included here because the Firestore security
    // rule verifies it matches the token stored on the invitee document.
    // Without it, the rule rejects the write with "Missing or insufficient permissions".
    // `plusOnes` stores the names and meal preferences of any extra guests.
    //const rsvpRef = collection(db, "rsvp");

    //const rsvpDoc = await addDoc(rsvpRef, {
      //inviteeId:           invitee.inviteeId,
      //token:               token,               // required by Firestore security rule
      //attending:           response.attending,
      //dietaryRestrictions: response.dietaryRestrictions,
      //guestCount:          response.guestCount, // total party size including plus ones
      //plusOnes:            response.plusOnes || [], // array of { name, meal } for each plus one
      //submittedAt:         serverTimestamp(),
    //});

    // Step 4: Update the invitee doc so the dashboard and guest list reflect the response.
    // Also sets tokenUsed = true so the link cannot be used again (prevents duplicates).
    // plusOnes is stored on the invitee doc too so the guest list page can show them.
    // Declined RSVPs never carry party/meal details, even if the form still
    // holds values from before the guest switched to "decline".
    const attending = response.attending === true;

    // Name / email the guest confirmed on the RSVP form. Written onto the SAME
    // invitee doc (no new invitee is created). Only sent when non-empty so a
    // blank value can never wipe the host's stored name/email.
    const identityUpdates = {};
    const submittedName = (response.guestName || "").trim();
    const submittedEmail = (response.email || "").trim();
    if (submittedName) identityUpdates.guestName = submittedName;
    if (submittedEmail) identityUpdates.email = submittedEmail;

    await updateInvitee(invitee.inviteeId, {
      ...identityUpdates,
      //rsvpId:              rsvpDoc.id,                              // link to their rsvp doc
      attending:           attending,
      guestCount:          attending ? response.guestCount : 0, //added from the rsvp table
      dietaryRestrictions: attending ? (response.dietaryRestrictions || "") : "",
      mealId:              attending ? (response.mealId || "") : "", // main guest meal option id ("" = none)
      meal:                attending ? (response.meal || "") : "",   // main guest meal name snapshot
      plusOnes:            attending ? (response.plusOnes || []) : [], // [{ name, mealId, meal, dietaryRestrictions }]
      rsvpStatus:          attending ? "Accepted" : "Declined", // shown in guest list
      tokenUsed:           true,                                    // prevents duplicate RSVPs
      respondedAt:         serverTimestamp(),                       // used for "X hours ago" in dashboard
    });

    return {
      success: true
    };

  } catch (err) {
    console.error("RSVP submission error:", err);

    return {
      success: false,
      error: "Something went wrong. Please try again."
    };
  }
};

/**
 * getRSVPByInvitee
 * Fetches the RSVP response for a specific guest.
 * Used if the dashboard wants to show detailed response info.
 */
export const getRSVPByInvitee = async inviteeId => {
  const ref = doc(db, "invitee", inviteeId); //collection to doc and rsvp to invitee
  //const q = query(ref, where("inviteeId", "==", inviteeId)); //unneeded after removing rsvp table
  const snap = await getDocs(ref);

  if (snap.empty) return null;
  //const d = snap.docs[0];

  return {
    rsvpId: snap.id,
    ...snap.data()
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRIES — Gift Registry Functions
// ══════════════════════════════════════════════════════════════════════════════
// Registries are NOT their own collection. They live inside the wedding's
// invitation document as an embedded array, per the team's ERD:
//
//   invitations/{weddingId}.registries = [ { id, name, url, isVisible }, ... ]
//   invitations/{weddingId}.registryMessage = string
//
// Add/edit/delete/toggle all do a read-modify-write on that array inside a
// Firestore transaction so two quick edits can't overwrite each other, and so
// no other field on the invitation document is touched.
// crypto.randomUUID() gives each entry a stable unique id (same generator
// addInvitee uses for RSVP tokens) — the array index is never the id.

/**
 * registriesRef / readRegistries
 * Internal: fetch the invitation doc inside a transaction and return the array.
 */
const readRegistries = async (transaction, invRef) => {
  const snap = await transaction.get(invRef);
  if (!snap.exists()) throw new Error("Wedding not found.");
  return snap.data().registries || [];
};

/**
 * addRegistry
 * Appends a new registry entry to the invitation's `registries` array.
 * Returns the updated array so callers can refresh UI without a second query.
 */
export const addRegistry = async (weddingId, { name, url, isVisible = true }) => {
  const invRef = doc(db, "invitations", weddingId);
  return runTransaction(db, async transaction => {
    const registries = await readRegistries(transaction, invRef);
    const updated = [...registries, { id: crypto.randomUUID(), name, url, isVisible }];
    transaction.update(invRef, { registries: updated });
    return updated;
  });
};

/**
 * updateRegistry
 * Updates allowed fields (name, url, isVisible) on a single registry entry
 * inside the invitation's `registries` array. Other entries are untouched.
 * Returns the updated array.
 */
export const updateRegistry = async (weddingId, registryId, updates) => {
  const invRef = doc(db, "invitations", weddingId);
  return runTransaction(db, async transaction => {
    const registries = await readRegistries(transaction, invRef);
    if (!registries.some(r => r.id === registryId)) {
      throw new Error("Registry not found.");
    }
    const updated = registries.map(r =>
      r.id === registryId
        ? {
            ...r,
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.url !== undefined && { url: updates.url }),
            ...(updates.isVisible !== undefined && { isVisible: updates.isVisible }),
          }
        : r
    );
    transaction.update(invRef, { registries: updated });
    return updated;
  });
};

/**
 * deleteRegistry
 * Removes a single registry entry from the invitation's `registries` array.
 * Does not touch the wedding's invitee or rsvp data.
 * Returns the updated array.
 */
export const deleteRegistry = async (weddingId, registryId) => {
  const invRef = doc(db, "invitations", weddingId);
  return runTransaction(db, async transaction => {
    const registries = await readRegistries(transaction, invRef);
    const updated = registries.filter(r => r.id !== registryId);
    transaction.update(invRef, { registries: updated });
    return updated;
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// WEDDING ASSISTANT — Chat Messages
// ══════════════════════════════════════════════════════════════════════════════
// One continuous chat per couple, one document per message, stored at:
//
//   betrothed/{userId}/messages/{messageId}
//     role:      "user" | "assistant"
//     content:   [{ type: "text", text: "..." }]  (same block shape the Claude API uses)
//     createdAt: server timestamp
//     status:    user messages:      "pending" -> "replied" | "error" | "superseded"
//                assistant messages: "complete"
//
// WHO WRITES WHAT:
//   - This file (the client) ONLY creates user messages and listens for new docs.
//   - The Cloud Function (functions/index.js) is the ONLY thing that talks to
//     Claude, and the only thing that writes assistant messages / updates status.
//   - The client never calls the Claude API and never holds an API key.

// the messages subcollection hangs directly off the user's profile document
const messagesCol = (userId) =>
  collection(db, "betrothed", userId, "messages");

/**
 * messageText
 * Content is stored as an array of blocks. The chat UI only needs plain text,
 * so this joins the text blocks into one string.
 */
export const messageText = (message) =>
  (message.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

/**
 * sendUserMessage
 * Writes one user message with status "pending". That write is the ONLY thing
 * the client does: it triggers the Cloud Function, which writes the reply.
 * Returns the new message ID.
 */
export const sendUserMessage = async (userId, text) => {
  const ref = await addDoc(messagesCol(userId), {
    role: "user",
    content: [{ type: "text", text }],
    createdAt: serverTimestamp(),
    status: "pending",
  });
  return ref.id;
};

/**
 * subscribeToMessages
 * Live listener on the whole chat, oldest first. Calls onMessages(array) once
 * with the saved history and again every time a document is added or changed
 * (including the assistant's reply and status changes).
 * Returns the unsubscribe function: call it in the useEffect cleanup.
 */
export const subscribeToMessages = (userId, onMessages, onError) => {
  const q = query(messagesCol(userId), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
};

/**
 * retryUserMessage
 * A trigger only fires when a document is CREATED, so "retry" means: delete the
 * failed user message and write the same text again as a brand-new message.
 * Both happen in one batch so the chat never shows a duplicate.
 */
export const retryUserMessage = async (userId, failedMessage) => {
  const batch = writeBatch(db);
  batch.delete(doc(messagesCol(userId), failedMessage.id));
  batch.set(doc(messagesCol(userId)), {
    role: "user",
    content: failedMessage.content,
    createdAt: serverTimestamp(),
    status: "pending",
  });
  await batch.commit();
};

/**
 * clearMessages
 * Deletes every message in the chat. Firestore caps a batch at 500 writes, so
 * deletes are split into chunks and a long chat can still be cleared.
 */
const BATCH_LIMIT = 400;

export const clearMessages = async (userId) => {
  const snap = await getDocs(messagesCol(userId));
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};