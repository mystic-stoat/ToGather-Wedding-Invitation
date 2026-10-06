// src/lib/travelStay.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) for the Invitation Builder's
//   Travel & Stay section. The host enters places manually — no Google Places
//   lookup, coordinates or embedded maps.
//
// DATA SHAPE (on the existing invitations/{weddingId} document):
//   travelItems:            [{ id, category, name, mapUrl, description }]
//   travelMessage:          string   — optional intro text for guests
//   travelShowOnInvitation: boolean  — show/hide the section on the invitation
//
//   Older invitations without these fields behave as:
//     travelItems → [], travelMessage → "", travelShowOnInvitation → true
//   (with no places the section never renders, so nothing visibly changes).
// ─────────────────────────────────────────────────────────────────────────────

export const TRAVEL_CATEGORIES = [
  { value: "hotel",      label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "airport",    label: "Airport" },
  { value: "other",      label: "Other" },
];

const CATEGORY_VALUES = TRAVEL_CATEGORIES.map((c) => c.value);

export const TRAVEL_MESSAGE_MAX = 300;

/** Display label for a stored category value (unknown → "Other"). */
export const getTravelCategoryLabel = (value) =>
  TRAVEL_CATEGORIES.find((c) => c.value === value)?.label || "Other";

/**
 * isSafeHttpUrl
 * Only absolute http:// and https:// links are accepted. Rejects
 * `javascript:`, `data:`, relative paths and anything `new URL()` can't parse.
 * (Same rule the Registry page uses for registry links.)
 */
export const isSafeHttpUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** Blank place for the builder's "Add Place" button. */
export const createTravelItem = () => ({
  id: crypto.randomUUID(),
  category: "hotel",
  name: "",
  mapUrl: "",
  description: "",
});

const str = (v) => (typeof v === "string" ? v : "");

/**
 * normalizeTravelItems
 * Turns whatever is stored into a clean array of
 * { id, category, name, mapUrl, description }. Missing / non-array → [].
 * Unknown categories become "other". Non-object entries are dropped.
 */
export const normalizeTravelItems = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item, i) => ({
      id: str(item.id) || `travel-${i}`,
      category: CATEGORY_VALUES.includes(item.category) ? item.category : "other",
      name: str(item.name),
      mapUrl: str(item.mapUrl),
      description: str(item.description),
    }));
};

/** True when the host hasn't typed anything into a place yet. */
const isEmptyItem = (item) =>
  !str(item?.name).trim() && !str(item?.mapUrl).trim() && !str(item?.description).trim();

/**
 * validateTravelItems
 * Returns { [itemId]: { name?, mapUrl? } } for places that can't be saved.
 * Completely empty places are ignored (they're dropped on save).
 *   - Place Name is required once anything else is filled in
 *   - Google Maps Link is optional, but if present must be http(s)
 */
export const validateTravelItems = (items) => {
  const errors = {};
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (isEmptyItem(item)) return;
    const itemErrors = {};
    if (!str(item.name).trim()) itemErrors.name = "Place name is required.";
    const link = str(item.mapUrl).trim();
    if (link && !isSafeHttpUrl(link)) {
      itemErrors.mapUrl = "Enter a valid http:// or https:// link.";
    }
    if (Object.keys(itemErrors).length) errors[item.id] = itemErrors;
  });
  return errors;
};

/**
 * cleanTravelItemsForSave
 * Trims text, drops completely empty places, guarantees an id and a valid
 * category. Call validateTravelItems first — this does not re-check links.
 */
export const cleanTravelItemsForSave = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => !isEmptyItem(item))
    .map((item) => ({
      id: str(item.id) || crypto.randomUUID(),
      category: CATEGORY_VALUES.includes(item.category) ? item.category : "other",
      name: str(item.name).trim(),
      mapUrl: str(item.mapUrl).trim(),
      description: str(item.description).trim(),
    }));

/**
 * getVisibleTravelItems
 * Places that are safe to show to guests: they have a name, and their link is
 * kept only if it is a safe http(s) URL (otherwise mapUrl is "").
 */
export const getVisibleTravelItems = (items) =>
  normalizeTravelItems(items)
    .filter((item) => item.name.trim())
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      description: item.description.trim(),
      mapUrl: isSafeHttpUrl(item.mapUrl) ? item.mapUrl.trim() : "",
    }));

/** Toggle state; missing on older invitations → true. */
export const getTravelShowOnInvitation = (data) => data?.travelShowOnInvitation !== false;

/** Section renders only when the toggle is on AND at least one place has a name. */
export const shouldShowTravelSection = (data) =>
  getTravelShowOnInvitation(data) && getVisibleTravelItems(data?.travelItems).length > 0;
