// Unit tests for the photo Save pipeline: quota, uploads, failures,
// replacements/deletions and mediaBytesUsed bookkeeping. Firebase is faked.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Real modules talk to Firebase; every call here goes through injected `deps`.
vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(), buildHeroPath: vi.fn(), buildStoryPath: vi.fn(),
}));
vi.mock("@/lib/storyStore", () => ({ commitMediaChanges: vi.fn(), updateMediaBookkeeping: vi.fn() }));

import { saveStoryMedia, retryPendingDeletes, MediaSaveError } from "@/lib/storySave";
import { createStoryBlock, toEntryData } from "@/lib/storyBlocks";

const MB = 1024 * 1024;
let n = 0;
const pending = (bytes = 1000, name = "p.jpg") => ({
  pending: true, localId: `local-${++n}`, blob: {}, previewUrl: "blob:x", width: 100, height: 100,
  bytes, contentType: "image/webp", fileName: name,
});
const stored = (path, bytes = 1000) => ({ path, url: `https://cdn/${path}`, width: 100, height: 100, bytes, contentType: "image/webp" });

const makeDeps = (overrides = {}) => ({
  buildHeroPath: vi.fn((w, ct) => `weddings/${w}/hero/new-${++n}.webp`),
  buildStoryPath: vi.fn((w, e) => `weddings/${w}/story/${e}/new-${++n}.webp`),
  uploadPhoto: vi.fn(async (path, photo, onProgress) => { onProgress(50); onProgress(100); return stored(path, photo.bytes); }),
  deletePhoto: vi.fn(async () => true),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
  ...overrides,
});

const base = { weddingId: "w1", savedHero: null, savedEntriesById: {}, pendingDeletes: [], savedMediaBytesUsed: 0 };

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("saveStoryMedia — happy paths", () => {
  it("uploads hero + story photos, commits once, and counts bytes", async () => {
    const deps = makeDeps();
    const block = { ...createStoryBlock("twoPhotos"), images: [pending(300), pending(200), null] };
    const textBlock = { ...createStoryBlock("textOnly"), description: "Hello" };
    const empty = createStoryBlock();
    const progress = vi.fn();

    const res = await saveStoryMedia({ ...base, hero: pending(1000), blocks: [block, empty, textBlock], onProgress: progress, deps });

    expect(deps.uploadPhoto).toHaveBeenCalledTimes(3);
    expect(deps.commitMediaChanges).toHaveBeenCalledTimes(1);
    const [, changes, fields] = deps.commitMediaChanges.mock.calls[0];
    expect(changes.creates.map(e => e.id)).toEqual([block.id, textBlock.id]); // empty block dropped
    expect(changes.creates.map(e => e.order)).toEqual([0, 1]);
    expect(fields.mediaBytesUsed).toBe(1500);
    expect(fields.mediaPendingDeletes).toEqual([]);
    expect(fields.heroImage.path).toMatch(/^weddings\/w1\/hero\//);
    expect(res.hero.pending).toBeUndefined();
    expect(res.blocks[0].images[0].url).toMatch(/^https:/);
    expect(res.mediaBytesUsed).toBe(1500);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ total: 3, done: 3, percent: 100 }));
    expect(deps.deletePhoto).not.toHaveBeenCalled();
  });

  it("skips Firestore entirely when nothing changed", async () => {
    const deps = makeDeps();
    const block = { ...createStoryBlock("textOnly"), title: "Same" };
    const entry = toEntryData(block, 0);
    const res = await saveStoryMedia({ ...base, blocks: [block], hero: null, savedEntriesById: { [block.id]: entry }, deps });
    expect(deps.commitMediaChanges).not.toHaveBeenCalled();
    expect(res.wrote).toBe(false);
  });
});

