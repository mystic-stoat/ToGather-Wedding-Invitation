// src/lib/emailVerification.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Decides whether a signed-in user must verify their email before entering
//   the app.
//
// WHY A CREATION-DATE CUTOFF:
//   ToGather already has live accounts whose Firebase `emailVerified` flag is
//   false — those users signed up before verification existed and must keep
//   working. Firebase Auth exposes `metadata.creationTime`, which is written
//   server-side and can't be edited by the client, so it's a safe signal:
//   accounts created on/after the rollout date must verify; older ones are
//   grandfathered. (A Firestore flag was rejected — betrothed docs are
//   user-writable under firestore.rules.)
//
// NOTE: route guards using this are a UX boundary, not a security boundary.
// Firebase Auth sessions remain valid regardless; hard enforcement would need
// `request.auth.token.email_verified` in Firestore rules, which can't
// distinguish legacy accounts. See the feature notes.
// ─────────────────────────────────────────────────────────────────────────────

// Accounts created at or after this instant must verify their email.
// Set to the feature's ship date — every pre-existing account is legacy.
export const EMAIL_VERIFICATION_REQUIRED_AFTER = Date.parse("2026-10-16T00:00:00Z");

// Seconds the verify-email page disables its Resend button after each send.
// Firebase also rate-limits sends (auth/too-many-requests); the page surfaces
// that separately.
export const VERIFICATION_RESEND_COOLDOWN = 60;

/**
 * verificationActionCodeSettings
 * The `url` Firebase embeds in the verification link — it must be an absolute
 * http(s) URI or the SDK throws auth/invalid-continue-uri before sending.
 * Test DOMs (jsdom) run at an opaque origin where location.origin is "null",
 * so the setting is omitted there; browsers always produce a valid origin.
 */
export const verificationActionCodeSettings = (
  origin = typeof window !== "undefined" ? window.location?.origin : null
) =>
  /^https?:\/\//.test(origin ?? "") ? { url: `${origin}/verify-email` } : undefined;

/**
 * requiresEmailVerification
 * @param {object|null} user — a Firebase User (or null)
 * @returns {boolean} true when this signed-in user must verify their email
 *          before reaching protected screens.
 */
export const requiresEmailVerification = (user) => {
  if (!user || user.emailVerified) return false;
  const created = Date.parse(user?.metadata?.creationTime ?? "");
  return Number.isFinite(created) && created >= EMAIL_VERIFICATION_REQUIRED_AFTER;
};
