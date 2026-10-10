// src/components/qa/QaSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Guest-facing "Questions & Answers" section — an accordion. Used by the
// Invitation Builder's phone preview AND the guest RSVP page (like
// RegistrySection), so the preview shows exactly what guests see.
//
// Pass `entries` from getGuestQaItems() (src/lib/qa.js): only questions that
// are switched on and have a complete answer, in the couple's order. Section
// links call onNavigate(sectionId) to scroll to that section on the same page
// — they never open the builder. Returns null when there's nothing to show.
//
// Colors come from the app's Tailwind tokens; wrap it in `.tg-invite-theme`
// with buildGuestThemeStyle() to apply the invitation's Color Theme.
// ─────────────────────────────────────────────────────────────────────────────

import { useId, useState } from "react";
import { ChevronDown, ExternalLink, ArrowDown, MessageCircle } from "lucide-react";

export const QA_TITLE = "Questions & Answers";

const SIZES = {
  full: {
    section: "mt-6 rounded-2xl border border-border/50 bg-card p-6 shadow-sm",
    divider: "mb-4 flex items-center justify-center gap-3",
    line: "h-px w-10",
    icon: 15,
    title: "font-heading text-xl font-semibold italic text-foreground text-center",
    list: "mt-5 divide-y divide-border/60",
    q: "flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-foreground",
    a: "pb-4 text-sm text-muted-foreground leading-relaxed",
    chev: 16,
    link: "mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline",
    linkIcon: 13,
  },
  compact: {
    section: "rounded-xl border border-border/50 bg-card p-4 shadow-sm",
    divider: "mb-2 flex items-center justify-center gap-2",
    line: "h-px w-6",
    icon: 11,
    title: "font-heading text-base font-semibold italic text-foreground text-center",
    list: "mt-3 divide-y divide-border/60",
    q: "flex w-full items-center justify-between gap-2 py-2 text-left text-[10px] font-semibold text-foreground",
    a: "pb-2 text-[9px] text-muted-foreground leading-relaxed",
    chev: 11,
    link: "mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-primary",
    linkIcon: 9,
  },
};

const Answer = ({ answer, onNavigate, s }) => (
  <>
    {answer.text && <p className="whitespace-pre-line">{answer.text}</p>}
    {answer.kind === "section" && (
      <button type="button" className={s.link} onClick={() => onNavigate?.(answer.section)}>
        View {answer.sectionLabel} <ArrowDown size={s.linkIcon} aria-hidden="true" />
      </button>
    )}
    {answer.kind === "url" && (
      <a href={answer.url} target="_blank" rel="noopener noreferrer" className={s.link}>
        {answer.label} <ExternalLink size={s.linkIcon} aria-hidden="true" />
      </a>
    )}
  </>
);

const GuestQaRow = ({ item, answer, open, onToggle, onNavigate, s, baseId }) => {
  const panelId = `${baseId}-a-${item.id}`;
  const buttonId = `${baseId}-q-${item.id}`;
  return (
    <li data-testid="qa-guest-item">
      <h3 className="m-0">
        <button type="button" id={buttonId} className={s.q} aria-expanded={open} aria-controls={panelId}
          onClick={onToggle}>
          <span className="min-w-0 break-words">{item.question}</span>
          <ChevronDown size={s.chev} aria-hidden="true"
            className={`flex-shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className={s.a}>
        <Answer answer={answer} onNavigate={onNavigate} s={s} />
      </div>
    </li>
  );
};

/**
 * Props
 *   entries     [{ item, answer }] from getGuestQaItems()
 *   onNavigate  (sectionId) => void — scroll to that section on this page
 *   compact     smaller sizing for the builder's phone preview
 */
const QaSection = ({ entries = [], onNavigate, compact = false }) => {
  const [openIds, setOpenIds] = useState(() => new Set());
  const baseId = useId().replace(/:/g, "");
  if (!entries.length) return null;
  const s = compact ? SIZES.compact : SIZES.full;

  const toggle = (id) => setOpenIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section className={s.section} data-testid="qa-section" aria-label={QA_TITLE}>
      <div className={s.divider}>
        <div className={`${s.line} bg-gradient-to-r from-transparent to-border`} />
        <MessageCircle size={s.icon} className="text-primary" />
        <div className={`${s.line} bg-gradient-to-l from-transparent to-border`} />
      </div>
      <h2 className={s.title}>{QA_TITLE}</h2>
      <ul className={s.list}>
        {entries.map(({ item, answer }) => (
          <GuestQaRow key={item.id} item={item} answer={answer} s={s} baseId={baseId}
            open={openIds.has(item.id)} onToggle={() => toggle(item.id)} onNavigate={onNavigate} />
        ))}
      </ul>
    </section>
  );
};

export default QaSection;
