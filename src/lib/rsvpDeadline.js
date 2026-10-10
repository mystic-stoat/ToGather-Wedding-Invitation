// src/lib/rsvpDeadline.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   The single validation rule for the RSVP deadline (`inviteDeadline` on the
//   invitation doc). Wedding Details and the Invitation Builder's RSVP tab both
//   edit that same field, so they share this check and its messages.
//
// DATA FORMAT:
//   inviteDeadline / weddingDate → "YYYY-MM-DD" (from <input type="date">).
//   Same-format ISO date strings compare correctly as plain strings, so no Date
//   objects are created (avoids UTC date-shifting).
// ─────────────────────────────────────────────────────────────────────────────

export const DEADLINE_REQUIRED_ERROR = "RSVP deadline is required.";
export const DEADLINE_AFTER_WEDDING_ERROR = "RSVP deadline must be on or before the wedding date.";

/**
 * Returns an error message, or "" when the deadline is valid.
 * `required` — Wedding Details always requires a deadline.
 */
export const getInviteDeadlineError = (inviteDeadline, weddingDate, { required = true } = {}) => {
  if (!inviteDeadline) return required ? DEADLINE_REQUIRED_ERROR : "";
  if (weddingDate && inviteDeadline > weddingDate) return DEADLINE_AFTER_WEDDING_ERROR;
  return "";
};
