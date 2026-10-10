// src/lib/venueDisplay.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no React, no Firestore) for the Invitation Builder's Venue tab.
//
//   The venue itself (venueName, venueAddress, venueURL) is owned by Wedding
//   Details — this file only covers how that venue is DISPLAYED on the
//   invitation. Four flat booleans are stored on the invitation doc:
//     venueShowOnInvitation → the whole Wedding Venue section (and the venue
//                             name/address shown elsewhere on the invitation)
//     venueShowMap          → the map inside that section
//     venueShowAddress      → the venue address
//     venueShowDirections   → the "Get directions" button
//
// OLDER INVITATIONS:
//   Before this tab existed every part of the venue section was always shown,
//   so a missing value means ON. Only an explicit `false` hides something.
// ─────────────────────────────────────────────────────────────────────────────

export const VENUE_SETTING_FIELDS = [
  "venueShowOnInvitation",
  "venueShowMap",
  "venueShowAddress",
  "venueShowDirections",
];

/** Every option is ON unless explicitly saved as `false`. */
export const normalizeVenueSettings = (source = {}) => ({
  venueShowOnInvitation: source?.venueShowOnInvitation !== false,
  venueShowMap:          source?.venueShowMap          !== false,
  venueShowAddress:      source?.venueShowAddress      !== false,
  venueShowDirections:   source?.venueShowDirections   !== false,
});

export const DEFAULT_VENUE_SETTINGS = normalizeVenueSettings({});

/**
 * What the invitation should actually render for the venue.
 * Turning the section off hides every venue detail, whatever the other
 * switches say.
 */
export const getVenueDisplay = (settings = {}) => {
  const s = normalizeVenueSettings(settings);
  const section = s.venueShowOnInvitation;
  return {
    section,
    map:        section && s.venueShowMap,
    address:    section && s.venueShowAddress,
    directions: section && s.venueShowDirections,
  };
};
