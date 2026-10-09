// src/lib/mediaStorage.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   The ONLY place the app talks to Firebase Cloud Storage. Files live at:
//     weddings/{weddingId}/hero/{fileId}.{ext}
//     weddings/{weddingId}/story/{entryId}/{fileId}.{ext}
//   Every upload gets a brand-new fileId, so a path is never reused or shared
//   between the Hero Photo and Story — deleting one can't break another.
//   storage.rules lets only the wedding's owner write here.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { UPLOAD_CACHE_CONTROL } from "@/lib/mediaConfig";
import { extensionFor } from "@/lib/imageProcessing";

const newFileId = () => crypto.randomUUID();

export const weddingMediaPrefix = (weddingId) => `weddings/${weddingId}/`;

export const buildHeroPath = (weddingId, contentType, fileId = newFileId()) =>
  `weddings/${weddingId}/hero/${fileId}.${extensionFor(contentType)}`;

export const buildStoryPath = (weddingId, entryId, contentType, fileId = newFileId()) =>
  `weddings/${weddingId}/story/${entryId}/${fileId}.${extensionFor(contentType)}`;

/**
 * uploadPhoto
 * Uploads a pending photo's blob to `path`. Calls onProgress(0–100).
 * Resolves to the saved-photo object stored in Firestore:
 *   { path, url, width, height, bytes, contentType }
 */
export const uploadPhoto = (path, photo, onProgress = () => {}) =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), photo.blob, {
      contentType: photo.contentType,
      cacheControl: UPLOAD_CACHE_CONTROL,
    });
    task.on(
      "state_changed",
      snap => {
        if (snap.totalBytes) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress(100);
          resolve({
            path,
            url,
            width: photo.width,
            height: photo.height,
            bytes: photo.bytes,
            contentType: photo.contentType,
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });

/**
 * deletePhoto
 * Deletes a stored file, but ONLY if it lives under this wedding's folder —
 * a defensive check so a bad path can never delete someone else's file.
 * A file that is already gone counts as success.
 * Resolves true when the file is gone, false when deletion failed.
 */
export const deletePhoto = async (weddingId, path) => {
  if (!weddingId || typeof path !== "string" || !path.startsWith(weddingMediaPrefix(weddingId))) {
    console.warn("Refusing to delete a file outside this wedding:", path);
    return false;
  }
  try {
    await deleteObject(ref(storage, path));
    return true;
  } catch (err) {
    if (err?.code === "storage/object-not-found") return true;
    console.error("Photo delete failed:", path, err);
    return false;
  }
};
