// src/lib/storySave.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Runs the "Save" pipeline for photos (Hero Photo + Our Story):
//
//     1. Plan      — drop empty blocks and photos hidden by a layout change.
//     2. Quota     — refuse BEFORE uploading if the wedding would go over the
//                    per-wedding quota (sizes are known: photos were already
//                    compressed when they were picked).
//     3. Upload    — upload new photos (2 at a time) with progress.
//                    If any upload fails, the photos uploaded in this attempt
//                    are deleted again and NOTHING is written to Firestore.
//     4. Commit    — one atomic Firestore batch: Story entries + heroImage +
//                    mediaBytesUsed + mediaPendingDeletes. On failure, this
//                    attempt's uploads are deleted again.
//     5. Clean up  — only now delete replaced/removed files. Files that fail
//                    to delete stay in mediaPendingDeletes (and keep counting
//                    toward mediaBytesUsed) and are retried later.
//
//   mediaBytesUsed is RECOMPUTED from scratch on every save:
//     referenced photos (hero + story) + files waiting in mediaPendingDeletes
//   so it never drifts with +/- arithmetic. See docs/STORY_AND_MEDIA.md.
//
//   All Firebase calls go through `deps` so tests can inject fakes.
// ─────────────────────────────────────────────────────────────────────────────

import { WEDDING_MEDIA_QUOTA_BYTES, formatBytes } from "@/lib/mediaConfig";
import {
  isBlockEmpty, getVisibleSlots, getSlotCount, toEntryData, diffStoryEntries,
  collectReferencedPhotos, sumBytes, estimateMediaBytes, normalizeSavedPhoto,
} from "@/lib/storyBlocks";
import { uploadPhoto, deletePhoto, buildHeroPath, buildStoryPath } from "@/lib/mediaStorage";
import { commitMediaChanges, updateMediaBookkeeping } from "@/lib/storyStore";

export const defaultDeps = {
  uploadPhoto, deletePhoto, buildHeroPath, buildStoryPath,
  commitMediaChanges, updateMediaBookkeeping,
};

export class MediaSaveError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "MediaSaveError";
    this.kind = kind; // "quota" | "upload" | "commit"
  }
}

const UPLOAD_CONCURRENCY = 2;

/** Dedupe [{path, bytes}] by path, keeping the first. */
const uniqueByPath = (items) => {
  const seen = new Set();
  return items.filter(i => (seen.has(i.path) ? false : (seen.add(i.path), true)));
};

/**
 * retryPendingDeletes
 * Tries to delete every file in `pendingDeletes`. Files that are gone are
 * removed from the queue; the bookkeeping fields are rewritten only if
 * something changed. Never throws.
 * Resolves to { pendingDeletes, mediaBytesUsed } as stored afterwards.
 */
export const retryPendingDeletes = async ({ weddingId, pendingDeletes, referencedBytes, deps = defaultDeps }) => {
  const before = { pendingDeletes, mediaBytesUsed: referencedBytes + sumBytes(pendingDeletes) };
  if (!pendingDeletes.length) return before;

  const remaining = [];
  for (const item of pendingDeletes) {
    const ok = await deps.deletePhoto(weddingId, item.path);
    if (!ok) remaining.push(item);
  }
  if (remaining.length === pendingDeletes.length) return before;

  const after = { pendingDeletes: remaining, mediaBytesUsed: referencedBytes + sumBytes(remaining) };
  try {
    await deps.updateMediaBookkeeping(weddingId, {
      mediaBytesUsed: after.mediaBytesUsed,
      mediaPendingDeletes: after.pendingDeletes,
    });
    return after;
  } catch (err) {
    // The files are gone but Firestore still lists them. The next save
    // recomputes both fields from scratch, and deleting a missing file
    // counts as success, so this heals itself.
    console.error("Could not update media bookkeeping:", err);
    return before;
  }
};

/** Run async jobs with limited concurrency; stop starting new ones after the first failure. */
const runJobs = async (jobs, worker) => {
  let next = 0;
  let firstError = null;
  const lane = async () => {
    while (!firstError && next < jobs.length) {
      const job = jobs[next++];
      try {
        await worker(job);
      } catch (err) {
        if (!firstError) firstError = { err, job };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, jobs.length) }, lane));
  return firstError;
};

/**
 * saveStoryMedia
 * @param {object} p
 *   weddingId, hero (local slot), savedHero (as stored), blocks (local),
 *   savedEntriesById ({ id: entryData }), pendingDeletes ([{path,bytes}]),
 *   savedMediaBytesUsed (number as stored), onProgress(fn), deps
 * @returns {Promise<{ hero, blocks, savedEntriesById, mediaBytesUsed, pendingDeletes, wrote }>}
 * @throws MediaSaveError — local state is untouched; nothing new is referenced.
 */
