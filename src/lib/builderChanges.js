// src/lib/builderChanges.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no React, no Firebase) that answer one question for the
//   Invitation Builder: "Would clicking Save write anything different from
//   what is saved right now?" — i.e. does the couple have UNSAVED CHANGES?
//
//   Used by the View Invitation button (Phase 3): with unsaved changes it asks
//   Save and View / View Last Saved / Cancel; without, it opens the preview.
//
//   Both checks apply the SAME clean-up Save applies before writing (empty
//   meals/places/members/blocks dropped, text trimmed, theme normalized…), so
//   e.g. adding a blank meal row is not an unsaved change — Save would drop it.
//
// ⚠️ Keep in sync with:
//   - handleSave in src/pages/CreateInvitation.jsx  (settingsSaveSnapshot)
//   - saveStoryMedia in src/lib/storySave.js         (hasUnsavedMediaChanges)
// ─────────────────────────────────────────────────────────────────────────────

import { cleanMealOptionsForSave } from "@/lib/rsvpOptions";
import { cleanTravelItemsForSave, getTravelShowOnInvitation } from "@/lib/travelStay";
import { normalizeThemeSettings } from "@/lib/invitationTheme";
import {
  normalizeStoryTitle, normalizeSavedPhoto, isBlockEmpty, getVisibleSlots, getSlotCount,
  toEntryData, diffStoryEntries,
} from "@/lib/storyBlocks";
import { normalizeDateSettings } from "@/lib/weddingDate";
import { normalizeVenueSettings } from "@/lib/venueDisplay";
import {
  normalizePartySettings, cleanPartyMembersForSave, toStoredPartyMember,
} from "@/lib/weddingParty";

/** JSON with sorted object keys, so key order never causes a false "changed". */
export const stableStringify = (value) => JSON.stringify(value, (_key, v) =>
  (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    : v));

// Fields in `settings` that the builder's Save never writes from `settings`.
// isPublished: the builder never changes it (Phase 3 — see handleSave).
const NOT_SAVED_FROM_SETTINGS = ["isPublished"];

/**
 * settingsSaveSnapshot
 * A comparable string of what handleSave would write from `settings`.
 * Two settings objects with the same snapshot save the same data.
 */
export const settingsSaveSnapshot = (settings = {}) => {
  const data = {
    ...settings,
    mealOptions: cleanMealOptionsForSave(settings.mealOptions),
    travelItems: cleanTravelItemsForSave(settings.travelItems),
    travelMessage: (settings.travelMessage || "").trim(),
    travelShowOnInvitation: getTravelShowOnInvitation(settings),
    ...normalizeThemeSettings(settings),
    storyTitle: normalizeStoryTitle(settings.storyTitle),
    storyShowOnInvitation: settings.storyShowOnInvitation !== false,
    ...normalizeDateSettings(settings),
    ...normalizeVenueSettings(settings),
    ...normalizePartySettings(settings),
  };
  NOT_SAVED_FROM_SETTINGS.forEach(field => delete data[field]);
  return stableStringify(data);
};

const isPending = (photo) => Boolean(photo?.pending);
const asSaved = (photo) => (photo ? normalizeSavedPhoto(photo) : null);

/**
 * hasUnsavedMediaChanges
 * true when Save would upload a photo or change the Hero Photo, Our Story
 * entries or Wedding Party members — mirroring saveStoryMedia's own checks.
 *
 *   storyReady   Our Story finished loading (until then Save can't save
 *                photos/Story either, so only the hero/party are compared)
 *   partyLoaded  the invitation's members were read (else Save skips them)
 */
export const hasUnsavedMediaChanges = ({
  hero = null, savedHero = null,
  blocks = [], savedEntriesById = {}, storyReady = true,
  partyMembers = [], savedPartyMembers = [], partyLoaded = true,
}) => {
  // Hero Photo — a new photo waiting to upload, or a removed / repositioned one
  if (isPending(hero)) return true;
  if (stableStringify(savedHero || null) !== stableStringify(asSaved(hero))) return true;

  // Our Story — same blocks, order and visible photos as Save would write
  if (storyReady) {
    const kept = blocks.filter(b => !isBlockEmpty(b));
    if (kept.some(b => getVisibleSlots(b).some(isPending))) return true;
    const entries = kept.map((b, i) => {
      const count = getSlotCount(b.layout);
      const images = [0, 1, 2].map(n => (n < count ? asSaved(b.images[n]) : null));
      return toEntryData({ ...b, images }, i);
    });
    const { creates, updates, deletes } = diffStoryEntries(savedEntriesById, entries);
    if (creates.length || updates.length || deletes.length) return true;
  }

  // Wedding Party — blank members are dropped on save
  if (partyLoaded) {
    const kept = cleanPartyMembersForSave(partyMembers);
    if (kept.some(m => isPending(m.photo))) return true;
    const stored = kept.map(m => toStoredPartyMember(m, asSaved(m.photo)));
    if (stableStringify(savedPartyMembers) !== stableStringify(stored)) return true;
  }

  return false;
};
