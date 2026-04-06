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
//   bethrothed/{userId}      — host user profile (created on signup)
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
serverTimestamp // Firebase server time (more reliable than client time)
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ══════════════════════════════════════════════════════════════════════════════
// TYPESCRIPT TYPES
// These define the shape of each document in Firestore.
// Use these types in pages so TypeScript catches typos and missing fields.
// ══════════════════════════════════════════════════════════════════════════════

/** Shape of a document in the `bethrothed` collection */

/** Shape of a document in the `invitations` collection */

/** Shape of a document in the `invitee` collection */

/** Shape of a document in the `rsvp` collection */

// ══════════════════════════════════════════════════════════════════════════════
// BETHROTHED — User Profile Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * createUserProfile
 * Called right after signup to create the user's profile in Firestore.
 * We use setDoc with the uid as the document ID so it's easy to look up later.
 */
export const createUserProfile = async (uid, name, email) => {
  // doc(db, "collection", "documentId") — creates a reference to a specific doc
  const ref = doc(db, "bethrothed", uid);
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
  const ref = doc(db, "bethrothed", uid);
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
export const addInvitee = async (weddingId, guestName, plusOneLimit = 0 // default: no plus ones allowed
) => {
  // crypto.randomUUID() generates a unique token like "a3f2c1d4-..."
  const token = crypto.randomUUID();
  const ref = collection(db, "invitee");
  const newDoc = await addDoc(ref, {
    weddingId,
    guestName,
    plusOneLimit,
    token,
    tokenUsed: false,
    // becomes true after they RSVP
    rsvpStatus: "Pending",
    // starts as Pending until they respond
    attending: null,
    // null until they RSVP
    dietaryRestrictions: "",
    addedAt: serverTimestamp()
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
 *   2. Creates a new document in the `rsvp` collection with their answers
 *   3. Updates the `invitee` document to reflect their response
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

    // Step 3: Write their response to the `rsvp` collection
    const rsvpRef = collection(db, "rsvp");
    const rsvpDoc = await addDoc(rsvpRef, {
      inviteeId: invitee.inviteeId,
      attending: response.attending,
      dietaryRestrictions: response.dietaryRestrictions,
      guestCount: response.guestCount,
      message: response.message,
      submittedAt: serverTimestamp()
    });

    // Step 4: Update the invitee doc so the dashboard shows their status
    await updateInvitee(invitee.inviteeId, {
      rsvpId: rsvpDoc.id,
      // link to their rsvp doc
      attending: response.attending,
      dietaryRestrictions: response.dietaryRestrictions,
      rsvpStatus: response.attending ? "Accepted" : "Declined",
      // shown in guest list
      tokenUsed: true // lock the link
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
  const ref = collection(db, "rsvp");
  const q = query(ref, where("inviteeId", "==", inviteeId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    rsvpId: d.id,
    ...d.data()
  };
};
