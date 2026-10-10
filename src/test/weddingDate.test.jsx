// Unit tests for src/lib/weddingDate.js — Date tab settings, parsing the
// Wedding Details date/time, calendar month math and countdown math.
import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_DATE_SETTINGS,
  normalizeDateSettings,
  shouldShowWeddingDaySection,
  isLeapYear,
  daysInMonth,
  dayOfWeek,
  buildCalendarMonth,
  parseWeddingDate,
  parseCeremonyTime,
  formatCeremonyTime,
  getWeddingStartTime,
  getCountdownParts,
} from "@/lib/weddingDate";

describe("Date tab settings", () => {
  it("defaults both options to OFF", () => {
    expect(DEFAULT_DATE_SETTINGS).toEqual({ dateShowCalendar: false, dateShowCountdown: false });
    expect(normalizeDateSettings()).toEqual(DEFAULT_DATE_SETTINGS);
    expect(normalizeDateSettings(null)).toEqual(DEFAULT_DATE_SETTINGS);
  });

  it("treats older invitations without date settings as OFF and ignores unrelated fields", () => {
    expect(normalizeDateSettings({ greetingTitle: "Hi", musicShowOnInvitation: true }))
      .toEqual(DEFAULT_DATE_SETTINGS);
  });

  it("only accepts a real boolean true", () => {
    expect(normalizeDateSettings({ dateShowCalendar: "true", dateShowCountdown: 1 }))
      .toEqual(DEFAULT_DATE_SETTINGS);
    expect(normalizeDateSettings({ dateShowCalendar: true, dateShowCountdown: false }))
      .toEqual({ dateShowCalendar: true, dateShowCountdown: false });
  });

  it.each([
    [false, false, false],
    [true,  false, true],
    [false, true,  true],
    [true,  true,  true],
  ])("calendar=%s countdown=%s → section shown: %s", (cal, cd, shown) => {
    expect(shouldShowWeddingDaySection({ dateShowCalendar: cal, dateShowCountdown: cd })).toBe(shown);
  });
});

describe("leap years and month lengths", () => {
  it.each([[2024, true], [2028, true], [2000, true], [2025, false], [1900, false], [2100, false]])(
    "isLeapYear(%i) = %s", (y, leap) => expect(isLeapYear(y)).toBe(leap));

  it("returns the right number of days, including February in leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("computes weekdays without depending on the local time zone", () => {
    expect(dayOfWeek(2026, 6, 20)).toBe(6); // Saturday
    expect(dayOfWeek(2024, 2, 29)).toBe(4); // Thursday
    expect(dayOfWeek(2026, 1, 1)).toBe(4);  // Thursday
  });
});

describe("buildCalendarMonth", () => {
  const flat = (weeks) => weeks.flat();

  it("fits a 28-day February that starts on Sunday into exactly 4 rows", () => {
    const weeks = buildCalendarMonth(2026, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe(1);
    expect(weeks[3][6]).toBe(28);
  });

  it("uses 6 rows for a 31-day month that starts on Saturday", () => {
    const weeks = buildCalendarMonth(2026, 8); // Aug 1 2026 = Saturday
    expect(weeks).toHaveLength(6);
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]).toBe(1);
    expect(weeks[5][1]).toBe(31);
  });

  it("includes Feb 29 in a leap year and not otherwise", () => {
    expect(flat(buildCalendarMonth(2024, 2))).toContain(29);
    expect(flat(buildCalendarMonth(2025, 2))).not.toContain(29);
    expect(flat(buildCalendarMonth(2100, 2))).not.toContain(29);
  });

  it("is consistent for every month across a leap year and the next year (month/year boundaries)", () => {
    for (const year of [2024, 2025]) {
      for (let month = 1; month <= 12; month++) {
        const weeks = buildCalendarMonth(year, month);
        const cells = flat(weeks);
        expect(weeks.every(w => w.length === 7)).toBe(true);
        expect(cells.indexOf(1)).toBe(dayOfWeek(year, month, 1));
        const days = cells.filter(Boolean);
        expect(days).toEqual(Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1));
        // Trailing blanks are within the last row only
        expect(cells.length - cells.lastIndexOf(days.at(-1)) - 1).toBeLessThan(7);
      }
    }
    // December ends on the 31st; January of the next year starts fresh at 1
    expect(flat(buildCalendarMonth(2025, 12)).filter(Boolean).at(-1)).toBe(31);
    expect(flat(buildCalendarMonth(2026, 1)).filter(Boolean)[0]).toBe(1);
  });
});

