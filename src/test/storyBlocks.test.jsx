// Unit tests for the pure Our Story helpers (no Firebase, no React).
import { describe, it, expect } from "vitest";
import {
  STORY_LAYOUTS, createStoryBlock, normalizeStoryEntry, changeBlockLayout,
  countPhotosHiddenBy, hasTextHiddenBy, getVisibleSlots, isBlockEmpty,
  blockHasVisibleContent, moveItem, moveBlockById, toEntryData, diffStoryEntries,
  collectReferencedPhotos, estimateMediaBytes, shouldShowStorySection,
  normalizeStoryTitle, normalizePendingDeletes, normalizeSavedPhoto, DEFAULT_STORY_TITLE,
} from "@/lib/storyBlocks";

const saved = (n, bytes = 1000) => ({
  path: `weddings/w1/story/b/${n}.webp`, url: `https://x/${n}`, width: 800, height: 1000, bytes, contentType: "image/webp",
});
const pending = (n, bytes = 500) => ({
  pending: true, localId: `l${n}`, blob: {}, previewUrl: `blob:${n}`, width: 10, height: 10, bytes, contentType: "image/webp", fileName: `${n}.jpg`,
});

describe("layouts", () => {
  it("defines exactly the six required layouts with the right photo counts", () => {
    expect(STORY_LAYOUTS.map(l => [l.id, l.slots, l.showsText])).toEqual([
      ["photoLeft", 1, true], ["photoRight", 1, true], ["twoPhotos", 2, false],
      ["fullWidth", 1, false], ["textOnly", 0, true], ["collage", 3, false],
    ]);
  });

  it("creates an empty block with three slots and the default layout", () => {
    const b = createStoryBlock();
    expect(b.layout).toBe("photoLeft");
    expect(b.images).toEqual([null, null, null]);
    expect(b.id).toMatch(/[0-9a-f-]{36}/);
    expect(createStoryBlock("nope").layout).toBe("photoLeft");
  });
});

describe("normalizeStoryEntry", () => {
  it("pads images to three slots and tolerates junk", () => {
    const b = normalizeStoryEntry({ layout: "collage", title: 5, images: [saved(1), "junk"] }, "doc1");
    expect(b.id).toBe("doc1");
    expect(b.layout).toBe("collage");
    expect(b.title).toBe("");
    expect(b.images[0].path).toContain("1.webp");
    expect(b.images.slice(1)).toEqual([null, null]);
    expect(normalizeStoryEntry({ layout: "weird" }, "d").layout).toBe("photoLeft");
  });

  it("normalizeSavedPhoto rejects incomplete objects", () => {
    expect(normalizeSavedPhoto({ path: "a" })).toBeNull();
    expect(normalizeSavedPhoto(saved(1))).toMatchObject({ path: saved(1).path });
  });
});

describe("switching layouts preserves content", () => {
  const block = { ...createStoryBlock("collage"), title: "We met", description: "In Denton", images: [saved(1), saved(2), saved(3)] };

  it("keeps every photo and the text in memory", () => {
    const next = changeBlockLayout(block, "photoLeft");
    expect(next.layout).toBe("photoLeft");
    expect(next.images).toEqual(block.images);
    expect(next.title).toBe("We met");
    expect(getVisibleSlots(next)).toHaveLength(1);
    // switching back restores all three
    expect(getVisibleSlots(changeBlockLayout(next, "collage")).filter(Boolean)).toHaveLength(3);
  });

  it("counts photos and text a layout would hide", () => {
    expect(countPhotosHiddenBy(block, "photoLeft")).toBe(2);
    expect(countPhotosHiddenBy(block, "twoPhotos")).toBe(1);
    expect(countPhotosHiddenBy(block, "textOnly")).toBe(3);
    expect(countPhotosHiddenBy(block, "collage")).toBe(0);
    expect(hasTextHiddenBy(block, "fullWidth")).toBe(true);
    expect(hasTextHiddenBy(block, "photoRight")).toBe(false);
  });

  it("ignores unknown layout ids", () => {
    expect(changeBlockLayout(block, "bogus")).toBe(block);
  });
});

