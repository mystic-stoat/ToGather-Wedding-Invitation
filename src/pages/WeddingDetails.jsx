// src/pages/WeddingDetails.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The Wedding Details SUMMARY/view screen (route: /wedding-details).
//   Read-only overview of the host's wedding information — the editable
//   form lives at /wedding-details/edit (see WeddingDetailsEdit.jsx).
//
//   Layout matches the Figma reference: left sidebar navigation (same
//   pattern as Dashboard.jsx / GuestList.jsx), warm ivory background,
//   white cards, sage/primary accents.
//
// DATA SOURCE:
//   Reads the same `invitations` document as WeddingDetailsEdit.jsx via
//   getInvitationByUser(). No separate data store — this page never writes.
//
// DESIGN NOTE — fields with no edit-form control:
//   The Figma summary shows Reception Hours, Cocktail Hour / Countdown
//   toggles, Dress Code, Wedding Website, and Personal Message. None of
//   these appear in the edit-form reference, and none have an existing
//   editing surface elsewhere in the app. Per the assignment scope, this
//   page displays whatever is stored for them (graceful "not added yet"
//   placeholders when empty) without inventing new editing UI for them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Heart, Users, Gift, MapPin,
  CalendarCheck, Mail, Smartphone, ChevronRight,
  Pencil, Clock, Shirt,
  Globe, MessageSquare, CheckCircle2, Circle,
  ExternalLink, LogOut, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser } from "@/lib/firestore";
import {
  formatWeddingDate,
  formatTime,
  getWeddingCountdown,
  getCountdownMessage,
  DEFAULT_TIME_ZONE,
} from "@/utils/weddingDate";
import Logo from "@/assets/logo.svg";

// ── Sidebar — identical pattern to Dashboard.jsx / GuestList.jsx ─────────────
const Sidebar = ({ invitation, onLogout }) => {
  const groomFirst  = invitation?.groomName?.first || "";
  const brideFirst  = invitation?.brideName?.first || "";
  const coupleNames = invitation?.eventTitle
    || (groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : null);
  const weddingDate = invitation?.weddingDate
    ? formatWeddingDate(invitation.weddingDate)
    : null;

  const NavItem = ({ to, icon: Icon, label, active = false }) => (
    <Link to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}>
      <Icon size={16} />
      {label}
      {active && <ChevronRight size={14} className="ml-auto" />}
    </Link>
  );

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-background border-r border-border/50 px-4 py-6 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1 px-1">
        <img src={Logo} className="h-8 w-auto" />
        <span className="font-heading text-lg font-semibold text-foreground">ToGather</span>
      </div>
      <p className="text-xs text-muted-foreground px-1 mb-8">Plan the day. Share the joy.</p>

      <nav className="flex-1 space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Overview
          </p>
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Planning
          </p>
          <div className="space-y-0.5">
            <NavItem to="/wedding-details" icon={Heart}  label="Wedding Details" active />
            <NavItem to="/guest-list"      icon={Users}  label="Guest List" />
            <NavItem to="/dashboard"       icon={Gift}   label="Registry" />
            <NavItem to="/dashboard"       icon={MapPin} label="Travel & Stay" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Invitations
          </p>
          <div className="space-y-0.5">
            <NavItem to="/dashboard"          icon={CalendarCheck} label="Save the Date" />
            <NavItem to="/dashboard"          icon={Mail}          label="Paper Invitations" />
            <NavItem to="/create-invitation"  icon={Smartphone}    label="Mobile Invitation" />
          </div>
        </div>
      </nav>

      <div className="space-y-3 mt-6">
        {coupleNames && (
          <div className="bg-primary/8 rounded-xl px-3 py-3 border border-primary/15">
            <p className="text-sm font-semibold text-foreground">{coupleNames}</p>
            {weddingDate && (
              <p className="text-xs text-muted-foreground mt-0.5">{weddingDate}</p>
            )}
          </div>
        )}
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut size={15} /> Log out
        </button>
      </div>
    </aside>
  );
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