describe("saveStoryMedia — replacements and deletions", () => {
  it("deletes the old hero only after the commit and keeps the counter exact", async () => {
    const order = [];
    const deps = makeDeps({
      commitMediaChanges: vi.fn(async () => order.push("commit")),
      deletePhoto: vi.fn(async (w, p) => { order.push(`delete ${p}`); return true; }),
    });
    const oldHero = stored("weddings/w1/hero/old.webp", 4000);
    const res = await saveStoryMedia({ ...base, savedHero: oldHero, savedMediaBytesUsed: 4000, hero: pending(1000), blocks: [], deps });

    expect(order).toEqual(["commit", "delete weddings/w1/hero/old.webp"]);
    // While committing, the old file is still counted (queued for deletion)…
    expect(deps.commitMediaChanges.mock.calls[0][2]).toMatchObject({ mediaBytesUsed: 5000, mediaPendingDeletes: [{ path: oldHero.path, bytes: 4000 }] });
    // …and once it is gone, the queue is cleared and only the new hero counts.
    expect(deps.updateMediaBookkeeping).toHaveBeenCalledWith("w1", { mediaBytesUsed: 1000, mediaPendingDeletes: [] });
    expect(res.mediaBytesUsed).toBe(1000);
  });

  it("keeps files that failed to delete in the queue (still counted) for a later retry", async () => {
    const deps = makeDeps({ deletePhoto: vi.fn(async () => false) });
    const old = stored("weddings/w1/story/b1/a.webp", 700);
    const block = { ...createStoryBlock("textOnly"), id: "b1", title: "Now text only", images: [old, null, null] };
    const savedEntry = { ...toEntryData({ ...block, layout: "photoLeft" }, 0) };

    const res = await saveStoryMedia({ ...base, blocks: [block], hero: null, savedEntriesById: { b1: savedEntry }, savedMediaBytesUsed: 700, deps });
    expect(deps.commitMediaChanges.mock.calls[0][1].updates[0].images).toEqual([]); // hidden photo dropped
    expect(res.pendingDeletes).toEqual([{ path: old.path, bytes: 700 }]);
    expect(res.mediaBytesUsed).toBe(700);
    expect(deps.updateMediaBookkeeping).not.toHaveBeenCalled();
  });

  it("deleting a block queues its photos and deletes them", async () => {
    const deps = makeDeps();
    const savedEntry = { id: "b9", layout: "collage", title: "", description: "", order: 0,
      images: [stored("weddings/w1/story/b9/1.webp", 10), stored("weddings/w1/story/b9/2.webp", 20), stored("weddings/w1/story/b9/3.webp", 30)] };
    const res = await saveStoryMedia({ ...base, blocks: [], hero: null, savedEntriesById: { b9: savedEntry }, savedMediaBytesUsed: 60, deps });
    expect(deps.commitMediaChanges.mock.calls[0][1].deletes).toEqual(["b9"]);
    expect(deps.deletePhoto).toHaveBeenCalledTimes(3);
    expect(res.mediaBytesUsed).toBe(0);
  });

  it("never uploads photos hidden by a layout change", async () => {
    const deps = makeDeps();
    const block = { ...createStoryBlock("photoLeft"), images: [pending(10), pending(20), pending(30)] };
    const res = await saveStoryMedia({ ...base, hero: null, blocks: [block], deps });
    expect(deps.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(res.blocks[0].images).toEqual([expect.objectContaining({ bytes: 10 }), null, null]);
  });
});

describe("saveStoryMedia — failures", () => {
  it("rejects over-quota saves before uploading anything", async () => {
    const deps = makeDeps();
    const blocks = [{ ...createStoryBlock("collage"), images: [pending(2 * MB), pending(2 * MB), pending(2 * MB)] }];
    await expect(saveStoryMedia({ ...base, hero: null, blocks, quotaBytes: 5 * MB, deps }))
      .rejects.toMatchObject({ kind: "quota" });
    expect(deps.uploadPhoto).not.toHaveBeenCalled();
    expect(deps.commitMediaChanges).not.toHaveBeenCalled();
  });

  it("on an upload failure, removes this attempt's uploads and writes nothing", async () => {
    let calls = 0;
    const deps = makeDeps({
      uploadPhoto: vi.fn(async (path, photo) => {
        calls++;
        if (photo.fileName === "bad.jpg") throw new Error("network");
        return stored(path, photo.bytes);
      }),
    });
    const blocks = [{ ...createStoryBlock("twoPhotos"), images: [pending(10, "good.jpg"), pending(10, "bad.jpg"), null] }];
    const err = await saveStoryMedia({ ...base, hero: null, blocks, deps }).catch(e => e);
    expect(err).toBeInstanceOf(MediaSaveError);
    expect(err.kind).toBe("upload");
    expect(err.message).toContain("bad.jpg");
    expect(calls).toBe(2);
    expect(deps.deletePhoto).toHaveBeenCalledTimes(1); // the good one is cleaned up
    expect(deps.commitMediaChanges).not.toHaveBeenCalled();
  });

  it("on a Firestore failure, removes this attempt's uploads and leaves old files alone", async () => {
    const deps = makeDeps({ commitMediaChanges: vi.fn(async () => { throw new Error("offline"); }) });
    const oldHero = stored("weddings/w1/hero/old.webp", 4000);
    const err = await saveStoryMedia({ ...base, savedHero: oldHero, hero: pending(1000), blocks: [], deps }).catch(e => e);
    expect(err.kind).toBe("commit");
    const deleted = deps.deletePhoto.mock.calls.map(c => c[1]);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).not.toBe(oldHero.path);
  });

  it("records uploads it could not clean up so they stay counted", async () => {
    const deps = makeDeps({
      commitMediaChanges: vi.fn(async () => { throw new Error("offline"); }),
      deletePhoto: vi.fn(async () => false),
    });
    await saveStoryMedia({ ...base, hero: pending(1000), blocks: [], deps }).catch(() => {});
    expect(deps.updateMediaBookkeeping).toHaveBeenCalledWith("w1", {
      mediaBytesUsed: 1000,
      mediaPendingDeletes: [expect.objectContaining({ bytes: 1000 })],
    });
  });
});

