// src/lib/weddingDate.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no React, no Firestore) for the Invitation Builder's Date tab:
//   the Calendar View and Countdown settings, parsing the wedding date/time that
//   Wedding Details stores, building a month grid, and countdown math.
//
// DATA FORMAT (written by src/pages/WeddingDetails.jsx):
//   weddingDate  → "YYYY-MM-DD"  (from <input type="date">)
//   ceremonyTime → "HH:MM"       (24-hour, from <input type="time">)
//   No time zone is stored.
//
// AVOIDING UTC DATE-SHIFTING:
//   `new Date("2026-06-20")` is parsed as UTC midnight, which shows as June 19
//   anywhere west of Greenwich. This file never passes a date-only string to
//   Date. The calendar works on plain { year, month, day } numbers, and the
//   countdown builds its target with the numeric Date constructor.
//
// TIME ZONE (KNOWN LIMITATION):
//   Wedding Details has no venue time zone yet, so the countdown target is the
//   wedding date + ceremony time in the VIEWER's local time zone (the same
//   assumption the Dashboard and RSVP pages already make). A guest in another
//   time zone sees a countdown that is off by the zone difference.
//   getWeddingStartTime() is the ONLY place that turns the stored date/time into
//   an instant. To add venue time zone support later, store an IANA zone (e.g.
//   "America/Chicago") on the invitation and convert inside that function.
//   Callers already pass the whole invitation, so nothing else has to change.
// ─────────────────────────────────────────────────────────────────────────────

// ── Date tab settings (stored as flat booleans on the invitation doc) ────────
export const DATE_SETTING_FIELDS = ["dateShowCalendar", "dateShowCountdown"];

/** Both options are OFF unless explicitly saved as `true` (older docs have neither). */
export const normalizeDateSettings = (source = {}) => ({
  dateShowCalendar:  source?.dateShowCalendar === true,
  dateShowCountdown: source?.dateShowCountdown === true,
});

export const DEFAULT_DATE_SETTINGS = normalizeDateSettings({});

/** The Wedding Day section appears only when at least one option is on. */
export const shouldShowWeddingDaySection = (settings = {}) => {
  const s = normalizeDateSettings(settings);
  return s.dateShowCalendar || s.dateShowCountdown;
};

// ── Calendar math ─────────────────────────────────────────────────────────────
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export const isLeapYear = (year) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** month is 1–12 */
export const daysInMonth = (year, month) =>
  [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

/** Day of week (0 = Sunday) — Date.UTC + getUTCDay so the local zone can't shift it. */
export const dayOfWeek = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day)).getUTCDay();

/**
 * Week rows for a month, Sunday-first. Cells before day 1 and after the last
 * day are null. Always whole weeks (4–6 rows).
 */
export const buildCalendarMonth = (year, month) => {
  const total = daysInMonth(year, month);
  const cells = Array(dayOfWeek(year, month, 1)).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

// ── Parsing what Wedding Details stores ──────────────────────────────────────
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** "YYYY-MM-DD" → { year, month, day } or null if missing/invalid (e.g. 2025-02-30). */
export const parseWeddingDate = (value) => {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
};

/** "HH:MM" (24-hour) → { hours, minutes } or null if missing/invalid. */
export const parseCeremonyTime = (value) => {
  if (typeof value !== "string") return null;
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]), minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
};

/** "14:30" → "2:30 PM"; anything unparseable is returned unchanged. */
export const formatCeremonyTime = (value) => {
  const t = parseCeremonyTime(value);
  if (!t) return value || "";
  const h12 = t.hours % 12 || 12;
  return `${h12}:${String(t.minutes).padStart(2, "0")} ${t.hours < 12 ? "AM" : "PM"}`;
};

// ── Countdown target (TIME ZONE SEAM — see header) ───────────────────────────
/**
 * The moment the wedding starts, as epoch milliseconds, or null when the date
 * is missing/invalid. Missing/invalid ceremony time → start of the wedding day.
 *
 * Currently interpreted in the viewer's local time zone. Future: read
 * `invitation.timeZone` here and convert from that zone instead.
 */
export const getWeddingStartTime = (invitation = {}) => {
  const date = parseWeddingDate(invitation?.weddingDate);
  if (!date) return null;
  const time = parseCeremonyTime(invitation?.ceremonyTime) || { hours: 0, minutes: 0 };
  const d = new Date(date.year, date.month - 1, date.day, time.hours, time.minutes, 0, 0);
  // Years 0–99 are mapped to 1900–1999 by the Date constructor, so set the year explicitly
  d.setFullYear(date.year);
  return d.getTime();
};

// ── Countdown math ────────────────────────────────────────────────────────────
/**
 * Splits the time left into days/hours/minutes/seconds. Never negative: once
 * `now` reaches `target` everything is 0 and isComplete is true.
 */
export const getCountdownParts = (target, now = Date.now()) => {
  if (typeof target !== "number" || !Number.isFinite(target)) return null;
  const diff = Math.max(0, target - now);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days:    Math.floor(totalSeconds / 86400),
    hours:   Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isComplete: diff <= 0,
  };
};
