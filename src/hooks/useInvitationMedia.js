// src/hooks/useInvitationMedia.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   Holds the Invitation Builder's Hero Photo + Our Story + Wedding Party
//   members state and wires it to Firebase, so CreateInvitation.jsx stays
//   readable:
//     - loads Story entries progressively (page by page)
//     - tracks saved vs. local state so Save only writes what changed
//     - runs the photo Save pipeline (src/lib/storySave.js) with progress
//     - retries deleting leftover files from earlier saves
//     - frees photo previews and warns before leaving with unsaved photos
//
//   This state is kept OUT of the page's `settings` on purpose: handleSave
//   spreads `settings` into the invitation document, while photos, story
//   blocks and wedding party members have their own pipeline.
//   Wedding Party members are read from the invitation document itself
//   (invitations/{id}.partyMembers); their private contact details are handled
//   by src/hooks/useWeddingPartyContacts.js.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import {
  normalizeStoryEntry, normalizeSavedPhoto, normalizePendingDeletes, toEntryData,
  collectReferencedPhotos, sumBytes, estimateMediaBytes,
} from "@/lib/storyBlocks";
import { releasePhoto, releaseIfReplaced } from "@/lib/imageProcessing";
import { loadAllStoryEntries } from "@/lib/storyStore";
import { saveStoryMedia, retryPendingDeletes, MediaSaveError } from "@/lib/storySave";
import {
  normalizePartyMembers, toStoredPartyMember, collectPartyPhotos, partyPhotoBytes,
} from "@/lib/weddingParty";

/** Stored members as the save pipeline compares them. */
const toSavedParty = (members) => members.map(m => toStoredPartyMember(m));