describe("empty / visible content", () => {
  it("treats a block with nothing as empty", () => {
    expect(isBlockEmpty(createStoryBlock())).toBe(true);
  });
  it("a photo-only layout with only hidden text is not empty (text is preserved) but shows nothing", () => {
    const b = { ...createStoryBlock("fullWidth"), title: "Kept" };
    expect(isBlockEmpty(b)).toBe(false);
    expect(blockHasVisibleContent(b)).toBe(false);
  });
  it("text-only and photo-only blocks are valid", () => {
    expect(blockHasVisibleContent({ ...createStoryBlock("textOnly"), description: "Hi" })).toBe(true);
    expect(blockHasVisibleContent({ ...createStoryBlock("fullWidth"), images: [saved(1), null, null] })).toBe(true);
  });
});

describe("reordering", () => {
  const list = ["a", "b", "c", "d"];
  it("moves items and ignores out-of-range moves", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 3, 4)).toBe(list);
  });
  it("moves blocks up/down by id", () => {
    const blocks = [{ id: "1" }, { id: "2" }, { id: "3" }];
    expect(moveBlockById(blocks, "2", -1).map(b => b.id)).toEqual(["2", "1", "3"]);
    expect(moveBlockById(blocks, "3", 1)).toBe(blocks);
    expect(moveBlockById(blocks, "1", -1)).toBe(blocks);
  });
});

describe("saving helpers", () => {
  it("toEntryData trims text and drops hidden slots", () => {
    const b = { ...createStoryBlock("photoLeft"), id: "b1", title: "  Hi  ", description: " x ", images: [saved(1), saved(2), null] };
    const e = toEntryData(b, 4);
    expect(e).toMatchObject({ id: "b1", layout: "photoLeft", title: "Hi", description: "x", order: 4 });
    expect(e.images).toHaveLength(1);
    expect(toEntryData({ ...b, layout: "textOnly" }, 0).images).toEqual([]);
  });

  it("diffStoryEntries only writes what changed", () => {
    const a = { id: "a", layout: "textOnly", title: "A", description: "", images: [], order: 0 };
    const b = { id: "b", layout: "textOnly", title: "B", description: "", images: [], order: 1 };
    const savedById = { a, b };
    expect(diffStoryEntries(savedById, [a, b])).toEqual({ creates: [], updates: [], deletes: [] });

    const c = { ...a, id: "c" };
    const d = diffStoryEntries(savedById, [{ ...b, order: 0 }, { ...c, order: 1 }]);
    expect(d.creates.map(e => e.id)).toEqual(["c"]);
    expect(d.updates.map(e => e.id)).toEqual(["b"]); // order changed
    expect(d.deletes).toEqual(["a"]);
  });

  it("collects referenced photos and estimates usage incl. pending photos and the delete queue", () => {
    const hero = saved("h", 2000);
    const entries = [{ images: [saved(1, 100), null] }, { images: [] }];
    expect(collectReferencedPhotos(hero, entries).map(r => r.bytes)).toEqual([2000, 100]);

    const blocks = [
      { ...createStoryBlock("photoLeft"), images: [pending(1, 300), saved(9, 999), null] }, // slot 2 hidden
      createStoryBlock("collage"), // empty → ignored
    ];
    expect(estimateMediaBytes(hero, blocks, [{ path: "old", bytes: 50 }])).toBe(2000 + 300 + 50);
  });

  it("normalizes titles, pending deletes and section visibility", () => {
    expect(normalizeStoryTitle("   ")).toBe(DEFAULT_STORY_TITLE);
    expect(normalizeStoryTitle(" How We Met ")).toBe("How We Met");
    expect(normalizePendingDeletes([{ path: "p", bytes: 3 }, { bytes: 1 }, null])).toEqual([{ path: "p", bytes: 3 }]);
    expect(normalizePendingDeletes(undefined)).toEqual([]);

    const text = { ...createStoryBlock("textOnly"), title: "Hi" };
    expect(shouldShowStorySection({ storyShowOnInvitation: true }, [text])).toBe(true);
    expect(shouldShowStorySection({ storyShowOnInvitation: false }, [text])).toBe(false);
    expect(shouldShowStorySection({}, [createStoryBlock()])).toBe(false);
  });
});
