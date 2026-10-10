// src/components/registry/RegistrySection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Guest-facing "Gift Registry" section: the couple's registry message plus
// the registry links guests may see. Moved from src/pages/RSVP.jsx so the
// guest RSVP page AND the Invitation Builder's phone preview render the exact
// same thing.
//
// Only entries with isVisible === true render (getVisibleRegistries).
// Returns null when the couple turned "Show Registry on Invitation" off
// (showOnInvitation === false), or when there's no message and no visible
// registries so the section never renders empty.
//
// Colors come from the app's Tailwind tokens (bg-card, text-primary, …). Wrap
// it in `.tg-invite-theme` with buildGuestThemeStyle() — as RSVP.jsx does —
// to apply the invitation's Color Theme.
//
// `compact` shrinks spacing and text for the builder's ~270px phone mockup;
// the guest page uses the default (full-size) layout.
// ─────────────────────────────────────────────────────────────────────────────

import { Gift, ExternalLink } from "lucide-react";
import { getVisibleRegistries, hasRegistryContent } from "@/lib/registry";

const SIZES = {
  full: {
    section: "mt-6 rounded-2xl border border-border/50 bg-card p-6 shadow-sm animate-fade-up",
    divider: "mb-4 flex items-center justify-center gap-3",
    line: "h-px w-10",
    icon: 15,
    title: "font-heading text-xl font-semibold italic text-foreground text-center",
    message: "mt-3 text-center text-sm text-muted-foreground leading-relaxed",
    list: "mt-5 space-y-2",
    link: "flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary",
    linkIcon: 14,
    extIcon: 13,
  },
  compact: {
    section: "rounded-xl border border-border/50 bg-card p-4 shadow-sm",
    divider: "mb-2 flex items-center justify-center gap-2",
    line: "h-px w-6",
    icon: 11,
    title: "font-heading text-base font-semibold italic text-foreground text-center",
    message: "mt-2 text-center text-[9px] text-muted-foreground leading-relaxed whitespace-pre-line",
    list: "mt-3 space-y-1.5",
    link: "flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-[10px] font-medium text-foreground",
    linkIcon: 10,
    extIcon: 9,
  },
};

const RegistrySection = ({ registries = [], registryMessage, showOnInvitation = true, compact = false }) => {
  if (showOnInvitation === false || !hasRegistryContent(registries, registryMessage)) return null;
  const visible = getVisibleRegistries(registries);
  const hasMessage = Boolean(registryMessage?.trim());
  const s = compact ? SIZES.compact : SIZES.full;

  return (
    <section className={s.section} data-testid="registry-section">
      <div className={s.divider}>
        <div className={`${s.line} bg-gradient-to-r from-transparent to-border`} />
        <Gift size={s.icon} className="text-primary" />
        <div className={`${s.line} bg-gradient-to-l from-transparent to-border`} />
      </div>

      <h2 className={s.title}>
        Gift Registry
      </h2>

      {hasMessage && (
        <p className={s.message}>
          {registryMessage}
        </p>
      )}

      {visible.length > 0 && (
        <ul className={s.list}>
          {visible.map(r => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={s.link}
              >
                <Gift size={s.linkIcon} className="text-primary flex-shrink-0" />
                <span className="truncate">{r.name}</span>
                <ExternalLink size={s.extIcon} className="text-muted-foreground flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RegistrySection;
