// src/lib/invitationView.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure rules (no React, no Firebase) for WHICH invitation sections show, in
//   the two places the invitation is rendered by <InvitationContent>:
//
//     mode "preview" — the builder's phone preview. Shows a section as soon as
//                      it is switched on, with placeholders ("Groom", "Venue
//                      Name", empty photo slots…) so the couple sees the layout
//                      while they are still filling it in. Unchanged behavior.
//     mode "page"    — the standalone invitation website (owner preview now,
//                      guest website later). Never shows unfinished
//                      placeholders: a section only appears when it has real
//                      content to show.
//
//   Also converts a SAVED invitation document into the same `settings` shape
//   the builder works with (invitationToSettings), so the standalone page
//   renders exactly what the builder would show after loading that document.
//
// ⚠️ Keep invitationToSettings in sync with the load step in
//   src/pages/CreateInvitation.jsx (the setSettings(...) after
//   getInvitationByUser). Both read the same fields with the same defaults.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_THEME_SETTINGS, normalizeThemeSettings } from "@/lib/invitationTheme";
import { normalizeMealOptions } from "@/lib/rsvpOptions";
import { normalizeTravelItems, getTravelShowOnInvitation, shouldShowTravelSection } from "@/lib/travelStay";
import { DEFAULT_STORY_TITLE, blockHasVisibleContent, normalizeStoryEntry, normalizeSavedPhoto } from "@/lib/storyBlocks";
import { DEFAULT_DATE_SETTINGS, normalizeDateSettings, parseWeddingDate, shouldShowWeddingDaySection } from "@/lib/weddingDate";
import { DEFAULT_VENUE_SETTINGS, normalizeVenueSettings, getVenueDisplay } from "@/lib/venueDisplay";
import {
  DEFAULT_PARTY_SETTINGS, normalizePartySettings, normalizePartyMembers, shouldShowPartySection,
} from "@/lib/weddingParty";
import { hasRegistryContent, isRegistrySectionShown } from "@/lib/registry";
import { normalizeQaItems, isQaSectionShown } from "@/lib/qa";
import { photoSrc } from "@/lib/imageProcessing";

export const VIEW_MODES = Object.freeze({ PREVIEW: "preview", PAGE: "page" });

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

// ── Saved invitation → builder settings ──────────────────────────────────────
// Same defaults as the builder's initial `settings` state.
const BUILDER_DEFAULT_SETTINGS = Object.freeze({
  ...DEFAULT_THEME_SETTINGS,
  greetingTitle:          "",
  greetingMessage:        "",
  musicTrackId:           "",
  musicSpotifyUrl:        "",
  musicShowOnInvitation:  true,
  isPublished:            false,
  inviteDeadline:         "",
  closureTitle:           "",
  mealOptions:            [],
  travelItems:            [],
  travelMessage:          "",
  travelShowOnInvitation: true,
  storyTitle:             DEFAULT_STORY_TITLE,
  storyShowOnInvitation:  true,
  ...DEFAULT_DATE_SETTINGS,
  ...DEFAULT_VENUE_SETTINGS,
  ...DEFAULT_PARTY_SETTINGS,
});

/**
 * invitationToSettings
 * A saved invitations/{weddingId} document → the builder's `settings` object.
 * Older documents missing a field get the same default the builder uses.
 * Note: closureTitle is not loaded by the builder either (it has no input),
 * so it stays "" and the invitation shows its default closing line.
 */
export const invitationToSettings = (inv) => {
  const prev = BUILDER_DEFAULT_SETTINGS;
  if (!inv) return { ...prev };
  return {
    ...prev,
    ...normalizeThemeSettings(inv),
    greetingMessage: inv.greetingMessage || prev.greetingMessage,
    greetingTitle:   inv.greetingTitle   || prev.greetingTitle,
    inviteDeadline:  inv.inviteDeadline  || prev.inviteDeadline,
    musicTrackId:          inv.musicTrackId          || prev.musicTrackId,
    musicSpotifyUrl:       inv.musicSpotifyUrl       || prev.musicSpotifyUrl,
    musicShowOnInvitation: inv.musicShowOnInvitation ?? prev.musicShowOnInvitation,
    isPublished:     inv.isPublished     || false,
    mealOptions:     normalizeMealOptions(inv.mealOptions),
    travelItems:            normalizeTravelItems(inv.travelItems),
    travelMessage:          typeof inv.travelMessage === "string" ? inv.travelMessage : "",
    travelShowOnInvitation: getTravelShowOnInvitation(inv),
    storyTitle: typeof inv.storyTitle === "string" && inv.storyTitle.trim()
      ? inv.storyTitle : DEFAULT_STORY_TITLE,
    storyShowOnInvitation: inv.storyShowOnInvitation !== false,
    ...normalizeDateSettings(inv),
    ...normalizeVenueSettings(inv),
    ...normalizePartySettings(inv),
  };
};

