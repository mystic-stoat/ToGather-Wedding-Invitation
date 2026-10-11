// src/pages/InvitationPreview.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   /invitation/preview — the couple's full-page, responsive preview of their
//   invitation (PC, tablet and phone). Protected route: only the logged-in
//   owner can open it, and it only ever loads THEIR invitation
//   (getInvitationByUser(user.uid)).
//
//   Shows the LATEST SAVED version from Firestore — not unsaved builder edits —
//   rendered by the same <InvitationContent> as the builder's phone preview,
//   in mode="page" (responsive sizing, no unfinished placeholders).
//
//   A sticky "Preview" bar makes clear this is not the guest-facing page.
//   RSVP is turned off here; guests will RSVP from their personal link
//   (/rsvp/:inviteeId/:token) in a later phase.
//
// DATA: src/hooks/useSavedInvitation.js (owner-only reads, no rule changes).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedInvitation } from "@/hooks/useSavedInvitation";
import { useGoogleFonts } from "@/hooks/useGoogleFonts";
import InvitationContent, { InvitationPageSurface } from "@/components/invitation/InvitationContent";
import { BUILDER_UI, BUILDER_FONT, ERROR_COLOR } from "@/components/invitation/builderTheme";
import { resolveInvitationTheme } from "@/lib/invitationTheme";
import { getInvitationSectionIds, VIEW_MODES } from "@/lib/invitationView";
import { getGuestQaItems } from "@/lib/qa";
import { scrollToSectionInPage } from "@/components/qa/qaNavigation";

const PAGE_TITLE = "Invitation Preview · ToGather";

// ── Full-screen states (loading / no invitation / error) ──────────────────────
const CenteredState = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center px-6"
    style={{ backgroundColor: BUILDER_UI.surface, fontFamily: BUILDER_FONT }}>
    <div className="max-w-md text-center flex flex-col items-center gap-3">{children}</div>
  </div>
);

// ── Sticky preview bar — builder colors, so it never looks like the invitation ─
// One compact row on phones (short label, icon-only Refresh); the full
// explanation from the "sm" breakpoint up.
const PreviewBar = ({ barRef, refreshing, onRefresh }) => (
  <header ref={barRef} role="region" aria-label="Invitation preview"
    className="sticky top-0 z-50 border-b"
    style={{ backgroundColor: BUILDER_UI.surface, borderColor: BUILDER_UI.outline, fontFamily: BUILDER_FONT }}>
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
      <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-xs font-bold uppercase tracking-widest"
        style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
        <Eye size={14} aria-hidden="true" /> Preview
      </span>
      <p className="text-xs sm:text-sm flex-1 min-w-0" style={{ color: BUILDER_UI.onSurface }}>
        <span className="sm:hidden">Last saved version</span>
        <span className="hidden sm:inline">
          This is your last saved invitation. Guests will see it from their personal invitation link.
        </span>
      </p>
      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" onClick={onRefresh} disabled={refreshing}
          aria-label={refreshing ? "Refreshing preview" : "Refresh preview"}
          className="inline-flex items-center gap-1.5 rounded-lg p-2 sm:px-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
          style={{ color: BUILDER_UI.primary }}>
          <RefreshCw size={14} aria-hidden="true" className={refreshing ? "animate-spin" : undefined} />
          <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
        <Link to="/create-invitation"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white whitespace-nowrap"
          style={{ backgroundColor: BUILDER_UI.primary }}>
          <ArrowLeft size={14} aria-hidden="true" /> Builder
          <span className="sr-only"> (back to the Invitation Builder)</span>
        </Link>
      </div>
    </div>
  </header>
);

// ── RSVP area on the preview — guests get the real form later (Phase 4) ──────
const PreviewRsvp = ({ theme }) => (
  <div data-testid="preview-rsvp">
    <button type="button" className="tg-inv-button" disabled aria-disabled="true"
      style={{ backgroundColor: theme.button, color: theme.buttonLabel }}>
      RSVP Now
    </button>
    <p className="tg-inv-small mt-3" style={{ color: theme.bodyText }}>
      RSVP is turned off in this preview. Each guest replies from their personal invitation link.
    </p>
  </div>
);

