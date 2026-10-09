// src/lib/imageProcessing.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Everything that happens to a photo between "the couple picked a file" and
//   "it is ready to upload on Save" — all in the browser, no network:
//     1. validateImageFile → checks size (≤ 5 MB) and the REAL file type by
//        reading its first bytes (a renamed .exe → .jpg is rejected).
//     2. compressImage     → resizes to ≤ 1600 px and re-encodes as WebP
//        (JPEG fallback). Re-encoding also strips EXIF metadata such as GPS.
//     3. preparePhoto      → 1 + 2, returning a "pending photo" object that the
//        builder can preview immediately and upload later when Save is clicked.
//
//   A pending photo looks like:
//     { pending: true, localId, blob, previewUrl, width, height, bytes,
//       contentType, fileName }
//   A saved photo (stored in Firestore) looks like:
//     { path, url, width, height, bytes, contentType }
// ─────────────────────────────────────────────────────────────────────────────

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_ORIGINAL_PHOTO_BYTES,
  MAX_STORED_PHOTO_BYTES,
  MAX_IMAGE_DIMENSION,
  IMAGE_QUALITY,
  formatBytes,
} from "@/lib/mediaConfig";

// ── Reading the first bytes of a file (works in browsers and in jsdom tests) ──
const readHeaderBytes = (file, count = 12) => {
  const slice = file.slice(0, count);
  if (typeof slice.arrayBuffer === "function") {
    return slice.arrayBuffer().then(buf => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
};

/**
 * sniffImageType
 * Returns "image/jpeg" | "image/png" | "image/webp" based on the file's
 * signature ("magic bytes"), or null when it is none of those.
 */
export const sniffImageType = (bytes) => {
  if (!bytes || bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // WebP: "RIFF" .... "WEBP"
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
};

/**
 * validateImageFile
 * Resolves to { ok: true, type } or { ok: false, error } with a friendly message.
 * Never throws.
 */
export const validateImageFile = async (file) => {
  if (!file) return { ok: false, error: "No file was selected." };
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_ORIGINAL_PHOTO_BYTES) {
    return {
      ok: false,
      error: `That photo is ${formatBytes(file.size)}. Please choose one that is ${formatBytes(MAX_ORIGINAL_PHOTO_BYTES)} or smaller.`,
    };
  }
  let type = null;
  try {
    type = sniffImageType(await readHeaderBytes(file));
  } catch {
    return { ok: false, error: "We couldn't read that file. Please try another photo." };
  }
  if (!type || !ACCEPTED_IMAGE_TYPES.includes(type)) {
    return { ok: false, error: "Please choose a JPEG, PNG, or WebP photo." };
  }
  return { ok: true, type };
};

// ── Canvas helpers ────────────────────────────────────────────────────────────
const canvasToBlob = (canvas, type, quality) =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality));

/** Scale (w, h) so the longest edge is at most `max`. Never upscales. */
export const fitWithin = (width, height, max = MAX_IMAGE_DIMENSION) => {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/**
 * compressImage
 * Resizes and re-encodes a validated image. Resolves to
 * { blob, width, height, contentType }.
 * Safari can't encode WebP from a canvas (it silently returns PNG), so we
 * check the result type and fall back to JPEG.
 */
export const compressImage = async (file) => {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("This browser can't process photos.");
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't process photos.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY);
    }
    if (!blob) throw new Error("We couldn't process that photo.");
    return { blob, width, height, contentType: blob.type || "image/jpeg" };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
};

const newLocalId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * preparePhoto
 * Validate + compress a picked file. Resolves to
 *   { ok: true, photo: <pending photo> } or { ok: false, error }.
 * The caller owns photo.previewUrl and should URL.revokeObjectURL it when the
 * photo is discarded.
 * `compress` is injectable for tests.
 */
export const preparePhoto = async (file, { compress = compressImage } = {}) => {
  const check = await validateImageFile(file);
  if (!check.ok) return check;

  let result;
  try {
    result = await compress(file);
  } catch (err) {
    console.error("Photo processing failed:", err);
    return { ok: false, error: "We couldn't process that photo. Please try a different one." };
  }
  if (result.blob.size > MAX_STORED_PHOTO_BYTES) {
    return { ok: false, error: "That photo is still too large after resizing. Please choose a smaller one." };
  }
  return {
    ok: true,
    photo: {
      pending: true,
      localId: newLocalId(),
      blob: result.blob,
      previewUrl: URL.createObjectURL(result.blob),
      width: result.width,
      height: result.height,
      bytes: result.blob.size,
      contentType: result.contentType,
      fileName: file.name || "photo",
    },
  };
};

/** URL to show for a saved or pending photo (or "" for an empty slot). */
export const photoSrc = (photo) => (photo ? (photo.pending ? photo.previewUrl : photo.url) || "" : "");

/** Release a pending photo's preview URL. Safe to call with anything. */
export const releasePhoto = (photo) => {
  if (photo?.pending && photo.previewUrl && typeof URL.revokeObjectURL === "function") {
    try { URL.revokeObjectURL(photo.previewUrl); } catch { /* ignore */ }
  }
};

/** File extension used in the storage path for a content type. */
export const extensionFor = (contentType) =>
  contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