/**
 * savedInvitationToView
 * Everything <InvitationContent> needs, built from what is SAVED in Firestore:
 * the invitation document + its storyEntries ([{ docId, data }] from
 * loadAllStoryEntries). Mirrors how the builder loads the same data
 * (useInvitationMedia, useRegistries, useQa), so the standalone page shows
 * exactly what the builder shows right after opening it.
 */
export const savedInvitationToView = (inv, storyEntries = []) => ({
  invitation:      inv || null,
  settings:        invitationToSettings(inv),
  hero:            normalizeSavedPhoto(inv?.heroImage),
  storyBlocks:     (storyEntries || []).map(r => normalizeStoryEntry(r.data, r.docId)),
  partyMembers:    normalizePartyMembers(inv?.partyMembers),
  registries:      Array.isArray(inv?.registries) ? inv.registries : [],
  registryMessage: typeof inv?.registryMessage === "string" ? inv.registryMessage : "",
  registryShown:   isRegistrySectionShown(inv),
  qaItems:         normalizeQaItems(inv?.qaItems),
  qaShown:         isQaSectionShown(inv),
});

// ── Which sections are shown ─────────────────────────────────────────────────

/**
 * getSectionVisibility
 * { [sectionId]: boolean } for every invitation section, plus `heroPhoto`.
 * Header, RSVP and the closing section are always shown.
 *
 *   ctx = { invitation, settings, hero, storyBlocks, partyMembers,
 *           registries, registryMessage, registryShown }
 */
export const getSectionVisibility = (ctx, mode = VIEW_MODES.PREVIEW) => {
  const {
    invitation, settings = {}, hero = null, storyBlocks = [], partyMembers = [],
    registries = [], registryMessage = "", registryShown = true,
  } = ctx;
  const page = mode === VIEW_MODES.PAGE;
  const storyOn = settings.storyShowOnInvitation !== false;
  const hasVenue = hasText(invitation?.venueName) || hasText(invitation?.venueAddress);

  return {
    header:    true,
    // Preview: a placeholder frame until a photo is added. Page: only a real photo.
    heroPhoto: page ? Boolean(photoSrc(hero)) : true,
    // Page: hide the paragraph (and its heading) if the couple never wrote one.
    greetings: page ? hasText(settings.greetingMessage) : true,
    // Page: a Wedding Day section without a valid date would only say "not set yet".
    date:      shouldShowWeddingDaySection(settings) &&
               (!page || parseWeddingDate(invitation?.weddingDate) !== null),
    music:     Boolean(settings.musicTrackId && settings.musicShowOnInvitation),
    // Preview: as soon as a block exists (empty slots are placeholders).
    // Page: only blocks with real content count.
    story:     storyOn && (page ? storyBlocks.some(blockHasVisibleContent) : storyBlocks.length > 0),
    party:     shouldShowPartySection(settings, partyMembers),
    // Page: no "Venue Name" placeholder — needs a real name or address.
    venue:     getVenueDisplay(settings).section && (!page || hasVenue),
    travel:    shouldShowTravelSection(settings),
    rsvp:      true,
    registry:  Boolean(registryShown) && hasRegistryContent(registries, registryMessage),
    closure:   true,
  };
};

/**
 * getInvitationSectionIds
 * The sections a Q&A "link to section" answer may point at — only those that
 * are really on the invitation in this mode (so guests never get a link to a
 * missing section). Preview mode matches the builder's former
 * getPreviewSectionIds exactly.
 */
export const getInvitationSectionIds = (ctx, mode = VIEW_MODES.PREVIEW) => {
  const visible = getSectionVisibility(ctx, mode);
  const ids = new Set(["rsvp"]);
  ["date", "venue", "travel", "story", "party", "registry"].forEach(id => {
    if (visible[id]) ids.add(id);
  });
  return ids;
};