describe("retryPendingDeletes", () => {
  it("removes deleted files from the queue and leaves failures", async () => {
    const deps = makeDeps({ deletePhoto: vi.fn(async (w, p) => p !== "b") });
    const res = await retryPendingDeletes({ weddingId: "w1", pendingDeletes: [{ path: "a", bytes: 5 }, { path: "b", bytes: 7 }], referencedBytes: 100, deps });
    expect(res).toEqual({ pendingDeletes: [{ path: "b", bytes: 7 }], mediaBytesUsed: 107 });
    expect(deps.updateMediaBookkeeping).toHaveBeenCalledWith("w1", { mediaBytesUsed: 107, mediaPendingDeletes: [{ path: "b", bytes: 7 }] });
  });
  it("does nothing with an empty queue", async () => {
    const deps = makeDeps();
    expect(await retryPendingDeletes({ weddingId: "w1", pendingDeletes: [], referencedBytes: 3, deps })).toEqual({ pendingDeletes: [], mediaBytesUsed: 3 });
    expect(deps.deletePhoto).not.toHaveBeenCalled();
  });
});

describe("saveStoryMedia — photo position/zoom (adjust)", () => {
  it("an adjust-only change updates Firestore without uploading or deleting", async () => {
    const deps = makeDeps();
    const photo = stored("weddings/w1/story/b1/a.webp", 500);
    const block = { ...createStoryBlock("photoLeft"), id: "b1", images: [{ ...photo, adjust: { x: 30, y: 60, zoom: 1.5 } }, null, null] };
    const savedEntry = toEntryData({ ...block, images: [photo, null, null] }, 0);
    await saveStoryMedia({ ...base, hero: null, blocks: [block], savedEntriesById: { b1: savedEntry }, savedMediaBytesUsed: 500, deps });
    expect(deps.uploadPhoto).not.toHaveBeenCalled();
    expect(deps.deletePhoto).not.toHaveBeenCalled();
    const { updates } = deps.commitMediaChanges.mock.calls[0][1];
    expect(updates[0].images[0]).toEqual({ ...photo, adjust: { x: 30, y: 60, zoom: 1.5 } });
  });

  it("an uploaded photo keeps the adjust chosen before saving", async () => {
    const deps = makeDeps();
    const hero = { ...pending(1000), adjust: { x: 10, y: 90, zoom: 2 } };
    const res = await saveStoryMedia({ ...base, hero, blocks: [], deps });
    expect(res.hero.adjust).toEqual({ x: 10, y: 90, zoom: 2 });
    expect(deps.commitMediaChanges.mock.calls[0][2].heroImage.adjust).toEqual({ x: 10, y: 90, zoom: 2 });
  });

  it("a default adjust is not stored, and resetting a saved one removes it", async () => {
    const deps = makeDeps();
    const saved = { ...stored("weddings/w1/hero/h.webp", 100), adjust: { x: 20, y: 20, zoom: 1.2 } };
    const res = await saveStoryMedia({
      ...base, savedHero: saved, savedMediaBytesUsed: 100, blocks: [], deps,
      hero: { ...saved, adjust: { x: 50, y: 50, zoom: 1 } },
    });
    expect(deps.commitMediaChanges.mock.calls[0][2].heroImage).not.toHaveProperty("adjust");
    expect(res.hero).not.toHaveProperty("adjust");
    expect(deps.deletePhoto).not.toHaveBeenCalled();
  });
});
