// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Main hub after login. Rebuilt to match the Figma prototype with:
//     - Sidebar navigation (Overview, Planning, Invitations sections)
//     - Invitation preview card with Preview + Edit buttons
//     - RSVP Progress donut chart showing real percentage
//     - Recent RSVPs list with avatar initials and time ago
//     - Read-only guest overview table (search + copy RSVP link)
//     - Logout button in the sidebar
//
//   Dashboard is overview-only. Adding, deleting and managing guests lives on
//   the dedicated Guest List page (/guest-list).
//
// DATA FLOW:
//   1. Load invitation from `invitations` collection (weddingId, couple names)
//   2. Load all guests from `invitee` collection using weddingId
//   3. Compute stats (accepted/declined/pending) from real guest data
//   4. Show 3 most recent RSVPs sorted by respondedAt timestamp
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  LayoutDashboard, Heart, Users, Gift, MapPin,
  CalendarCheck, Mail, Smartphone, ChevronRight,
  Share2, Pencil, Eye, Bell, Loader2,
  Search, LogOut, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser,
  getInvitees,
} from "@/lib/firestore";
import { getMealLabel, getAttendanceStats } from "@/lib/rsvpOptions";
import Logo from "@/assets/logo.svg";
import Sidebar from "@/components/Sidebar"

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns initials from a name e.g. "Emma Thompson" → "ET"
const getInitials = (name = "") =>
  name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

// Returns a color class for avatars based on the first letter of the name
const avatarColor = (name = "") => {
  const colors = [
    "bg-primary/20 text-primary",
    "bg-accent text-accent-foreground",
    "bg-secondary/20 text-secondary",
    "bg-blue-100 text-blue-600",
    "bg-orange-100 text-orange-600",
  ];
  return colors[name.charCodeAt(0) % colors.length];
};

// Converts a Firestore timestamp to a human-readable "X ago" string
const timeAgo = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

