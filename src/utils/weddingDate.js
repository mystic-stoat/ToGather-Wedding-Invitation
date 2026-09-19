// src/utils/weddingDate.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Date/time-zone helpers for the Wedding Details summary screen.
//
//   Wedding dates are stored as plain "YYYY-MM-DD" strings (a local calendar
//   date, not a UTC instant). To avoid the classic bug where
//   `new Date("2028-05-28")` gets parsed as UTC midnight and then displays as
//   May 27th in negative-UTC-offset time zones, every function here parses
//   the string manually instead of handing it to the Date constructor.
//
//   The countdown compares CALENDAR DAYS (not exact instants), using the
//   wedding's IANA time zone only to figure out "what calendar date is it
//   there right now". That sidesteps daylight-saving-time edge cases
//   entirely — we never need to compute a precise UTC offset.
// ─────────────────────────────────────────────────────────────────────────────

/** A small set of common US IANA time zones for the Time Zone dropdown. */
export const TIME_ZONE_OPTIONS = [
  { value: "America/New_York",    label: "Eastern Time" },
  { value: "America/Chicago",     label: "Central Time" },
  { value: "America/Denver",      label: "Mountain Time" },
  { value: "America/Phoenix",     label: "Mountain Time (Arizona, no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage",   label: "Alaska Time" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time" },
];

export const DEFAULT_TIME_ZONE = "America/Chicago";

// ── Parse a "YYYY-MM-DD" string into { year, month, day } ────────────────────
// month is 1-indexed here (matches the string), unlike JS Date's 0-indexed month.
const parseIsoDate = (dateStr) => {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m), day: Number(d) };
};

// ── "What is today's calendar date in this time zone?" ───────────────────────
// Uses the en-CA locale because it formats as YYYY-MM-DD, which is easy to
// parse back out without any ambiguity.
const todayInTimeZone = (timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
      year: Number(get("year")),
      month: Number(get("month")),
      day: Number(get("day")),
    };
  } catch {
    // Invalid/unsupported time zone — fall back to the browser's local date
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
};

// ── Format "YYYY-MM-DD" as "May 28, 2028" without any Date-parsing pitfalls ──
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const formatWeddingDate = (dateStr) => {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return null;
  return `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
};

// ── Format "HH:MM" (24h) as "4:30 PM" ─────────────────────────────────────────
export const formatTime = (timeStr) => {
  if (!timeStr) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!match) return timeStr;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
};

/**
 * getWeddingCountdown
 * Computes the countdown between "today" (in the wedding's time zone) and
 * the wedding date, as a whole number of calendar days.
 *
 * Returns one of:
 *   { status: "undecided" }                     — no date set / still deciding
 *   { status: "invalid" }                        — date string couldn't be parsed
 *   { status: "future", days }                   — days > 0 until the wedding
 *   { status: "today" }                           — wedding is today
 *   { status: "past", days }                      — days (positive) since the wedding
 */
export const getWeddingCountdown = (weddingDate, weddingDateUndecided, timeZone = DEFAULT_TIME_ZONE) => {
  if (weddingDateUndecided || !weddingDate) {
    return { status: "undecided" };
  }

  const wedding = parseIsoDate(weddingDate);
  if (!wedding) return { status: "invalid" };

  const today = todayInTimeZone(timeZone);

  // Compare using Date.UTC purely as calendar-day arithmetic (noon avoids any
  // DST-related off-by-one from midnight edge cases in some environments).
  const weddingEpochDay = Date.UTC(wedding.year, wedding.month - 1, wedding.day);
  const todayEpochDay   = Date.UTC(today.year, today.month - 1, today.day);
  const diffDays = Math.round((weddingEpochDay - todayEpochDay) / 86400000);

  if (diffDays > 0) return { status: "future", days: diffDays };
  if (diffDays === 0) return { status: "today" };
  return { status: "past", days: Math.abs(diffDays) };
};

/**
 * getCountdownMessage
 * Turns a getWeddingCountdown() result into the friendly panel text shown
 * on the summary screen, e.g. "Our forever begins in 819 days".
 */
export const getCountdownMessage = (countdown) => {
  switch (countdown.status) {
    case "future":
      return countdown.days === 1
        ? "Our forever begins tomorrow!"
        : `Our forever begins in ${countdown.days} days`;
    case "today":
      return "Today is the day! 🎉";
    case "past":
      return countdown.days === 1
        ? "It's been 1 day since we said \u201cI do\u201d"
        : `It's been ${countdown.days} days since we said \u201cI do\u201d`;
    case "invalid":
      return "We couldn't read this wedding date.";
    default: // "undecided"
      return "Add your wedding date to start the countdown.";
  }
};
