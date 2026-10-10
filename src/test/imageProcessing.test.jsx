// Unit tests for photo validation / preparation (no canvas, no Firebase).
import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  sniffImageType, validateImageFile, preparePhoto, fitWithin, extensionFor, photoSrc,
} from "@/lib/imageProcessing";
import { MAX_ORIGINAL_PHOTO_BYTES, formatBytes } from "@/lib/mediaConfig";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];

const fileOf = (bytes, name = "a.jpg", type = "image/jpeg", padTo = 0) => {
  const body = new Uint8Array(Math.max(bytes.length, padTo));
  body.set(bytes);
  return new File([body], name, { type });
};

beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
});

describe("sniffImageType", () => {
  it("recognizes JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImageType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffImageType(new Uint8Array(WEBP))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array(GIF))).toBeNull();
    expect(sniffImageType(new Uint8Array([1]))).toBeNull();
  });
});

describe("validateImageFile", () => {
  it("accepts supported photos", async () => {
    expect(await validateImageFile(fileOf(PNG, "a.png", "image/png"))).toEqual({ ok: true, type: "image/png" });
  });

  it("rejects files over 5 MB", async () => {
    const big = fileOf(JPEG, "big.jpg", "image/jpeg", MAX_ORIGINAL_PHOTO_BYTES + 1);
    const res = await validateImageFile(big);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/5\.0 MB or smaller/);
  });

  it("rejects unsupported formats even when the extension lies", async () => {
    const res = await validateImageFile(fileOf(GIF, "fake.jpg", "image/jpeg"));
    expect(res).toEqual({ ok: false, error: "Please choose a JPEG, PNG, or WebP photo." });
  });

  it("rejects empty and missing files", async () => {
    expect((await validateImageFile(null)).ok).toBe(false);
    expect((await validateImageFile(new File([], "e.jpg"))).ok).toBe(false);
  });
});

describe("preparePhoto", () => {
  it("returns a pending photo with the compressed size", async () => {
    const compress = vi.fn(async () => ({
      blob: new Blob([new Uint8Array(1234)], { type: "image/webp" }), width: 1600, height: 1200, contentType: "image/webp",
    }));
    const res = await preparePhoto(fileOf(JPEG, "beach.jpg"), { compress });
    expect(res.ok).toBe(true);
    expect(res.photo).toMatchObject({ pending: true, bytes: 1234, width: 1600, height: 1200, contentType: "image/webp", fileName: "beach.jpg" });
    expect(res.photo.localId).toBeTruthy();
    expect(photoSrc(res.photo)).toBe(res.photo.previewUrl);
  });

  it("does not compress invalid files and reports processing failures", async () => {
    const compress = vi.fn();
    expect((await preparePhoto(fileOf(GIF), { compress })).ok).toBe(false);
    expect(compress).not.toHaveBeenCalled();

    const failing = vi.fn(async () => { throw new Error("decode"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await preparePhoto(fileOf(JPEG), { compress: failing });
    expect(res).toEqual({ ok: false, error: "We couldn't process that photo. Please try a different one." });
  });
});

describe("helpers", () => {
  it("fitWithin keeps aspect ratio and never upscales", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 3000, 1600)).toEqual({ width: 533, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it("maps content types to extensions and formats bytes", () => {
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });
});
