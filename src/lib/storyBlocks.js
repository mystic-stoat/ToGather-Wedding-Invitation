// src/lib/storyBlocks.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) for the "Our Story" block editor:
//   the six layouts, creating/normalizing blocks, layout switching, reordering,
//   figuring out which photos are referenced, and diffing what to save.
//   Kept pure so it is easy to unit test (see src/test/storyBlocks.test.jsx).
//
// LOCAL BLOCK SHAPE (in the builder):
//   { id, layout, title, description, images: [slot, slot, slot] }
//   - `images` ALWAYS has 3 slots locally. The layout decides how many are
//     visible. Hidden slots keep their photo until Save, so switching back to
//     a bigger layout restores them. On Save, hidden slots are dropped.
//   - Title/description are ALWAYS kept, even in photo-only layouts (they are
//     just not displayed there), so switching layouts never loses text.
//
// FIRESTORE SHAPE: invitations/{weddingId}/storyEntries/{id}
//   { id, layout, title, description, images: [savedPhoto|null...], order,
//     createdAt, updatedAt }   — `images` length = the layout's slot count.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_STORY_TITLE = "Our Story";
export const STORY_TITLE_SUGGESTIONS = ["Our Story", "Our Journey", "Our Memories", "How We Met"];
export const STORY_SECTION_TITLE_MAX = 60;
export const STORY_BLOCK_TITLE_MAX = 100;
export const STORY_BLOCK_DESCRIPTION_MAX = 1000;
export const MAX_SLOTS = 3;

/**
 * The six layouts. `slots` = number of photos, `showsText` = whether the
 * title/description are displayed.
 */
export const STORY_LAYOUTS = [
  { id: "photoLeft",  label: "Photo Left + Text Right", short: "Photo left",  slots: 1, showsText: true },
  { id: "photoRight", label: "Text Left + Photo Right", short: "Photo right", slots: 1, showsText: true },
  { id: "twoPhotos",  label: "Two Photos Side by Side", short: "Two photos",  slots: 2, showsText: false },
  { id: "fullWidth",  label: "Full-Width Photo",        short: "Full width",  slots: 1, showsText: false },
  { id: "textOnly",   label: "Text Only",               short: "Text only",   slots: 0, showsText: true },
  { id: "collage",    label: "Three-Photo Collage",     short: "Collage",     slots: 3, showsText: false },
];

export const STORY_LAYOUT_IDS = STORY_LAYOUTS.map(l => l.id);
export const DEFAULT_LAYOUT = "photoLeft";

export const getLayout = (layoutId) =>
  STORY_LAYOUTS.find(l => l.id === layoutId) || STORY_LAYOUTS[0];

export const getSlotCount = (layoutId) => getLayout(layoutId).slots;
export const layoutShowsText = (layoutId) => getLayout(layoutId).showsText;

const newId = () => crypto.randomUUID();

/** A brand-new, empty block. */
export const createStoryBlock = (layout = DEFAULT_LAYOUT) => ({
  id: newId(),
  layout: STORY_LAYOUT_IDS.includes(layout) ? layout : DEFAULT_LAYOUT,
  title: "",
  description: "",
  images: [null, null, null],
});

const isSavedPhoto = (p) =>
  p && typeof p === "object" && typeof p.path === "string" && typeof p.url === "string";

const cleanSavedPhoto = (p) => ({
  path: p.path,
  url: p.url,
  width: Number.isFinite(p.width) ? Math.round(p.width) : 0,
  height: Number.isFinite(p.height) ? Math.round(p.height) : 0,
  bytes: Number.isFinite(p.bytes) ? Math.round(p.bytes) : 0,
  contentType: typeof p.contentType === "string" ? p.contentType : "image/jpeg",
});

/** Normalize a saved photo (e.g. heroImage from Firestore) or return null. */
export const normalizeSavedPhoto = (p) => (isSavedPhoto(p) ? cleanSavedPhoto(p) : null);

/**
 * normalizeStoryEntry
 * Firestore doc data → local block. Tolerates missing/garbage fields.
 */
export const normalizeStoryEntry = (data, docId) => {
  const layout = STORY_LAYOUT_IDS.includes(data?.layout) ? data.layout : DEFAULT_LAYOUT;
  const raw = Array.isArray(data?.images) ? data.images : [];
  const images = [0, 1, 2].map(i => normalizeSavedPhoto(raw[i]));
  return {
    id: typeof data?.id === "string" && data.id ? data.id : docId,
    layout,
    title: typeof data?.title === "string" ? data.title : "",
    description: typeof data?.description === "string" ? data.description : "",
    images,
  };
};

/** Photos shown by the current layout (may contain nulls for empty slots). */
export const getVisibleSlots = (block) => block.images.slice(0, getSlotCount(block.layout));