export const saveStoryMedia = async ({
  weddingId,
  hero,
  savedHero,
  blocks,
  savedEntriesById,
  pendingDeletes = [],
  savedMediaBytesUsed = 0,
  quotaBytes = WEDDING_MEDIA_QUOTA_BYTES,
  onProgress = () => {},
  deps = defaultDeps,
}) => {
  // ── 1. Plan ───────────────────────────────────────────────────────────────
  const keptBlocks = blocks.filter(b => !isBlockEmpty(b));
  const jobs = [];
  if (hero?.pending) {
    jobs.push({ key: hero.localId, photo: hero, path: deps.buildHeroPath(weddingId, hero.contentType) });
  }
  for (const b of keptBlocks) {
    for (const p of getVisibleSlots(b)) {
      if (p?.pending) {
        jobs.push({ key: p.localId, photo: p, path: deps.buildStoryPath(weddingId, b.id, p.contentType) });
      }
    }
  }

  // ── 2. Quota (before any upload) ────────────────────────────────────────────
  const projected = estimateMediaBytes(hero, keptBlocks, pendingDeletes);
  if (projected > quotaBytes) {
    throw new MediaSaveError(
      `These photos would use ${formatBytes(projected)}, which is over your ${formatBytes(quotaBytes)} photo limit. ` +
      "Remove or replace some photos, then save again.",
      "quota"
    );
  }

  // ── 3. Upload ─────────────────────────────────────────────────────────────
  const uploaded = new Map(); // localId → saved photo
  const percentByKey = Object.fromEntries(jobs.map(j => [j.key, 0]));
  const totalBytes = sumBytes(jobs.map(j => j.photo)) || 1;
  const report = (currentName) => {
    const sent = jobs.reduce((n, j) => n + (j.photo.bytes * percentByKey[j.key]) / 100, 0);
    onProgress({
      total: jobs.length,
      done: uploaded.size,
      percent: jobs.length ? Math.round((sent / totalBytes) * 100) : 100,
      byKey: { ...percentByKey },
      currentName,
    });
  };

  // Deletes files uploaded during THIS attempt (they are not referenced anywhere).
  const discardThisAttempt = async () => {
    const leftovers = [];
    for (const saved of uploaded.values()) {
      const ok = await deps.deletePhoto(weddingId, saved.path);
      if (!ok) leftovers.push({ path: saved.path, bytes: saved.bytes });
    }
    if (leftovers.length) {
      // Track what we couldn't delete so it is counted and retried later.
      const queue = uniqueByPath([...pendingDeletes, ...leftovers]);
      const referenced = sumBytes(collectReferencedPhotos(savedHero, Object.values(savedEntriesById)));
      try {
        await deps.updateMediaBookkeeping(weddingId, {
          mediaBytesUsed: referenced + sumBytes(queue),
          mediaPendingDeletes: queue,
        });
      } catch (err) {
        console.error("Could not record leftover uploads:", err);
      }
    }
  };

  if (jobs.length) {
    report(jobs[0].photo.fileName);
    const failure = await runJobs(jobs, async (job) => {
      const saved = await deps.uploadPhoto(job.path, job.photo, (pct) => {
        percentByKey[job.key] = pct;
        report(job.photo.fileName);
      });
      uploaded.set(job.key, saved);
      percentByKey[job.key] = 100;
      report(job.photo.fileName);
    });
    if (failure) {
      console.error("Photo upload failed:", failure.err);
      await discardThisAttempt();
      throw new MediaSaveError(
        `"${failure.job.photo.fileName}" couldn't be uploaded. Check your connection and click Save to try again — your changes are still here.`,
        "upload"
      );
    }
  }

  // ── 4. Build the final state and commit ─────────────────────────────────────
  // Every photo is written in its clean stored shape. An uploaded photo keeps
  // the position/zoom (`adjust`) chosen before Save; a default adjust is omitted.
  const asSaved = (p) => {
    if (!p) return null;
    return normalizeSavedPhoto(p.pending ? { ...uploaded.get(p.localId), adjust: p.adjust } : p);
  };
  const finalHero = hero ? asSaved(hero) : null;
  const finalBlocks = keptBlocks.map(b => {
    const count = getSlotCount(b.layout);
    return {
      ...b,
      images: [0, 1, 2].map(i => {
        if (i >= count) return null; // hidden photos are dropped on save (user was warned)
        return asSaved(b.images[i]);
      }),
    };
  });
  const entries = finalBlocks.map((b, i) => toEntryData(b, i));
  const changes = diffStoryEntries(savedEntriesById, entries);

  const referenced = collectReferencedPhotos(finalHero, entries);
  const referencedPaths = new Set(referenced.map(r => r.path));
  const previouslyReferenced = collectReferencedPhotos(savedHero, Object.values(savedEntriesById));
  const dropped = previouslyReferenced.filter(p => !referencedPaths.has(p.path));
  const queue = uniqueByPath([...pendingDeletes, ...dropped]).filter(p => !referencedPaths.has(p.path));
  const referencedBytes = sumBytes(referenced);
  const mediaBytesUsed = referencedBytes + sumBytes(queue);

  const heroChanged = JSON.stringify(savedHero || null) !== JSON.stringify(finalHero || null);
  const anyEntryChange = changes.creates.length + changes.updates.length + changes.deletes.length > 0;
  const mustWrite = anyEntryChange || heroChanged || dropped.length > 0 || mediaBytesUsed !== savedMediaBytesUsed;

  if (mustWrite) {
    try {
      await deps.commitMediaChanges(weddingId, changes, {
        heroImage: finalHero || null,
        mediaBytesUsed,
        mediaPendingDeletes: queue,
      });
    } catch (err) {
      console.error("Saving Story/Hero failed:", err);
      await discardThisAttempt();
      throw new MediaSaveError(
        "Your photos couldn't be saved. Check your connection and click Save to try again — your changes are still here.",
        "commit"
      );
    }
  }

  // ── 5. Delete replaced/removed files (only after a successful commit) ──────
  const after = await retryPendingDeletes({ weddingId, pendingDeletes: queue, referencedBytes, deps });

  return {
    hero: finalHero || null,
    blocks: finalBlocks,
    savedEntriesById: Object.fromEntries(entries.map(e => [e.id, e])),
    mediaBytesUsed: after.mediaBytesUsed,
    pendingDeletes: after.pendingDeletes,
    wrote: mustWrite,
  };
};
