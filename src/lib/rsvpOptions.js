// src/lib/rsvpOptions.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) for meal options, plus-one records and
//   the wedding/guest children policy. Every page that reads these fields goes
//   through here so older Firestore documents that are missing the newer fields
//   get the same safe defaults everywhere.
//
// DATA SHAPES:
//   invitations/{weddingId}
//     mealOptions:    [{ id, name, description }]       — [] / missing = no meals
//     childrenPolicy: "allowed" | "adults_only"         — missing = "allowed"
//
//   invitee/{inviteeId}
//     childrenPolicyOverride: "inherit" | "allowed" | "adults_only"
//                                                       — missing = "inherit"
//     mealId, meal:   main guest's meal (id + name snapshot), "" when none
//     dietaryRestrictions: main guest's dietary restrictions / allergies
//     plusOnes: [{ name, mealId, meal, dietaryRestrictions }]
//       older records may only have { name, meal: "chicken" } — still valid
// ─────────────────────────────────────────────────────────────────────────────

// ── Children policy ──────────────────────────────────────────────────────────

export const CHILDREN_POLICY = {
  ALLOWED: "allowed",
  ADULTS_ONLY: "adults_only",
};

export const CHILDREN_OVERRIDE = {
  INHERIT: "inherit",
  ALLOWED: "allowed",
  ADULTS_ONLY: "adults_only",
};

export const CHILDREN_POLICY_LABELS = {
  allowed: "Kids Allowed",
  adults_only: "Adults Only",
};

/** Wedding-level policy. Missing or unknown values fall back to "allowed". */
export const getWeddingChildrenPolicy = (invitation) =>
  invitation?.childrenPolicy === CHILDREN_POLICY.ADULTS_ONLY
    ? CHILDREN_POLICY.ADULTS_ONLY
    : CHILDREN_POLICY.ALLOWED;

/** Guest-level override. Missing or unknown values fall back to "inherit". */
export const getGuestChildrenOverride = (invitee) => {
  const value = invitee?.childrenPolicyOverride;
  return value === CHILDREN_OVERRIDE.ALLOWED || value === CHILDREN_OVERRIDE.ADULTS_ONLY
    ? value
    : CHILDREN_OVERRIDE.INHERIT;
};

/**
 * getEffectiveChildrenPolicy
 *   guest override "allowed" / "adults_only" → that value
 *   guest override "inherit" or missing      → wedding.childrenPolicy
 *   wedding.childrenPolicy also missing      → "allowed"
 */
export const getEffectiveChildrenPolicy = (invitation, invitee) => {
  const override = getGuestChildrenOverride(invitee);
  return override === CHILDREN_OVERRIDE.INHERIT
    ? getWeddingChildrenPolicy(invitation)
    : override;
};

// ── Meal options ─────────────────────────────────────────────────────────────

/** Creates a blank meal option for the builder. */
export const createMealOption = () => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
});

/**
 * normalizeMealOptions
 * Returns a clean array of { id, name, description } from whatever is stored.
 * Accepts plain strings defensively (treated as name, with the name as id).
 * Entries without a usable name are dropped.
 */
export const normalizeMealOptions = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt) => {
      if (typeof opt === "string") {
        const name = opt.trim();
        return name ? { id: name, name, description: "" } : null;
      }
      if (!opt || typeof opt !== "object") return null;
      const name = typeof opt.name === "string" ? opt.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof opt.id === "string" && opt.id ? opt.id : name,
        name,
        description: typeof opt.description === "string" ? opt.description.trim() : "",
      };
    })
    .filter(Boolean);
};

/**
 * cleanMealOptionsForSave
 * Used by the builder right before saving: trims text, drops rows with an
 * empty name, and guarantees every row has an id.
 */
export const cleanMealOptionsForSave = (options) =>
  (Array.isArray(options) ? options : [])
    .map((opt) => ({
      id: opt?.id || crypto.randomUUID(),
      name: (opt?.name || "").trim(),
      description: (opt?.description || "").trim(),
    }))
    .filter((opt) => opt.name);

// ── Meal display ─────────────────────────────────────────────────────────────

/**
 * getMealLabel
 * Display name for a guest or plus-one meal.
 *   1. stored `meal` name snapshot (also covers old values like "chicken")
 *   2. lookup by `mealId` in the current options
 *   3. "" when nothing is recorded
 */
export const getMealLabel = (entity, mealOptions = []) => {
  const stored = typeof entity?.meal === "string" ? entity.meal.trim() : "";
  if (stored) return stored;
  if (entity?.mealId) {
    const match = normalizeMealOptions(mealOptions).find((m) => m.id === entity.mealId);
    if (match) return match.name;
  }
  return "";
};

// ── Plus-ones ────────────────────────────────────────────────────────────────

/** Normalizes one stored plus-one, filling in fields older records lack. */
export const normalizePlusOne = (p) => ({
  name: typeof p?.name === "string" ? p.name : "",
  mealId: typeof p?.mealId === "string" ? p.mealId : "",
  meal: typeof p?.meal === "string" ? p.meal : "",
  dietaryRestrictions: typeof p?.dietaryRestrictions === "string" ? p.dietaryRestrictions : "",
});

/** Normalizes the stored plusOnes array (missing / non-array → []). */
export const normalizePlusOnes = (raw) =>
  Array.isArray(raw) ? raw.map(normalizePlusOne) : [];

// ── Headcount ────────────────────────────────────────────────────────────────

/**
 * getAttendanceStats
 * Separates invitation records from actual people attending.
 *   invitations       — number of invitee docs (one per invited guest/party)
 *   acceptedPlusOnes  — plus-ones actually submitted on ACCEPTED RSVPs
 *                       (plusOneLimit, the maximum allowed, is never counted)
 *   attending         — accepted primary guests + their submitted plus-ones
 */
export const getAttendanceStats = (guests = []) => {
  const list = Array.isArray(guests) ? guests : [];
  const acceptedGuests = list.filter((g) => g?.rsvpStatus === "Accepted");
  const acceptedPlusOnes = acceptedGuests.reduce(
    (sum, g) => sum + normalizePlusOnes(g.plusOnes).length,
    0
  );
  return {
    invitations: list.length,
    acceptedPlusOnes,
    attending: acceptedGuests.length + acceptedPlusOnes,
  };
};