export const useInvitationMedia = ({ saving = false } = {}) => {
  const [hero, setHero]                         = useState(null); // local: saved | pending | null
  const [savedHero, setSavedHero]               = useState(null); // as stored in Firestore
  const [storyBlocks, setStoryBlocks]           = useState([]);   // local blocks, display order
  const [savedEntriesById, setSavedEntriesById] = useState({});   // { id: entryData } as stored
  const [storyStatus, setStoryStatus]           = useState("loading"); // loading | ready | error
  const [storyLoadedCount, setStoryLoadedCount] = useState(0);
  const [pendingDeletes, setPendingDeletes]     = useState([]);   // invitation.mediaPendingDeletes
  const [savedMediaBytesUsed, setSavedMediaBytesUsed] = useState(0);
  const [uploadProgress, setUploadProgress]     = useState(null); // { percent, done, total, byKey }
  const [partyMembers, setPartyMembers]         = useState([]);   // local members, display order
  const [savedPartyMembers, setSavedPartyMembers] = useState([]); // as stored (toStoredPartyMember shape)
  const [partyLoaded, setPartyLoaded]           = useState(false); // invitation read OK (or none yet)
  const weddingIdRef = useRef(null);

  // ── Load Story entries (progressively, page by page) ──────────────────────
  // Also retries deleting files left over from an earlier save.
  const loadStory = async (wid, pending = [], heroForBytes = null, partyForBytes = []) => {
    weddingIdRef.current = wid || null;
    if (!wid) {
      setStoryBlocks([]);
      setSavedEntriesById({});
      setStoryStatus("ready");
      return;
    }
    setStoryStatus("loading");
    setStoryLoadedCount(0);
    try {
      const raw = await loadAllStoryEntries(wid, {
        onPage: soFar => {
          setStoryLoadedCount(soFar.length);
          setStoryBlocks(soFar.map(r => normalizeStoryEntry(r.data, r.docId)));
        },
      });
      const blocks = raw.map(r => normalizeStoryEntry(r.data, r.docId));
      // Remember what is stored (incl. its stored order) so Save only writes changes.
      const saved = Object.fromEntries(blocks.map((b, i) => [
        b.id, toEntryData(b, Number.isInteger(raw[i].data?.order) ? raw[i].data.order : -1),
      ]));
      setStoryBlocks(blocks);
      setSavedEntriesById(saved);
      setStoryStatus("ready");

      if (pending.length) {
        const referencedBytes = sumBytes(collectReferencedPhotos(heroForBytes, Object.values(saved)))
          + sumBytes(collectPartyPhotos(partyForBytes));
        const after = await retryPendingDeletes({ weddingId: wid, pendingDeletes: pending, referencedBytes });
        setPendingDeletes(after.pendingDeletes);
        if (after.pendingDeletes.length !== pending.length) setSavedMediaBytesUsed(after.mediaBytesUsed);
      }
    } catch (err) {
      console.error("Load story error:", err);
      setStoryStatus("error");
    }
  };

  /** Call once the invitation doc has been read (or with null if there is none). */
  const initFromInvitation = (inv) => {
    if (!inv) {
      setPartyLoaded(true);
      loadStory(null);
      return;
    }
    const heroPhoto = normalizeSavedPhoto(inv.heroImage);
    const pending = normalizePendingDeletes(inv.mediaPendingDeletes);
    // Older invitations have no partyMembers → [] (the section stays hidden)
    const party = normalizePartyMembers(inv.partyMembers);
    const savedParty = toSavedParty(party);
    setHero(heroPhoto);
    setSavedHero(heroPhoto);
    setPartyMembers(party);
    setSavedPartyMembers(savedParty);
    setPartyLoaded(true);
    setPendingDeletes(pending);
    setSavedMediaBytesUsed(Number.isFinite(inv.mediaBytesUsed) ? inv.mediaBytesUsed : 0);
    loadStory(inv.weddingId, pending, heroPhoto, savedParty); // not awaited — loads progressively
  };

  const markLoadFailed = () => setStoryStatus("error");
  const retryLoad = () => loadStory(weddingIdRef.current, pendingDeletes, savedHero, savedPartyMembers);

  /**
   * Hero Photo picked / removed / repositioned. Frees the old preview only if
   * the photo was really replaced (not when just its position/zoom changed).
   */
  const setHeroPhoto = (photo) => {
    releaseIfReplaced(hero, photo);
    setHero(photo);
  };

  // Free photo previews (object URLs) of unsaved photos when leaving the page.
  const mediaRef = useRef({ hero: null, blocks: [], party: [] });
  mediaRef.current = { hero, blocks: storyBlocks, party: partyMembers };
  useEffect(() => () => {
    releasePhoto(mediaRef.current.hero);
    mediaRef.current.blocks.forEach(b => b.images.forEach(releasePhoto));
    mediaRef.current.party.forEach(m => releasePhoto(m.photo));
  }, []);

  // Warn before leaving with photos that haven't been uploaded yet (or mid-save).
  const hasUnsavedPhotos = Boolean(hero?.pending) || storyBlocks.some(b => b.images.some(p => p?.pending)) ||
    partyMembers.some(m => m.photo?.pending);
  useEffect(() => {
    if (!hasUnsavedPhotos && !saving) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedPhotos, saving]);

  /**
   * save — photos + Story, run AFTER the invitation fields are saved.
   * Resolves { ok: true, partyMembers } or { ok: false, notice: { kind, text } }.
   * `partyMembers` = the local members after a successful save (blank ones
   * dropped, photos uploaded), so the caller can save private contacts.
   * On failure every local edit is kept so the couple can click Save again.
   */
  const save = async (wid) => {
    weddingIdRef.current = wid;
    if (storyStatus !== "ready") {
      const heroDirty = JSON.stringify(hero || null) !== JSON.stringify(savedHero || null);
      const partyDirty = partyLoaded &&
        JSON.stringify(toSavedParty(partyMembers)) !== JSON.stringify(savedPartyMembers);
      if (storyStatus === "loading") {
        return { ok: false, notice: { kind: "warning", text: "Your other changes were saved. Your story is still loading — click Save again in a moment to save photos and Story changes." } };
      }
      if (partyDirty) {
        return { ok: false, notice: { kind: "warning", text: "Your other changes were saved, but photos, Story and Wedding Party changes weren't because your story couldn't be loaded. Open the Story tab and choose Try again." } };
      }
      if (heroDirty) {
        return { ok: false, notice: { kind: "warning", text: "Your other changes were saved, but photos and Story changes weren't because your story couldn't be loaded. Open the Story tab and choose Try again." } };
      }
      // Nothing photo-related changed; private contact edits can still be saved.
      return { ok: true, partyMembers: partyLoaded ? partyMembers : null };
    }
    try {
      const res = await saveStoryMedia({
        weddingId: wid,
        hero,
        savedHero,
        blocks: storyBlocks,
        savedEntriesById,
        pendingDeletes,
        savedMediaBytesUsed,
        // null = the invitation never loaded, so stored members are left alone
        partyMembers: partyLoaded ? partyMembers : null,
        savedPartyMembers,
        onProgress: setUploadProgress,
      });
      // Every pending photo was either uploaded or intentionally dropped.
      releasePhoto(hero);
      storyBlocks.forEach(b => b.images.forEach(releasePhoto));
      partyMembers.forEach(m => releasePhoto(m.photo));
      setHero(res.hero);
      setSavedHero(res.hero);
      setStoryBlocks(res.blocks);
      setSavedEntriesById(res.savedEntriesById);
      // Keep each member's local-only fields (private phone/email) and take
      // the saved photo; blank members were dropped by the save.
      let nextParty = null;
      if (partyLoaded) {
        const byId = Object.fromEntries(partyMembers.map(m => [m.id, m]));
        nextParty = res.partyMembers.map(stored => ({
          ...(byId[stored.id] || normalizePartyMembers([stored])[0]),
          name: stored.name,
          customRole: stored.customRole,
          description: stored.description,
          photo: stored.photo,
          sideAuto: false,
        }));
        setPartyMembers(nextParty);
      }
      setSavedPartyMembers(res.partyMembers);
      setPendingDeletes(res.pendingDeletes);
      setSavedMediaBytesUsed(res.mediaBytesUsed);
      return { ok: true, partyMembers: nextParty };
    } catch (err) {
      console.error("Media save error:", err);
      const text = err instanceof MediaSaveError ? err.message : "Your photos couldn't be saved. Please try again.";
      return { ok: false, notice: { kind: "error", text: `Your other changes were saved. ${text}` } };
    } finally {
      setUploadProgress(null);
    }
  };

  return {
    hero, setHeroPhoto,
    storyBlocks, setStoryBlocks,
    storyStatus, storyLoadedCount,
    partyMembers, setPartyMembers, partyLoaded,
    uploadProgress,
    mediaBytes: estimateMediaBytes(hero, storyBlocks, pendingDeletes) + partyPhotoBytes(partyMembers),
    initFromInvitation, markLoadFailed, retryLoad, save,
  };
};

export default useInvitationMedia;