const InvitationPreview = () => {
  const { user } = useAuth();
  const { status, view, storyError, refreshing, reload } = useSavedInvitation(user?.uid);
  const surfaceRef = useRef(null);
  const barRef = useRef(null);
  const [barHeight, setBarHeight] = useState(0);

  // Fonts used by the invitation (same loader as the builder)
  useGoogleFonts(view ? [view.settings.font1, view.settings.font2] : []);

  // Browser tab title while this page is open
  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => { document.title = previous; };
  }, []);

  // Q&A section links must land BELOW the sticky bar — its height changes when
  // it wraps on narrow screens, so measure it.
  useLayoutEffect(() => {
    const measure = () => setBarHeight(barRef.current?.offsetHeight || 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [status]);

  if (status === "loading") {
    return (
      <CenteredState>
        <Loader2 size={28} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
        <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>Loading your invitation preview...</p>
      </CenteredState>
    );
  }

  if (status === "empty") {
    return (
      <CenteredState>
        <h1 className="text-2xl font-semibold" style={{ color: BUILDER_UI.onSurface }}>No invitation yet</h1>
        <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Add your wedding details and save your invitation, then come back to preview it.
        </p>
        <Link to="/wedding-details" className="underline font-semibold text-sm" style={{ color: BUILDER_UI.primary }}>
          Go to Wedding Details
        </Link>
      </CenteredState>
    );
  }

  if (status === "error") {
    return (
      <CenteredState>
        <AlertCircle size={28} style={{ color: ERROR_COLOR }} aria-hidden="true" />
        <h1 className="text-2xl font-semibold" style={{ color: BUILDER_UI.onSurface }}>
          We couldn't load your invitation
        </h1>
        <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Check your connection and try again.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={reload}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: BUILDER_UI.primary }}>
            Try again
          </button>
          <Link to="/create-invitation" className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ color: BUILDER_UI.primary }}>
            Back to builder
          </Link>
        </div>
      </CenteredState>
    );
  }

  // ── Ready ──────────────────────────────────────────────────────────────────
  const theme = resolveInvitationTheme(view.settings);
  const sectionCtx = {
    invitation: view.invitation, settings: view.settings, hero: view.hero,
    storyBlocks: view.storyBlocks, partyMembers: view.partyMembers,
    registries: view.registries, registryMessage: view.registryMessage, registryShown: view.registryShown,
  };
  // Q&A: same filtering as the builder, but section links only count for
  // sections that are really on THIS page (page-mode visibility).
  const qaEntries = getGuestQaItems(view.qaItems, {
    data: { ...(view.invitation || {}), ...view.settings },
    availableSections: getInvitationSectionIds(sectionCtx, VIEW_MODES.PAGE),
  }, view.qaShown);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background }}>
      <PreviewBar barRef={barRef} refreshing={refreshing} onRefresh={reload} />

      {storyError && (
        <div role="alert" className="px-4 py-3 text-sm text-center flex items-center justify-center gap-2"
          style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface, fontFamily: BUILDER_FONT }}>
          <AlertCircle size={14} style={{ color: ERROR_COLOR }} aria-hidden="true" />
          Our Story couldn't be loaded, so it isn't shown in this preview. Try Refresh.
        </div>
      )}

      <main>
        <InvitationPageSurface ref={surfaceRef} settings={view.settings} scrollOffset={barHeight}>
          <InvitationContent
            mode={VIEW_MODES.PAGE}
            {...sectionCtx}
            qaEntries={qaEntries}
            onNavigate={id => scrollToSectionInPage(surfaceRef.current, id)}
            rsvpSlot={<PreviewRsvp theme={theme} />}
          />
        </InvitationPageSurface>
      </main>
    </div>
  );
};

export default InvitationPreview;
