// src/lib/storyStore.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Firestore reads/writes for "Our Story" and the photo bookkeeping fields on
//   the invitation document. Kept out of firestore.js so the Story feature can
//   be mocked/tested on its own.
//
//   invitations/{weddingId}                  (existing doc — new fields only)
//     heroImage           { path, url, width, height, bytes, contentType } | null
//     mediaBytesUsed      number  — see docs/STORY_AND_MEDIA.md
//     mediaPendingDeletes [{ path, bytes }] — files waiting to be deleted
//   invitations/{weddingId}/storyEntries/{entryId}
//     { id, layout, title, description, images, order, createdAt, updatedAt }
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection, doc, query, orderBy, limit, startAfter, getDocs,
  writeBatch, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const STORY_PAGE_SIZE = 20;
// Firestore allows 500 writes per batch; leave headroom for the invitation update.
const MAX_WRITES_PER_BATCH = 450;

const entriesCol = (weddingId) => collection(db, "invitations", weddingId, "storyEntries");

/**
 * loadAllStoryEntries
 * Loads Story entries in display order, one page at a time, calling
 * onPage(rawEntriesSoFar) after each page so the builder can render the first
 * blocks immediately while the rest load ("progressive loading").
 * Resolves to [{ docId, data }] for ALL entries — the builder needs the full
 * list before it can save (to keep order and mediaBytesUsed correct).
 */
export const loadAllStoryEntries = async (weddingId, { onPage, pageSize = STORY_PAGE_SIZE } = {}) => {
  const all = [];
  let cursor = null;
  for (;;) {
    const q = cursor
      ? query(entriesCol(weddingId), orderBy("order"), startAfter(cursor), limit(pageSize))
      : query(entriesCol(weddingId), orderBy("order"), limit(pageSize));
    const snap = await getDocs(q);
    snap.docs.forEach(d => all.push({ docId: d.id, data: d.data() }));
    if (onPage) onPage([...all]);
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return all;
};

/**
 * commitMediaChanges
 * Writes Story entry changes + the invitation's photo fields.
 * Normally ONE atomic batch: either everything is saved or nothing is.
 * (Only if a single save touches more than ~450 blocks is it split; the
 * invitation fields always go in the LAST batch so mediaBytesUsed never
 * claims files that aren't referenced yet.)
 *
 * changes = { creates: entryData[], updates: entryData[], deletes: id[] }
 * invitationFields = { heroImage, mediaBytesUsed, mediaPendingDeletes, partyMembers? }
 *   (partyMembers = Wedding Party members, only present when they changed —
 *    see src/lib/storySave.js)
 */
export const commitMediaChanges = async (weddingId, changes, invitationFields) => {
  const ops = [
    ...changes.creates.map(e => b => b.set(doc(entriesCol(weddingId), e.id), {
      ...e, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })),
    ...changes.updates.map(e => b => b.update(doc(entriesCol(weddingId), e.id), {
      layout: e.layout, title: e.title, description: e.description,
      images: e.images, order: e.order, updatedAt: serverTimestamp(),
    })),
    ...changes.deletes.map(id => b => b.delete(doc(entriesCol(weddingId), id))),
  ];
  const chunks = [];
  for (let i = 0; i < ops.length; i += MAX_WRITES_PER_BATCH) chunks.push(ops.slice(i, i + MAX_WRITES_PER_BATCH));
  if (chunks.length === 0) chunks.push([]);

  for (let i = 0; i < chunks.length; i++) {
    const batch = writeBatch(db);
    chunks[i].forEach(op => op(batch));
    if (i === chunks.length - 1) {
      batch.update(doc(db, "invitations", weddingId), invitationFields);
    }
    await batch.commit();
  }
};

/** Updates just the delete-queue bookkeeping after old files were removed. */
export const updateMediaBookkeeping = (weddingId, { mediaBytesUsed, mediaPendingDeletes }) =>
  updateDoc(doc(db, "invitations", weddingId), { mediaBytesUsed, mediaPendingDeletes });