// Icon badge used at the top of most cards (matches the sage-tinted circular
// icon wells used throughout the rest of the app, e.g. WeddingDetailsEdit's
// SectionCard and Dashboard's stat rows).
const IconBadge = ({ icon: Icon }) => (
  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
    <Icon size={16} className="text-primary" />
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-card rounded-2xl border border-border/50 shadow-sm p-5 sm:p-6 ${className}`}>
    {children}
  </div>
);

// A single "LABEL / value" row, used for partner names, dates, times, etc.
const Field = ({ icon: Icon, label, value, placeholder = "Not added yet" }) => (
  <div className="flex items-start gap-3">
    {Icon && <IconBadge icon={Icon} />}
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm font-semibold mt-0.5 break-words ${value ? "text-foreground" : "text-muted-foreground italic font-normal"}`}>
        {value || placeholder}
      </p>
    </div>
  </div>
);

// Checked/unchecked indicator row (Cocktail Hour, Countdown)
const IndicatorRow = ({ label, checked }) => (
  <div className="flex items-center gap-2 text-sm">
    {checked
      ? <CheckCircle2 size={16} className="text-primary" />
      : <Circle size={16} className="text-muted-foreground/40" />}
    <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

// Graceful map fallback — no map library/API key in this project. Shows the
// venue's own name/address with a functional (free, no-API-key) link out to
// Google Maps, rather than any fabricated or reused map artwork.
const MapFallback = ({ name, address }) => {
  const query = [name, address].filter(Boolean).join(", ");
  const href = query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-muted/40 h-32 sm:h-40 flex flex-col items-center justify-center gap-2 text-center px-4">
      <MapPin size={22} className="text-primary" />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          Get directions <ExternalLink size={12} />
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">Add a venue to see directions here.</p>
      )}
    </div>
  );
};