// Returns the right color classes for each RSVP status badge — tuned to
// harmonize with the ToGather warm palette while keeping each status's
// semantic color (accepted = green, declined = red, pending = amber).
// Kept in sync with the identical map in GuestList.jsx.
const statusBadge = (status) => {
  const map = {
    Accepted: "bg-[#E7F0EA] text-[#3F5F47]",
    Declined: "bg-[#F7E6E6] text-[#C9666E]",
    Pending:  "bg-[#FDF3E1] text-[#D09B45]",
  };
  return map[status] || "bg-muted text-muted-foreground";
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {

  const { user, userProfile, logout } = useAuth();

  const navigate         = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [invitation, setInvitation]       = useState(null);
  const [guests, setGuests]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");

  // ── Load invitation + guests on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const inv = await getInvitationByUser(user.uid);
      setInvitation(inv);
      if (inv?.weddingId) {
        const list = await getInvitees(inv.weddingId);
        setGuests(list);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ── Computed values ────────────────────────────────────────────────────────

  // RSVP counts from real data
  const total    = guests.length;
  const accepted = guests.filter(g => g.rsvpStatus === "Accepted").length;
  const declined = guests.filter(g => g.rsvpStatus === "Declined").length;
  const pending  = guests.filter(g => g.rsvpStatus === "Pending").length;
  // Real headcount: accepted guests + plus-ones they actually submitted
  const { attending } = getAttendanceStats(guests);
  // Percentage of invitations that have responded (accepted or declined)
  const progress = total > 0 ? Math.round(((accepted + declined) / total) * 100) : 0;

  // Donut chart data — matches the statusBadge colors above
  const rsvpChartData = [
    { name: "Accepted", value: accepted || 0, color: "#3F5F47" },
    { name: "Declined", value: declined || 0, color: "#C9666E" },
    { name: "Pending",  value: pending  || 0, color: "#D09B45" },
  ];

  // 3 most recent guests who have responded — sorted by respondedAt timestamp
  const recentRSVPs = [...guests]
    .filter(g => g.rsvpStatus !== "Pending" && g.respondedAt)
    .sort((a, b) => {
      const aTime = a.respondedAt?.toDate?.() || new Date(0);
      const bTime = b.respondedAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    })
    .slice(0, 3);

  // Days until wedding (null if no date set)
  const daysUntil = invitation?.weddingDate
    ? Math.ceil((new Date(invitation.weddingDate + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const groomFirst  = invitation?.groomName?.first || "";
  const brideFirst  = invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : null;

  // Filtered guest list for the table
  const filtered = guests.filter(g =>
    g.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    g.rsvpStatus?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">

      {/* Sidebar — visible on desktop only */}
      <Sidebar invitation={invitation} onLogout={handleLogout} />

      {/* Main content area */}
      <main className="flex-1 min-h-screen overflow-y-auto">

        {/* Mobile top bar — only shows when sidebar is hidden */}
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

        <div className="px-6 lg:px-10 py-8 max-w-5xl mx-auto">

          {/* Welcome heading */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              Welcome back{userProfile?.name ? `, ${userProfile.name}` : ""}!
            </h1>
            {daysUntil !== null && daysUntil > 0 ? (
              <p className="text-muted-foreground mt-1">
                Your wedding is in{" "}
                <span className="font-semibold text-primary">{daysUntil} days</span>.
                {" "}Here's your overview.
              </p>
            ) : (
              <p className="text-muted-foreground mt-1">
                {!invitation
                  ? <>Get started by filling in your <Link to="/wedding-details" className="text-primary underline">wedding details</Link>.</>
                  : "Here's your overview."}
              </p>
            )}
          </div>

          {/* ── Two column: Invitation preview + RSVP progress ── */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">

            {/* My Invitation */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-foreground">My Invitation</h2>
                <button
                  onClick={() => {
                    if (coupleNames) {
                      navigator.clipboard.writeText(window.location.origin);
                      alert("Link copied!");
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Share2 size={13} /> Share
                </button>
              </div>

              {/* Mini invitation preview */}
              <div className="bg-muted/60 rounded-xl border border-border/30 p-6 text-center mb-4 min-h-[160px] flex flex-col items-center justify-center">
                {coupleNames ? (
                  <>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      Together with their families
                    </p>
                    <h3 className="font-heading text-2xl font-semibold text-foreground italic mb-2">
                      {groomFirst} &<br />{brideFirst}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Request the pleasure of your company
                    </p>
                    {invitation?.weddingDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
                          month: "long", day: "numeric", year: "numeric",
                        })}
                        {invitation?.ceremonyTime && ` · ${invitation.ceremonyTime}`}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">No invitation set up yet</p>
                    <Link to="/wedding-details" className="text-xs text-primary underline hover:no-underline">
                      Add wedding details →
                    </Link>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Link to="/create-invitation" className="flex-1">
                  <Button variant="default" className="w-full rounded-xl gap-2" size="sm">
                    <Eye size={14} /> Preview
                  </Button>
                </Link>
                <Link to="/create-invitation" className="flex-1">
                  <Button variant="outline" className="w-full rounded-xl gap-2 border-border/60" size="sm">
                    <Pencil size={14} /> Edit Invitation
                  </Button>
                </Link>
              </div>
            </div>

            {/* RSVP Progress */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
              <h2 className="text-base font-semibold text-foreground mb-4">RSVP Progress</h2>

              {/* Donut chart */}
              <div className="flex items-center gap-6 mb-5">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          total > 0
                            ? rsvpChartData
                            : [{ name: "empty", value: 1, color: "hsl(32, 20%, 88%)" }]
                        }
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={58}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {(total > 0 ? rsvpChartData : [{ color: "hsl(32, 20%, 88%)" }]).map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Percentage in center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="font-heading text-xl font-bold text-foreground leading-tight">{progress}%</p>
                      <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3F5F47]" />
                    <span className="font-medium text-foreground">{accepted}</span>
                    <span className="text-muted-foreground">Accepted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C9666E]" />
                    <span className="font-medium text-foreground">{declined}</span>
                    <span className="text-muted-foreground">Declined</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D09B45]" />
                    <span className="font-medium text-foreground">{pending}</span>
                    <span className="text-muted-foreground">Pending</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1.5 border-t border-border/40">
                    <span className="font-medium text-foreground">{total}</span>
                    <span className="text-muted-foreground">Invitations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{attending}</span>
                    <span className="text-muted-foreground">Attending (incl. plus-ones)</span>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="space-y-0.5 border-t border-border/40 pt-3">
                <button className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-foreground text-left">
                  <Bell size={14} className="text-muted-foreground" /> Set Reminders
                </button>
                <Link to="/wedding-details"
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-foreground">
                  <Pencil size={14} className="text-muted-foreground" /> Edit Wedding Details
                </Link>
                <Link to="/guest-list"
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-foreground">
                  <UserRound size={14} className="text-muted-foreground" /> Edit Guest List
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recent RSVPs — only shows if anyone has responded ── */}
          {recentRSVPs.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-8">
              <h2 className="text-base font-semibold text-foreground mb-4">Recent RSVPs</h2>
              <div className="space-y-3">
                {recentRSVPs.map(g => (
                  <div key={g.inviteeId} className="flex items-center gap-3">
                    {/* Avatar with initials */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(g.guestName)}`}>
                      {getInitials(g.guestName)}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">{g.guestName}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${statusBadge(g.rsvpStatus)}`}>
                      {g.rsvpStatus}
                    </span>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {timeAgo(g.respondedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Guest List table ── */}
          <div id="guest-list-section">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
              <h2 className="font-heading text-xl font-semibold text-foreground uppercase tracking-wider">
                Guest List
              </h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search guests..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-card border-border/60 rounded-xl w-full sm:w-60" />
                </div>
                {/* Guest management lives on the Guest List page */}
                <Link to="/guest-list">
                  <Button variant="outline" size="sm"
                    className="rounded-xl gap-2 border-border/60 whitespace-nowrap">
                    <UserRound size={15} /> Manage Guests
                  </Button>
                </Link>
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
                <Users size={36} className="mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-heading text-lg text-foreground mb-1">
                  {search ? "No guests match your search" : "No guests yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {search ? "Try a different search term" : (
                    <>Add guests from the <Link to="/guest-list" className="text-primary underline hover:no-underline">Guest List</Link> page.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      {["Name", "RSVP Status", "Meal / Dietary", "Plus One", "RSVP Link"].map(h => (
                        <th key={h}
                          className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(g => (
                      <tr key={g.inviteeId}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                        {/* Name + avatar */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(g.guestName)}`}>
                              {getInitials(g.guestName)}
                            </div>
                            <span className="font-medium text-foreground">{g.guestName}</span>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(g.rsvpStatus)}`}>
                            {g.rsvpStatus}
                          </span>
                        </td>
                        {/* Meal + Dietary / Allergies — kept as separate lines */}
                        <td className="px-5 py-4 text-muted-foreground">
                          {(() => {
                            const meal = getMealLabel(g, invitation?.mealOptions);
                            const dietary = (g.dietaryRestrictions || "").trim();
                            if (!meal && !dietary) return "—";
                            return (
                              <div className="space-y-0.5 text-xs leading-snug">
                                {meal && <p><span className="text-muted-foreground/70">Meal: </span><span className={`text-foreground ${g.mealId ? "" : "capitalize"}`}>{meal}</span></p>}
                                {dietary && <p><span className="text-muted-foreground/70">Dietary / Allergies: </span><span className="text-foreground">{dietary}</span></p>}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Plus one — show Yes/No like the Figma wireframe */}
                        <td className="px-5 py-4 text-muted-foreground">
                          {g.plusOneLimit > 0 ? (
                            <span className="text-primary font-medium">Yes</span>
                          ) : "No"}
                        </td>
                        {/* Copy RSVP link — each guest has a unique token */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => {
                              // URL includes both inviteeId and token so RSVP page can do a direct doc lookup
                            const link = `${window.location.origin}/rsvp/${g.inviteeId}/${g.token}`;
                              navigator.clipboard.writeText(link);
                              alert(`Copied!\n${link}`);
                            }}
                            className="text-xs text-primary hover:underline">
                            Copy link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