describe("parsing Wedding Details values", () => {
  it("parses a valid YYYY-MM-DD date", () => {
    expect(parseWeddingDate("2026-06-20")).toEqual({ year: 2026, month: 6, day: 20 });
    expect(parseWeddingDate(" 2024-02-29 ")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it.each([
    [undefined], [null], [""], ["   "], ["2025-02-29"], ["2026-02-30"], ["2026-13-01"],
    ["2026-00-10"], ["2026-06-00"], ["06/20/2026"], ["2026-6-20"], ["not a date"], [{ seconds: 1 }], [20260620],
  ])("rejects missing or invalid date %j", (value) => {
    expect(parseWeddingDate(value)).toBeNull();
  });

  it("parses and formats the 24-hour ceremony time", () => {
    expect(parseCeremonyTime("14:30")).toEqual({ hours: 14, minutes: 30 });
    expect(parseCeremonyTime("25:00")).toBeNull();
    expect(parseCeremonyTime("")).toBeNull();
    expect(formatCeremonyTime("14:30")).toBe("2:30 PM");
    expect(formatCeremonyTime("00:05")).toBe("12:05 AM");
    expect(formatCeremonyTime("12:00")).toBe("12:00 PM");
    expect(formatCeremonyTime("")).toBe("");
    expect(formatCeremonyTime(undefined)).toBe("");
  });
});

describe("getWeddingStartTime (local-time countdown target)", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTZ; });

  it("returns null when the date is missing or invalid", () => {
    expect(getWeddingStartTime({})).toBeNull();
    expect(getWeddingStartTime(null)).toBeNull();
    expect(getWeddingStartTime({ weddingDate: "2026-02-30", ceremonyTime: "14:00" })).toBeNull();
  });

  it("combines date and ceremony time in local time", () => {
    const t = getWeddingStartTime({ weddingDate: "2026-06-20", ceremonyTime: "14:30" });
    expect(t).toBe(new Date(2026, 5, 20, 14, 30).getTime());
  });

  it("uses the start of the day when the ceremony time is missing or invalid", () => {
    const midnight = new Date(2026, 5, 20, 0, 0).getTime();
    expect(getWeddingStartTime({ weddingDate: "2026-06-20" })).toBe(midnight);
    expect(getWeddingStartTime({ weddingDate: "2026-06-20", ceremonyTime: "99:99" })).toBe(midnight);
  });

  it.each(["America/Los_Angeles", "America/Chicago", "UTC", "Pacific/Auckland", "Asia/Kolkata"])(
    "never shifts the wedding to another day in %s", (tz) => {
      process.env.TZ = tz;
      const d = new Date(getWeddingStartTime({ weddingDate: "2026-06-20", ceremonyTime: "00:00" }));
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 6, 20, 0]);
      const late = new Date(getWeddingStartTime({ weddingDate: "2026-12-31", ceremonyTime: "23:59" }));
      expect([late.getFullYear(), late.getMonth() + 1, late.getDate()]).toEqual([2026, 12, 31]);
    });
});

describe("getCountdownParts", () => {
  const target = new Date(2026, 5, 20, 14, 30).getTime();

  it("splits the remaining time into days, hours, minutes and seconds", () => {
    const now = target - ((1 * 86400 + 2 * 3600 + 3 * 60 + 4) * 1000);
    expect(getCountdownParts(target, now)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4, isComplete: false });
  });

  it("is complete (all zeros) exactly at the wedding time", () => {
    expect(getCountdownParts(target, target)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true });
  });

  it("never returns negative values after the wedding", () => {
    const parts = getCountdownParts(target, target + 5 * 86400 * 1000);
    expect(parts.isComplete).toBe(true);
    expect([parts.days, parts.hours, parts.minutes, parts.seconds].every(v => v === 0)).toBe(true);
  });

  it("is not complete with less than a second left", () => {
    expect(getCountdownParts(target, target - 500).isComplete).toBe(false);
  });

  it("returns null for an invalid target", () => {
    expect(getCountdownParts(null)).toBeNull();
    expect(getCountdownParts(NaN)).toBeNull();
  });
});
