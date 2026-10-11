// src/pages/RSVP.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The GUEST invitation website (Phase 4). Each guest opens their personal
//   link — /rsvp/:inviteeId/:token, the same URL the invitation emails, the
//   Guest List "Copy link" and the Dashboard already use — and sees the
//   couple's complete saved invitation (the same responsive <InvitationContent
//   mode="page"> as the owner preview), with the RSVP form in its RSVP section.
//
//   - Valid link, not answered yet  → invitation + RSVP form
//   - Valid link, already answered  → invitation + "you already replied"
//                                     (no form — one response per link)
//   - Invalid link / missing wedding → "Invitation Not Found", NO wedding info
//
//   Data comes ONLY from src/lib/guestInvitation.js (guest-safe data).
//
// ⚠️ DO NOT DEPLOY THE GUEST WEBSITE UNTIL PHASE 5 SECURITY HARDENING IS DONE.
//   In Phase 4 the token is still checked in the browser and the Firestore
//   rules still let anyone read guest and invitation documents. Phase 5 moves
//   both reads and the RSVP write behind callable Cloud Functions that verify
//   the token on the server. See docs/INVITATION_WEBSITE.md.
//
// INVITATION THEME:
//   The whole page uses the couple's Color Theme and fonts. The RSVP card is
//   wrapped in tg-invite-theme (buildGuestThemeStyle), which re-points the
//   app's Tailwind color tokens to the invitation's colors, as before. The
//   loading / error screens and the footer keep the app's own look.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import InvitationContent, { InvitationPageSurface } from "@/components/invitation/InvitationContent";
import RsvpForm from "@/components/rsvp/RsvpForm";
import { fetchGuestInvitation, submitGuestRsvp } from "@/lib/guestInvitation";
import { resolveInvitationTheme, buildGuestThemeStyle } from "@/lib/invitationTheme";
import { useGoogleFonts } from "@/hooks/useGoogleFonts";
import { getInvitationSectionIds, VIEW_MODES } from "@/lib/invitationView";
import { getGuestQaItems } from "@/lib/qa";
import { scrollToSectionInPage } from "@/components/qa/qaNavigation";

const PAGE_TITLE = "Wedding Invitation · ToGather";

// ── Personal link hygiene while this page is open ────────────────────────────
// The URL contains the guest's RSVP token, so: keep search engines out, and
// don't send the URL to other sites (registry, maps, Spotify) as a Referer.
const useGuestPageMeta = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    const added = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      meta.setAttribute("data-guest-invitation", "");
      document.head.appendChild(meta);
      return meta;
    });
    return () => {
      document.title = previousTitle;
      added.forEach(m => m.remove());
    };
  }, []);
};

// ── Full-screen states (app look, no wedding information) ────────────────────
const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading your invitation...</p>
    </div>
  </div>
);

const NotFoundScreen = ({ message }) => (
  <div className="flex min-h-screen flex-col bg-background">
    <div className="h-1 bg-gradient-to-r from-primary via-accent-light to-primary" />
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle size={32} className="text-destructive" />
        </div>
        <div>
          <h2 className="mb-2 font-heading text-2xl font-semibold italic text-foreground">
            Invitation Not Found
          </h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

// ── "You already replied" — shown instead of the form (one response per link) ─
const formatResponseDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const AlreadyResponded = ({ guest, coupleNames }) => {
  const when = formatResponseDate(guest.respondedAt);
  const status = guest.rsvpStatus === "Accepted"
    ? `You let ${coupleNames} know you'll be there`
    : guest.rsvpStatus === "Declined"
      ? `You let ${coupleNames} know you can't make it`
      : "Your response has been recorded";
  return (
    <div className="space-y-4 py-2 text-center" data-testid="rsvp-already-responded">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 size={28} className="text-primary" />
      </div>
      <h3 className="font-heading text-2xl font-semibold italic text-foreground">
        Thank you — you've already replied
      </h3>
      <p className="text-muted-foreground">
        {status}{when && ` on ${when}`}.
      </p>
      <p className="text-sm text-muted-foreground">
        Need to change your response? Please contact {coupleNames} directly.
      </p>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const RSVP = () => {
  const { inviteeId, token } = useParams();
  const [state, setState] = useState({ status: "loading" }); // loading | ok | invalid | error
  const surfaceRef = useRef(null);

  useGuestPageMeta();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const result = await fetchGuestInvitation(inviteeId, token);
        if (!cancelled) setState(result);
      } catch (err) {
        console.error("Guest invitation load error:", err);
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [inviteeId, token]);

  const view = state.status === "ok" ? state.view : null;
  const theme = view ? resolveInvitationTheme(view.settings) : null;
  useGoogleFonts(theme ? [theme.font1, theme.font2] : []);

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "invalid") {
    return <NotFoundScreen message="This invitation link is invalid or has expired." />;
  }
  if (state.status !== "ok") {
    return <NotFoundScreen message="Something went wrong loading your invitation. Please try again." />;
  }

  const { guest } = state;
  const groomFirst = view.invitation?.groomName?.first || "";
  const brideFirst = view.invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : "the couple";

  const sectionCtx = {
    invitation: view.invitation, settings: view.settings, hero: view.hero,
    storyBlocks: view.storyBlocks, partyMembers: view.partyMembers,
    registries: view.registries, registryMessage: view.registryMessage, registryShown: view.registryShown,
  };
  // Q&A: only visible, answered questions; section links only to sections
  // that are really on this page.
  const qaEntries = getGuestQaItems(view.qaItems, {
    data: { ...(view.invitation || {}), ...view.settings },
    availableSections: getInvitationSectionIds(sectionCtx, VIEW_MODES.PAGE),
  }, view.qaShown);

  // The RSVP card inside the invitation's RSVP section
  const rsvpCard = (
    <div className="tg-invite-theme mx-auto mt-8 max-w-lg text-left" data-testid="invitation-theme"
      style={buildGuestThemeStyle(view.invitation)}>
      <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-xl shadow-foreground/[0.04] sm:p-8">
        {guest.responded ? (
          <AlreadyResponded guest={guest} coupleNames={coupleNames} />
        ) : (
          <RsvpForm guest={guest} invitation={view.invitation}
            onSubmit={response => submitGuestRsvp({ inviteeId, token, response })} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: theme.background }}>
      <main className="flex-1">
        <InvitationPageSurface ref={surfaceRef} settings={view.settings}>
          <InvitationContent
            mode={VIEW_MODES.PAGE}
            {...sectionCtx}
            qaEntries={qaEntries}
            onNavigate={id => scrollToSectionInPage(surfaceRef.current, id)}
            rsvpSlot={rsvpCard}
          />
        </InvitationPageSurface>
        <p className="py-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-heading font-semibold text-foreground">ToGather</span>
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default RSVP;
