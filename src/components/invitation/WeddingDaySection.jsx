// src/components/invitation/WeddingDaySection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   The invitation's "Wedding Day" section: an optional month calendar with the
//   wedding day highlighted, an optional live countdown, the date/time line and
//   an optional "Add to Calendar" button at the bottom (the working
//   SaveTheDate component on the page; a non-functional placeholder in the
//   builder preview).
//
//   The parent decides whether to render this at all (when any of Calendar
//   View, Countdown or Add to Calendar is on — see shouldShowWeddingDaySection). The wedding date
//   and ceremony time come from Wedding Details (`invitation`); colors and fonts
//   come from the resolved Color Theme (`theme`).
//
//   Date math lives in src/lib/weddingDate.js. The countdown target comes only
//   from getWeddingStartTime(), which is where venue time zone support goes.
//
//   variant="compact" (default) — the builder's phone preview, unchanged.
//   variant="page"              — the standalone invitation website: sizes come
//     from invitationContent.css. (On the page the parent only renders this
//     section when a valid date is set — see getSectionVisibility in
//     src/lib/invitationView.js.)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import SaveTheDate from "@/components/SaveTheDate";
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

// ── Sizing per variant ────────────────────────────────────────────────────────
// compact = exactly the classes the phone preview has always used.
// page    = classes from src/components/invitation/invitationContent.css.
const SIZES = {
  compact: {
    section:        "p-6 text-center",
    heading:        "text-base mb-3",
    calendar:       "mb-4",
    month:          "text-[11px] mb-2",
    table:          "w-full text-[9px] border-collapse",
    day:            "inline-flex w-5 h-5 items-center justify-center rounded-full",
    countdown:      "mb-4",
    countdownGrid:  "grid grid-cols-4 gap-1.5",
    countdownCell:  "rounded-lg py-1.5",
    countdownValue: "text-sm leading-none",
    countdownUnit:  "text-[7px] uppercase tracking-widest mt-1",
    note:           "text-[8px] mt-1.5",
    doneTitle:      "text-sm",
    doneText:       "text-[9px] mt-1",
    date:           "text-[9px] mb-4",
  },
  page: {
    section:        "tg-inv-section text-center",
    heading:        "tg-inv-h2",
    calendar:       "tg-inv-date__calendar",
    month:          "tg-inv-strong tg-inv-date__month",
    table:          "w-full tg-inv-small border-collapse",
    day:            "tg-inv-date__day inline-flex items-center justify-center rounded-full",
    countdown:      "tg-inv-date__countdown",
    countdownGrid:  "grid grid-cols-4 tg-inv-date__countdown-grid",
    countdownCell:  "rounded-xl tg-inv-date__countdown-cell",
    countdownValue: "tg-inv-date__countdown-value leading-none",
    countdownUnit:  "tg-inv-eyebrow uppercase tracking-widest mt-1",
    note:           "tg-inv-small mt-2",
    doneTitle:      "tg-inv-strong",
    doneText:       "tg-inv-body mt-1",
    date:           "tg-inv-body",
  },
};

// Page variant: keep the content in the invitation's centered column.
// Compact variant: no wrapper at all, so the preview's DOM is unchanged.
const InnerWrap = ({ page, children }) =>
  (page ? <div className="tg-inv-inner">{children}</div> : <>{children}</>);

const CalendarView = ({ date, theme, sz }) => {
  const weeks = buildCalendarMonth(date.year, date.month);
  const monthLabel = `${MONTH_NAMES[date.month - 1]} ${date.year}`;
  return (
    <div className={sz.calendar} data-testid="wedding-calendar">
      <p className={sz.month} style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
        {monthLabel}
      </p>
      <table className={sz.table} aria-label={`${monthLabel} calendar`}>
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
                        className={sz.day}
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

const Countdown = ({ target, theme, hasTime, sz }) => {
  const parts = useCountdown(target);
  if (!parts) return null;

  if (parts.isComplete) {
    return (
      <div className={sz.countdown} data-testid="wedding-countdown" data-complete="true">
        <p className={sz.doneTitle} style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
          Just married! 🎉
        </p>
        <p className={sz.doneText} style={{ color: theme.bodyText }}>
          Thank you for celebrating with us.
        </p>
      </div>
    );
  }

  return (
    <div className={sz.countdown} data-testid="wedding-countdown" role="timer" aria-live="off">
      <div className={sz.countdownGrid}>
        {COUNTDOWN_UNITS.map(u => (
          <div key={u.key} className={sz.countdownCell} style={{ border: `1px solid ${theme.accent}` }}>
            <p className={sz.countdownValue} data-testid={`countdown-${u.key}`}
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              {parts[u.key]}
            </p>
            <p className={sz.countdownUnit} style={{ color: theme.bodyText }}>
              {u.label}
            </p>
          </div>
        ))}
      </div>
      {!hasTime && (
        <p className={sz.note} style={{ color: theme.bodyText }}>
          Counting down to the start of the day.
        </p>
      )}
    </div>
  );
};

const WeddingDaySection = ({ invitation, settings, theme, backgroundColor, variant = "compact" }) => {
  const page = variant === "page";
  const sz = page ? SIZES.page : SIZES.compact;
  const { dateShowCalendar, dateShowCountdown, dateShowAddToCalendar } = normalizeDateSettings(settings);
  const date   = parseWeddingDate(invitation?.weddingDate);
  const target = getWeddingStartTime(invitation);
  const time   = formatCeremonyTime(invitation?.ceremonyTime);

  return (
    <div className={sz.section} data-section="date" style={{ backgroundColor }}>
      <InnerWrap page={page}>
        <h2 className={sz.heading}
          style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
          Wedding Day
        </h2>

        {date ? (
          <>
            {dateShowCalendar && <CalendarView date={date} theme={theme} sz={sz} />}
            {dateShowCountdown && (
              <Countdown target={target} theme={theme} sz={sz}
                hasTime={parseCeremonyTime(invitation?.ceremonyTime) !== null} />
            )}
            <p className={sz.date} style={{ color: theme.bodyText }}>
              {`${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`}
              {time && ` · ${time}`}
            </p>
          </>
        ) : (
          <p className="text-[9px] mb-4" data-testid="wedding-date-missing" style={{ color: theme.bodyText }}>
            The wedding date hasn't been set yet.
          </p>
        )}

        {/* Add to Calendar — last, after the date/time line, matching the
            Date tab's order (Calendar View, Countdown, Add to Calendar).
              Page:    the existing working SaveTheDate component (renders
                       nothing without a valid date).
              Preview: a non-functional placeholder, shown even before a
                       date is set like the other preview placeholders. */}
        {dateShowAddToCalendar && (page ? (
          <SaveTheDate invitation={invitation} variant="invitation" theme={theme} />
        ) : (
          <button type="button" tabIndex={-1} aria-disabled="true"
            data-testid="preview-add-to-calendar"
            className="w-full py-2 rounded-full text-white text-[9px] font-bold cursor-default"
            style={{ backgroundColor: theme.button, color: theme.buttonLabel }}>
            Add to calendar
          </button>
        ))}
      </InnerWrap>
    </div>
  );
};

export default WeddingDaySection;
