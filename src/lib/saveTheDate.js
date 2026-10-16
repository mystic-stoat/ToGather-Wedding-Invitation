// src/lib/saveTheDate.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no React, no Firestore) that turn a saved invitation into a
//   "Save the Date" calendar event in the two forms guests' apps accept:
//     - a prefilled Google Calendar template URL (opens in the browser; the
//       guest confirms inside their own Google account — no OAuth needed)
//     - an .ics file (RFC 5545) that imports into Apple Calendar, Outlook,
//       and any other iCalendar client
//
//   Nothing here adds the event automatically — the guest always confirms it
//   in their own calendar app.
//
// ALL-DAY BY DESIGN:
//   invitations/{weddingId} stores weddingDate ("YYYY-MM-DD") and ceremonyTime
//   ("HH:MM") but NO venue time zone, and a guest's device zone is not the
//   venue's. So every event is an all-day event (DTSTART;VALUE=DATE with an
//   exclusive next-day DTEND — the correct iCalendar convention), and the
//   ceremony time travels in the description, clearly labeled as local venue
//   time. If a valid IANA zone is ever stored (e.g. invitation.timeZone),
//   a timed event could be added here later — it would still need an honest
//   end time, so it is intentionally not fabricated now.
//
// PRIVACY:
//   Only public invitation fields are used (names, date, time, venues).
//   RSVP tokens, guest records, inviteeIds, emails and auth data must never
//   reach the generated link or file.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MONTH_NAMES,
  parseWeddingDate,
  parseCeremonyTime,
  formatCeremonyTime,
} from "@/lib/weddingDate";

// ── Event building ────────────────────────────────────────────────────────────

const firstName = (partner) => partner?.first?.trim() || "";

/** "Alex" + "Sam" → "Wedding of Alex & Sam"; partial/empty names degrade safely. */
export const eventTitle = (invitation = {}) => {
  const names = [firstName(invitation.groomName), firstName(invitation.brideName)]
    .filter(Boolean)
    .join(" & ");
  return names ? `Wedding of ${names}` : "Wedding";
};

/** "Rose Hall" + "1 Garden Way, Dallas" → "Rose Hall, 1 Garden Way, Dallas". */
const joinParts = (...parts) => parts.map(p => p?.trim()).filter(Boolean).join(", ");

/**
 * The description shown inside the calendar event. Public wedding info only.
 * Ceremony time is explicitly labeled as the venue's local time because the
 * event itself is all-day (see header note).
 */
const buildDescription = (invitation = {}, title) => {
  const lines = [`Save the date for ${title}!`];
  const ceremony = formatCeremonyTime(invitation.ceremonyTime);
  if (parseCeremonyTime(invitation.ceremonyTime)) {
    lines.push(`Ceremony begins at ${ceremony} (local venue time).`);
  }
  const venue = joinParts(invitation.venueName, invitation.venueAddress);
  if (venue) lines.push(`Ceremony venue: ${venue}`);
  const reception = joinParts(invitation.receptionName, invitation.receptionAddress);
  if (reception) lines.push(`Reception: ${reception}`);
  if (invitation.venueURL?.trim()) lines.push(`Map: ${invitation.venueURL.trim()}`);
  lines.push("Shared via ToGather.");
  return lines.join("\n");
};

/**
 * The calendar event, or null when the invitation has no valid wedding date —
 * callers disable/hide the action instead of creating a placeholder event.
 */
export const buildCalendarEvent = (invitation = {}) => {
  const date = parseWeddingDate(invitation?.weddingDate);
  if (!date) return null;
  return {
    title:       eventTitle(invitation),
    description: buildDescription(invitation, eventTitle(invitation)),
    location:    joinParts(invitation.venueName, invitation.venueAddress),
    date, // { year, month, day } — all-day
    uid: `${invitation.weddingId || "wedding"}-save-the-date@togather`,
  };
};

// ── iCalendar (.ics) ──────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

/** { year, month, day } → "20260620" */
export const icsDate = ({ year, month, day }) =>
  `${year}${pad(month)}${pad(day)}`;

/** The day AFTER { year, month, day } — UTC math handles month/year/leap edges. */
export const nextDay = ({ year, month, day }) => {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

/** RFC 5545 text escaping: backslash first, then ; , and newlines. */
export const icsEscape = (value = "") =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Fold a content line to <=75 octets (RFC 5545 §3.1): long lines are split
 * and continued on the next line prefixed with a single space. Splitting is
 * UTF-8 safe — a multi-byte character is never divided between lines.
 */
const foldLine = (line) => {
  const LIMIT = 75;
  if (new TextEncoder().encode(line).length <= LIMIT) return line;
  const out = [];
  let current = "";
  let currentLen = 0;
  // First line may use all 75 octets; continuations reserve 1 for the space.
  let limit = LIMIT;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (currentLen + len > limit) {
      out.push(current);
      current = "";
      currentLen = 0;
      limit = LIMIT - 1; // continuation lines start with a space
    }
    current += ch;
    currentLen += len;
  }
  out.push(current);
  return out.join("\r\n ");
};

/** Date → "20261016T214530Z" (DTSTAMP is UTC by definition). */
const icsTimestamp = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
  `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/**
 * A complete, standards-compliant VCALENDAR document for the event.
 * CRLF line endings throughout; DTEND is the exclusive next-day date.
 */
export const icsContent = (event, { dtstamp = new Date() } = {}) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ToGather//Save the Date//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsTimestamp(dtstamp)}`,
    `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
    // Exclusive end: an all-day event on June 20 ends at June 21 00:00.
    `DTEND;VALUE=DATE:${icsDate(nextDay(event.date))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
};

/** "save-the-date-20260620.ics" */
export const icsFilename = (event) => `save-the-date-${icsDate(event.date)}.ics`;

// ── Google Calendar template link ─────────────────────────────────────────────

/**
 * Prefilled Google Calendar "render" URL. Opens the event for review inside
 * the guest's Google account — the event is only saved if they confirm there.
 */
export const googleCalendarUrl = (event) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    // All-day Google events use the same exclusive end-date convention.
    dates: `${icsDate(event.date)}/${icsDate(nextDay(event.date))}`,
    details: event.description,
    ...(event.location ? { location: event.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// ── Download helper (browser only) ───────────────────────────────────────────

/**
 * Triggers an .ics download. Safe to call from click handlers; no-ops
 * silently outside a browser (SSR/tests that don't stub URL.createObjectURL).
 */
export const downloadIcs = (event) => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([icsContent(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFilename(event);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