/** Number of filled photo slots that the given layout would hide. */
export const countPhotosHiddenBy = (block, layoutId) =>
  block.images.slice(getSlotCount(layoutId)).filter(Boolean).length;

/** Whether the block has text that the given layout would hide. */
export const hasTextHiddenBy = (block, layoutId) =>
  !layoutShowsText(layoutId) && Boolean(block.title.trim() || block.description.trim());

/**
 * changeBlockLayout
 * Switches layout without deleting anything (photos in now-hidden slots and
 * text stay in memory until Save). Returns a new block.
 */
export const changeBlockLayout = (block, layoutId) =>
  STORY_LAYOUT_IDS.includes(layoutId) ? { ...block, layout: layoutId } : block;

/** A block with no photos (visible) and no text at all is dropped on Save. */
export const isBlockEmpty = (block) =>
  !getVisibleSlots(block).some(Boolean) && !block.title.trim() && !block.description.trim();

/** Whether a block would display anything in the invitation. */
export const blockHasVisibleContent = (block) =>
  getVisibleSlots(block).some(Boolean) ||
  (layoutShowsText(block.layout) && Boolean(block.title.trim() || block.description.trim()));

// ── Reordering ────────────────────────────────────────────────────────────────

/** Move the item at `from` to `to`. Returns a new array (or the same one if invalid). */
export const moveItem = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const moveBlockById = (blocks, id, delta) => {
  const from = blocks.findIndex(b => b.id === id);
  return from === -1 ? blocks : moveItem(blocks, from, from + delta);
};

// ── Saving ────────────────────────────────────────────────────────────────────

/** Section-level visibility: toggle on AND at least one block shows something. */
export const shouldShowStorySection = (settings, blocks) =>
  settings?.storyShowOnInvitation !== false && (blocks || []).some(blockHasVisibleContent);

export const normalizeStoryTitle = (title) => {
  const t = typeof title === "string" ? title.trim() : "";
  return (t || DEFAULT_STORY_TITLE).slice(0, STORY_SECTION_TITLE_MAX);
};

/**
 * toEntryData
 * Local block (whose visible photos are all already uploaded) → the fields we
 * write to Firestore (without timestamps). Hidden slots are dropped here.
 */
export const toEntryData = (block, order) => ({
  id: block.id,
  layout: block.layout,
  title: block.title.trim().slice(0, STORY_BLOCK_TITLE_MAX),
  description: block.description.trim().slice(0, STORY_BLOCK_DESCRIPTION_MAX),
  images: getVisibleSlots(block).map(p => (p ? cleanSavedPhoto(p) : null)),
  order,
});

const sameEntry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * diffStoryEntries
 * savedById: { [id]: entryData as last saved (incl. order) }
 * nextEntries: entryData[] in display order
 * → { creates: entryData[], updates: entryData[], deletes: id[] }
 * Only blocks that actually changed are written.
 */
export const diffStoryEntries = (savedById, nextEntries) => {
  const creates = [];
  const updates = [];
  const nextIds = new Set();
  for (const entry of nextEntries) {
    nextIds.add(entry.id);
    const prev = savedById[entry.id];
    if (!prev) creates.push(entry);
    else if (!sameEntry(prev, entry)) updates.push(entry);
  }
  const deletes = Object.keys(savedById).filter(id => !nextIds.has(id));
  return { creates, updates, deletes };
};

/** Every stored photo referenced by a hero photo + list of entryData. */
export const collectReferencedPhotos = (heroPhoto, entries) => {
  const out = [];
  if (heroPhoto?.path) out.push({ path: heroPhoto.path, bytes: heroPhoto.bytes || 0 });
  for (const e of entries) {
    for (const p of e.images || []) if (p?.path) out.push({ path: p.path, bytes: p.bytes || 0 });
  }
  return out;
};

export const sumBytes = (items) => items.reduce((n, i) => n + (Number(i?.bytes) || 0), 0);

/** Normalize the mediaPendingDeletes array from Firestore. */
export const normalizePendingDeletes = (list) =>
  Array.isArray(list)
    ? list
        .filter(i => i && typeof i.path === "string" && i.path)
        .map(i => ({ path: i.path, bytes: Number.isFinite(i.bytes) ? Math.round(i.bytes) : 0 }))
    : [];

/**
 * estimateMediaBytes
 * Bytes the wedding WOULD use if saved now (used for the quota meter and the
 * pre-upload quota check): hero + visible photos of non-empty blocks
 * (pending ones counted by their compressed size) + files still waiting to be
 * deleted that are no longer referenced.
 */
export const estimateMediaBytes = (hero, blocks, pendingDeletes = []) => {
  let total = hero ? hero.bytes || 0 : 0;
  for (const b of blocks) {
    if (isBlockEmpty(b)) continue;
    for (const p of getVisibleSlots(b)) if (p) total += p.bytes || 0;
  }
  return total + sumBytes(pendingDeletes);
};
