// src/lib/photoAdjust.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure math for "Adjust photo" (drag to reposition + zoom) — no React, no
//   Firebase. Used by the editor (ImageSlot) AND by every place that shows a
//   photo (phone preview hero, Our Story section), so they always match.
//
// THE MODEL — a focal point plus a zoom:
//   adjust = { x, y, zoom }
//     x, y  0–100 — the point of the photo (in % of its width/height) that is
//                   pinned to the same % position of the frame. 50/50 = centered.
//     zoom  1–3   — 1 = the photo just covers the frame (like object-fit: cover).
//   Rendered with plain CSS:
//     object-fit: cover; object-position: x% y%;
//     transform: scale(zoom); transform-origin: x% y%;
//   Because it is relative (percentages), the same adjust looks identical in
//   any frame with the same aspect ratio, at any size — the editor slot and
//   the invitation preview — and degrades gracefully in a frame with a
//   different shape (the chosen focal point stays in view). The photo always
//   covers the frame: there are never empty gaps, at any position or zoom.
//
//   Stored on the photo object in Firestore as `adjust` — only when it differs
//   from the default, so untouched photos keep their existing shape.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.01;
export const DEFAULT_ADJUST = Object.freeze({ x: 50, y: 50, zoom: 1 });

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = (n, places) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const num = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Any input → a valid { x, y, zoom } (clamped and rounded). */
export const normalizeAdjust = (a) => ({
  x: round(clamp(num(a?.x, 50), 0, 100), 2),
  y: round(clamp(num(a?.y, 50), 0, 100), 2),
  zoom: round(clamp(num(a?.zoom, 1), MIN_ZOOM, MAX_ZOOM), 2),
});

export const isDefaultAdjust = (a) => {
  const n = normalizeAdjust(a);
  return n.x === 50 && n.y === 50 && n.zoom === 1;
};

/** The adjust to store on a photo, or undefined when it is the default. */
export const adjustForSave = (a) => (a && !isDefaultAdjust(a) ? normalizeAdjust(a) : undefined);

/** Inline style for an <img> that fills its frame (frame must be overflow: hidden). */
export const photoImageStyle = (photo) => {
  const { x, y, zoom } = normalizeAdjust(photo?.adjust);
  return {
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
  };
};

/**
 * How far (in px) the displayed photo extends past the frame on each axis,
 * for a given zoom. Image size can come from the stored width/height or the
 * loaded <img>'s natural size.
 */
export const overflowPx = (frame, image, zoom = 1) => {
  if (!frame?.width || !frame?.height || !image?.width || !image?.height) return { x: 0, y: 0 };
  const cover = Math.max(frame.width / image.width, frame.height / image.height);
  return {
    x: Math.max(0, image.width * cover * zoom - frame.width),
    y: Math.max(0, image.height * cover * zoom - frame.height),
  };
};

/**
 * panAdjust — the photo follows the pointer.
 * `start` is the adjust when the drag began; (dx, dy) the total pointer
 * movement in px since then (using the total avoids drift).
 * With object-position + scale around the same origin, the photo's left edge
 * sits at x% × (frameWidth − displayedWidth), so 1 px of pointer movement
 * changes x by 100 / overflow %. Axes with no overflow don't move.
 */
export const panAdjust = (start, dx, dy, frame, image) => {
  const s = normalizeAdjust(start);
  const over = overflowPx(frame, image, s.zoom);
  return normalizeAdjust({
    ...s,
    x: over.x > 0.5 ? s.x - (dx / over.x) * 100 : s.x,
    y: over.y > 0.5 ? s.y - (dy / over.y) * 100 : s.y,
  });
};

/** New zoom, keeping the focal point (zoom is anchored at x/y). */
export const zoomAdjust = (a, zoom) => normalizeAdjust({ ...normalizeAdjust(a), zoom });

/** Keyboard nudge in % of the photo (arrow keys move the photo the way they point). */
export const nudgeAdjust = (a, dxPct, dyPct) => {
  const s = normalizeAdjust(a);
  return normalizeAdjust({ ...s, x: s.x - dxPct, y: s.y - dyPct });
};
