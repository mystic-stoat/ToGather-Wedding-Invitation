// src/lib/mediaConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   One place for every photo-upload limit used by the Invitation Builder
//   (Hero Photo + Our Story). Change a number here and the whole UI follows.
//
// ⚠️  KEEP IN SYNC: storage.rules repeats the 5 MB per-file cap and the
//   allowed content types, because security rules can't import JS. If you
//   change MAX_STORED_PHOTO_BYTES or the accepted types, update storage.rules
//   (and the storyEntries checks in firestore.rules) too.
// ─────────────────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

/** Largest original file a couple can pick (checked before compression). */
export const MAX_ORIGINAL_PHOTO_BYTES = 5 * MB;

/** Largest file that may be stored after compression (also enforced in storage.rules). */
export const MAX_STORED_PHOTO_BYTES = 5 * MB;

/**
 * Total photo storage allowed per wedding — Hero + every Story photo.
 * Enforced client-side (see docs/STORY_AND_MEDIA.md for the limitations and
 * the server-side design).
 */
export const WEDDING_MEDIA_QUOTA_BYTES = 100 * MB;

/** Formats we accept. HEIC/GIF/SVG are rejected (not reliably displayable / unsafe). */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Value for <input type="file" accept=...> */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

/** Longest edge after resizing, in pixels. Big enough for a full-width desktop photo. */
export const MAX_IMAGE_DIMENSION = 1600;

/** WebP/JPEG quality used when re-encoding (0–1). */
export const IMAGE_QUALITY = 0.82;

/** Uploaded files never change (every upload gets a new unique name), so browsers may cache them for a year. */
export const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** "4.2 MB" / "820 KB" style label. */
export const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n >= MB) return `${(n / MB).toFixed(n >= 10 * MB ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};
