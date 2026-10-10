// Unit tests for the photo position/zoom math (src/lib/photoAdjust.js).
import { describe, it, expect } from "vitest";
import {
  DEFAULT_ADJUST, normalizeAdjust, isDefaultAdjust, adjustForSave, photoImageStyle,
  overflowPx, panAdjust, zoomAdjust, nudgeAdjust,
} from "@/lib/photoAdjust";

// A 200×250 (4:5) frame
const frame = { width: 200, height: 250 };
const landscape = { width: 1600, height: 900 };  // wider than the frame
const portrait = { width: 900, height: 1600 };   // taller than the frame
const sameShape = { width: 800, height: 1000 };  // exactly 4:5

describe("normalizing", () => {
  it("defaults to centered at 100%", () => {
    expect(normalizeAdjust(undefined)).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(isDefaultAdjust(undefined)).toBe(true);
    expect(isDefaultAdjust(DEFAULT_ADJUST)).toBe(true);
  });

  it("clamps and rounds bad or extreme values", () => {
    expect(normalizeAdjust({ x: -20, y: 130, zoom: 9 })).toEqual({ x: 0, y: 100, zoom: 3 });
    expect(normalizeAdjust({ x: "a", y: NaN, zoom: 0.2 })).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(normalizeAdjust({ x: 33.33333, y: 66.66666, zoom: 1.23456 })).toEqual({ x: 33.33, y: 66.67, zoom: 1.23 });
  });

  it("only stores non-default adjustments", () => {
    expect(adjustForSave({ x: 50, y: 50, zoom: 1 })).toBeUndefined();
    expect(adjustForSave(undefined)).toBeUndefined();
    expect(adjustForSave({ x: 20, y: 50, zoom: 1 })).toEqual({ x: 20, y: 50, zoom: 1 });
  });
});

describe("rendering style (shared by editor and invitation)", () => {
  it("centers an unadjusted photo like object-fit: cover", () => {
    expect(photoImageStyle({})).toEqual({
      objectFit: "cover", objectPosition: "50% 50%", transformOrigin: "50% 50%", transform: undefined,
    });
  });

  it("pins the focal point and zooms around it", () => {
    expect(photoImageStyle({ adjust: { x: 20, y: 75, zoom: 1.5 } })).toEqual({
      objectFit: "cover", objectPosition: "20% 75%", transformOrigin: "20% 75%", transform: "scale(1.5)",
    });
  });
});

describe("overflow", () => {
  it("a landscape photo in a portrait frame only overflows sideways at 100%", () => {
    const o = overflowPx(frame, landscape, 1);
    expect(o.y).toBe(0);
    expect(o.x).toBeCloseTo(250 * (1600 / 900) - 200, 5); // covers height 250 → width 444.4
  });
  it("zooming adds overflow on both axes", () => {
    const o = overflowPx(frame, sameShape, 2);
    expect(o).toEqual({ x: 200, y: 250 });
  });
  it("is zero without sizes", () => {
    expect(overflowPx({ width: 0, height: 0 }, landscape)).toEqual({ x: 0, y: 0 });
    expect(overflowPx(frame, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("dragging (panAdjust)", () => {
  it("follows the pointer: dragging right shows more of the left side", () => {
    const over = overflowPx(frame, landscape, 1).x; // ≈ 244.4 px
    const next = panAdjust(DEFAULT_ADJUST, over / 2, 0, frame, landscape);
    expect(next.x).toBeCloseTo(0, 1);  // moved fully to the left edge of the photo
    expect(next.y).toBe(50);           // no vertical overflow → unchanged
  });

  it("moves vertically for a tall photo and never past the edges", () => {
    const next = panAdjust(DEFAULT_ADJUST, 50, -10000, frame, portrait);
    expect(next.x).toBe(50);   // no horizontal overflow at 100%
    expect(next.y).toBe(100);  // clamped: bottom edge of the photo
  });

  it("does not move a photo that exactly fits, until it is zoomed", () => {
    expect(panAdjust(DEFAULT_ADJUST, 40, 40, frame, sameShape)).toEqual(DEFAULT_ADJUST);
    const zoomed = { x: 50, y: 50, zoom: 2 }; // overflow 200 × 250
    expect(panAdjust(zoomed, -20, 25, frame, sameShape)).toEqual({ x: 60, y: 40, zoom: 2 });
  });

  it("uses the total movement from the drag start (no drift)", () => {
    const start = { x: 50, y: 50, zoom: 2 };
    const a = panAdjust(start, 10, 0, frame, sameShape);
    const b = panAdjust(start, 30, 0, frame, sameShape);
    expect(a.x).toBe(45);
    expect(b.x).toBe(35);
  });
});

describe("zoom and keyboard", () => {
  it("zooms within 1×–3× and keeps the focal point", () => {
    expect(zoomAdjust({ x: 10, y: 90, zoom: 1 }, 2.5)).toEqual({ x: 10, y: 90, zoom: 2.5 });
    expect(zoomAdjust(DEFAULT_ADJUST, 10).zoom).toBe(3);
    expect(zoomAdjust(DEFAULT_ADJUST, 0).zoom).toBe(1);
  });

  it("arrow keys move the photo the way they point", () => {
    expect(nudgeAdjust(DEFAULT_ADJUST, 2, 0)).toEqual({ x: 48, y: 50, zoom: 1 });  // ArrowRight
    expect(nudgeAdjust(DEFAULT_ADJUST, 0, -10)).toEqual({ x: 50, y: 60, zoom: 1 }); // Shift+ArrowUp
  });
});
