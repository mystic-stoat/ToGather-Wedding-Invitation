// src/lib/weddingPartyStore.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Firestore reads/writes for Wedding Party contact details that must stay
//   PRIVATE. They live in an owner-only document:
//
//     invitations/{weddingId}/private/weddingPartyContacts
//       { contacts: { [memberId]: { phone, email } }, updatedAt }
//
//   The members themselves (name, role, side, photo, …) are saved on the
//   invitation document by the photo Save pipeline (src/lib/storySave.js),
//   and only carry phone/email there when the couple chose to show them.
//   See src/lib/weddingParty.js and firestore.rules.
//
//   Kept out of firestore.js so it can be mocked/tested on its own, like
//   src/lib/storyStore.js.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizePrivateContacts } from "@/lib/weddingParty";

export const PARTY_CONTACTS_DOC_ID = "weddingPartyContacts";

const contactsRef = (weddingId) => doc(db, "invitations", weddingId, "private", PARTY_CONTACTS_DOC_ID);

/** Resolves to { [memberId]: { phone, email } } ({} when nothing was saved yet). */
export const loadPartyContacts = async (weddingId) => {
  const snap = await getDoc(contactsRef(weddingId));
  return snap.exists() ? normalizePrivateContacts(snap.data()) : {};
};

/** Replaces the whole contacts map (members that were removed disappear too). */
export const savePartyContacts = (weddingId, contacts) =>
  setDoc(contactsRef(weddingId), { contacts, updatedAt: serverTimestamp() });
