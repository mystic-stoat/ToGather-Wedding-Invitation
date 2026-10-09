// src/components/invitation/WeddingDaySection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   The invitation's "Wedding Day" section: an optional month calendar with the
//   wedding day highlighted, an optional live countdown, the date/time line and
//   the existing "Add to calendar" button (not wired up yet; ICS comes later).
//
//   The parent decides whether to render this at all (only when Calendar View
//   and/or Countdown is on — see shouldShowWeddingDaySection). The wedding date
//   and ceremony time come from Wedding Details (`invitation`); colors and fonts
//   come from the resolved Color Theme (`theme`).
//
//   Date math lives in src/lib/weddingDate.js. The countdown target comes only
//   from getWeddingStartTime(), which is where venue time zone support goes.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  buildCalendarMonth,
  formatCeremonyTime,
  getCountdownParts,
  getWeddingStartTime,
  normalizeDateSettings,
  parseCeremonyTime,
  parseWeddingDate,
} from "@/lib/weddingDate";

// Re-renders every second until the target passes, then stops ticking.
export const useCountdown = (target, enabled = true) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || target == null) return undefined;
    setNow(Date.now());
    if (Date.now() >= target) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target, enabled]);

  return target == null ? null : getCountdownParts(target, now);
};

const CalendarView = ({ date, theme }) => {
  const weeks = buildCalendarMonth(date.year, date.month);
  const monthLabel = `${MONTH_NAMES[date.month - 1]} ${date.year}`;
  return (
    <div className="mb-4" data-testid="wedding-calendar">
      <p className="text-[11px] mb-2" style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
        {monthLabel}
      </p>
      <table className="w-full text-[9px] border-collapse" aria-label={`${monthLabel} calendar`}>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((d, i) => (
              <th key={i} className="font-bold py-0.5" style={{ color: theme.bodyText }} scope="col">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                const isWedding = day === date.day;
                return (
                  <td key={di} className="py-0.5 text-center">
                    {day && (
                      <span
                        className="inline-flex w-5 h-5 items-center justify-center rounded-full"
                        data-wedding-day={isWedding ? "true" : undefined}
                        aria-label={isWedding ? `Wedding day, ${MONTH_NAMES[date.month - 1]} ${day}` : undefined}
                        style={isWedding
                          ? { backgroundColor: theme.button, color: theme.buttonLabel, fontWeight: 700 }
                          : { color: theme.bodyText }}>
                        {day}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const COUNTDOWN_UNITS = [
  { key: "days",    label: "Days" },
  { key: "hours",   label: "Hours" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

const Countdown = ({ target, theme, hasTime }) => {
  const parts = useCountdown(target);
  if (!parts) return null;

  if (parts.isComplete) {
    return (
      <div className="mb-4" data-testid="wedding-countdown" data-complete="true">
        <p className="text-sm" style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
          Just married! 🎉
        </p>
        <p className="text-[9px] mt-1" style={{ color: theme.bodyText }}>
          Thank you for celebrating with us.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4" data-testid="wedding-countdown" role="timer" aria-live="off">
      <div className="grid grid-cols-4 gap-1.5">
        {COUNTDOWN_UNITS.map(u => (
          <div key={u.key} className="rounded-lg py-1.5" style={{ border: `1px solid ${theme.accent}` }}>
            <p className="text-sm leading-none" data-testid={`countdown-${u.key}`}
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              {parts[u.key]}
            </p>
            <p className="text-[7px] uppercase tracking-widest mt-1" style={{ color: theme.bodyText }}>
              {u.label}
            </p>
          </div>
        ))}
      </div>
      {!hasTime && (
        <p className="text-[8px] mt-1.5" style={{ color: theme.bodyText }}>
          Counting down to the start of the day.
        </p>
      )}
    </div>
  );
};

const WeddingDaySection = ({ invitation, settings, theme, backgroundColor }) => {
  const { dateShowCalendar, dateShowCountdown } = normalizeDateSettings(settings);
  const date   = parseWeddingDate(invitation?.weddingDate);
  const target = getWeddingStartTime(invitation);
  const time   = formatCeremonyTime(invitation?.ceremonyTime);
  const btnStyle = { backgroundColor: theme.button, color: theme.buttonLabel };

  return (
    <div className="p-6 text-center" data-section="date" style={{ backgroundColor }}>
      <h2 className="text-base mb-3"
        style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
        Wedding Day
      </h2>

      {date ? (
        <>
          {dateShowCalendar && <CalendarView date={date} theme={theme} />}
          {dateShowCountdown && (
            <Countdown target={target} theme={theme} hasTime={parseCeremonyTime(invitation?.ceremonyTime) !== null} />
          )}
          <p className="text-[9px] mb-4" style={{ color: theme.bodyText }}>
            {`${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`}
            {time && ` · ${time}`}
          </p>
        </>
      ) : (
        <p className="text-[9px] mb-4" data-testid="wedding-date-missing" style={{ color: theme.bodyText }}>
          The wedding date hasn't been set yet.
        </p>
      )}

      {/* Existing button — calendar file (ICS) export is a separate task */}
      <button type="button" className="w-full py-2 rounded-full text-white text-[9px] font-bold"
        style={btnStyle}>
        Add to calendar
      </button>
    </div>
  );
};

export default WeddingDaySection;
