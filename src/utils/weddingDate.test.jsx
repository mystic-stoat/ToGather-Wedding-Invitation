import { describe, it, expect } from 'vitest';
import {
  formatWeddingDate,
  formatTime,
  getWeddingCountdown,
  getCountdownMessage,
} from './weddingDate.js';

describe('formatWeddingDate', () => {
  it('formats an ISO date string without shifting the calendar day', () => {
    // Regression guard: new Date("2028-05-28") is parsed as UTC midnight and
    // can print as May 27th in negative-UTC-offset time zones. Our formatter
    // must not do that — it parses the string manually instead.
    expect(formatWeddingDate('2028-05-28')).toBe('May 28, 2028');
    expect(formatWeddingDate('2025-01-01')).toBe('January 1, 2025');
  });

  it('returns null for missing/invalid input', () => {
    expect(formatWeddingDate('')).toBeNull();
    expect(formatWeddingDate(null)).toBeNull();
    expect(formatWeddingDate('not-a-date')).toBeNull();
  });
});

describe('formatTime', () => {
  it('formats 24h "HH:MM" as 12h with AM/PM', () => {
    expect(formatTime('16:30')).toBe('4:30 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('09:05')).toBe('9:05 AM');
  });

  it('returns null for missing input', () => {
    expect(formatTime('')).toBeNull();
    expect(formatTime(null)).toBeNull();
  });
});

describe('getWeddingCountdown', () => {
  it('reports "undecided" when the date is undecided', () => {
    expect(getWeddingCountdown('2028-05-28', true, 'America/Chicago'))
      .toEqual({ status: 'undecided' });
  });

  it('reports "undecided" when there is no date at all', () => {
    expect(getWeddingCountdown('', false, 'America/Chicago'))
      .toEqual({ status: 'undecided' });
    expect(getWeddingCountdown(undefined, false, 'America/Chicago'))
      .toEqual({ status: 'undecided' });
  });

  it('reports "invalid" for an unparseable date string', () => {
    expect(getWeddingCountdown('not-a-date', false, 'America/Chicago'))
      .toEqual({ status: 'invalid' });
  });

  it('reports "future" with a positive day count for a date far ahead', () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 5);
    const dateStr = farFuture.toISOString().slice(0, 10);

    const result = getWeddingCountdown(dateStr, false, 'America/Chicago');
    expect(result.status).toBe('future');
    expect(result.days).toBeGreaterThan(0);
  });

  it('reports "today" when the wedding date is today (in the given time zone)', () => {
    // Use the same "what day is it in this time zone" logic the util uses,
    // by asking Intl directly for today's date in en-CA (YYYY-MM-DD) format.
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const result = getWeddingCountdown(todayStr, false, 'America/Chicago');
    expect(result.status).toBe('today');
  });

  it('reports "past" with a positive day count for a date long ago', () => {
    const pastYear = new Date().getFullYear() - 5;
    const result = getWeddingCountdown(`${pastYear}-01-01`, false, 'America/Chicago');
    expect(result.status).toBe('past');
    expect(result.days).toBeGreaterThan(0);
  });
});

describe('getCountdownMessage', () => {
  it('produces the expected copy for each status', () => {
    expect(getCountdownMessage({ status: 'undecided' }))
      .toMatch(/add your wedding date/i);
    expect(getCountdownMessage({ status: 'invalid' }))
      .toMatch(/couldn't read/i);
    expect(getCountdownMessage({ status: 'today' }))
      .toMatch(/today is the day/i);
    expect(getCountdownMessage({ status: 'future', days: 819 }))
      .toBe('Our forever begins in 819 days');
    expect(getCountdownMessage({ status: 'future', days: 1 }))
      .toMatch(/tomorrow/i);
    expect(getCountdownMessage({ status: 'past', days: 3 }))
      .toMatch(/3 days since/i);
  });
});