const VenueCard = ({ label, name, address }) => (
  <Card>
    <div className="flex items-start gap-3">
      <IconBadge icon={MapPin} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 ${name ? "text-foreground" : "text-muted-foreground italic font-normal"}`}>
          {name || "Not added yet"}
        </p>
        {address && <p className="text-xs text-muted-foreground mt-0.5">{address}</p>}
      </div>
    </div>
    <MapFallback name={name} address={address} />
  </Card>
);

// ── Main Component ────────────────────────────────────────────────────────────
const WeddingDetails = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await getInvitationByUser(user.uid);
        setInvitation(data);
      } catch (err) {
        console.error("Failed to load wedding details:", err);
        setLoadError("Couldn't load your wedding details. Please try refreshing the page.");
      } finally {
        setLoading(false);
      }
    })();
    // Depend on the uid, not the `user` object reference — some auth
    // providers (and mocked test doubles) hand back a new object on every
    // render, which would otherwise re-trigger this fetch every time.
  }, [user?.uid]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar invitation={invitation} onLogout={handleLogout} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your wedding details...</p>
          </div>
        </main>
      </div>
    );
  }

  const groomFirst = invitation?.groomName?.first || "";
  const brideFirst = invitation?.brideName?.first || "";
  const partner1Name = [invitation?.groomName?.first, invitation?.groomName?.middle, invitation?.groomName?.last]
    .filter(Boolean).join(" ");
  const partner2Name = [invitation?.brideName?.first, invitation?.brideName?.middle, invitation?.brideName?.last]
    .filter(Boolean).join(" ");

  const timeZone = invitation?.timeZone || DEFAULT_TIME_ZONE;
  const countdown = getWeddingCountdown(invitation?.weddingDate, invitation?.weddingDateUndecided, timeZone);
  const countdownMessage = getCountdownMessage(countdown);

  const showCalendar = countdown.status !== "undecided" && countdown.status !== "invalid";
  const selectedDate = showCalendar && invitation?.weddingDate
    ? (() => {
        const [y, m, d] = invitation.weddingDate.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;

  // Ceremony/reception venue with backward-compatible fallback to the
  // legacy single-venue fields (venueName/venueAddress) used before this
  // page separated ceremony vs. reception.
  const ceremonyVenueName    = invitation?.ceremonyVenueName || invitation?.venueName || "";
  const ceremonyVenueAddress = invitation?.ceremonyVenueAddress || invitation?.venueAddress || "";
  const receptionVenueName    = invitation?.receptionVenueName || invitation?.venueName || "";
  const receptionVenueAddress = invitation?.receptionVenueAddress || invitation?.venueAddress || "";

  const hasAnyDetails = !!invitation;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar invitation={invitation} onLogout={handleLogout} />

      <main className="flex-1 min-h-screen overflow-y-auto">
        {/* Mobile top bar — sidebar is desktop-only (lg:flex) */}
        <div className="lg:hidden bg-card border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-primary" />
            <span className="font-heading text-lg font-semibold">ToGather</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={15} /> Log out
          </button>
        </div>

        <div className="px-6 lg:px-10 py-8 max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl font-semibold text-foreground">Wedding Details</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Core information that populates your invitations.
              </p>
            </div>
            <Link to="/wedding-details/edit">
              <Button variant="default" className="rounded-xl gap-2">
                <Pencil size={15} /> Edit Details
              </Button>
            </Link>
          </div>

          {loadError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {/* Empty state — no invitation doc yet */}
          {!hasAnyDetails ? (
            <Card className="text-center py-12">
              <Heart size={32} className="mx-auto text-primary/50 mb-3" />
              <p className="font-heading text-lg text-foreground mb-1">No wedding details yet</p>
              <p className="text-sm text-muted-foreground mb-5">
                Add your wedding details to see them here and start building your invitations.
              </p>
              <Link to="/wedding-details/edit">
                <Button variant="default" className="rounded-xl gap-2">
                  <Pencil size={15} /> Add Wedding Details
                </Button>
              </Link>
            </Card>
          ) : (
            <>
              {/* Partner cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <Field icon={Heart} label="Partner 1" value={partner1Name} />
                </Card>
                <Card>
                  <Field icon={Heart} label="Partner 2" value={partner2Name} />
                </Card>
              </div>

              {/* Date / time / countdown */}
              <Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: date + compact calendar */}
                  <div>
                    <Field
                      icon={Clock}
                      label="Wedding Date"
                      value={showCalendar ? formatWeddingDate(invitation?.weddingDate) : null}
                      placeholder="We're still deciding"
                    />
                    {showCalendar ? (
                      <div className="mt-3 border border-border/50 rounded-xl overflow-hidden [&_.rdp]:p-2">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          month={selectedDate}
                          className="pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="mt-3 border border-dashed border-border/60 rounded-xl p-6 text-center text-xs text-muted-foreground">
                        The calendar will appear here once your date is set.
                      </div>
                    )}
                  </div>

                  {/* Right: times + indicators + countdown */}
                  <div className="space-y-4">
                    <Field label="Ceremony Time" value={formatTime(invitation?.ceremonyTime)} />
                    <Field
                      label="Reception Hours"
                      value={
                        invitation?.receptionStartTime || invitation?.receptionEndTime
                          ? `${formatTime(invitation?.receptionStartTime) || "?"} – ${formatTime(invitation?.receptionEndTime) || "?"}`
                          : null
                      }
                    />
                    <div className="flex flex-col gap-1.5 pl-12">
                      <IndicatorRow label="Cocktail Hour" checked={!!invitation?.cocktailHourEnabled} />
                      <IndicatorRow label="Countdown" checked={!!invitation?.countdownEnabled} />
                    </div>
                    <div className="rounded-xl bg-muted/50 border border-border/40 px-4 py-3 text-center">
                      <p className="font-heading italic text-sm text-foreground">{countdownMessage}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Venues */}
              <VenueCard label="Ceremony Venue" name={ceremonyVenueName} address={ceremonyVenueAddress} />
              <VenueCard label="Reception Venue" name={receptionVenueName} address={receptionVenueAddress} />

              {/* Dress code */}
              <Card>
                <Field icon={Shirt} label="Dress Code" value={invitation?.dressCode} />
              </Card>

              {/* Website */}
              <Card>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Globe} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Wedding Website
                    </p>
                    {invitation?.weddingWebsite ? (
                      <a href={invitation.weddingWebsite} target="_blank" rel="noreferrer"
                        className="text-sm font-semibold text-primary hover:underline mt-0.5 inline-flex items-center gap-1 break-all">
                        {invitation.weddingWebsite} <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground italic mt-0.5">Not added yet</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Personal message */}
              <Card>
                <div className="flex items-start gap-3">
                  <IconBadge icon={MessageSquare} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal Message
                    </p>
                    <p className={`text-sm mt-0.5 ${invitation?.personalMessage ? "text-foreground italic" : "text-muted-foreground italic font-normal"}`}>
                      {invitation?.personalMessage ? `"${invitation.personalMessage}"` : "Not added yet"}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WeddingDetails;
