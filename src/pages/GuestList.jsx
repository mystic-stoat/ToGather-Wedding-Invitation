// src/pages/GuestList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   A dedicated full-page guest list matching the Figma wireframe.
//   Shows all guests with their RSVP status, email, group, plus one,
//   and meal/dietary info. Supports search, filter by status, add, and delete.
//
// DATA FLOW:
//   1. Load invitation from `invitations` to get weddingId
//   2. Load all guests from `invitee` collection using weddingId
//   3. Each guest row shows their RSVP status and dietary/meal info
//   4. Plus one details (names + meals) expand when you click a guest row
//
// COLUMNS (matching Figma wireframe):
//   Name | Email | Group | Plus One | RSVP | Meal/Dietary
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Search, Trash2, Loader2,
  ChevronDown, ChevronUp, Heart, LayoutDashboard,
  Gift, MapPin, CalendarCheck, Mail, Smartphone,
  ChevronRight, LogOut, UserRound, Pencil,
  Download, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser,
  getInvitees,
  addInvitee,
  deleteInvitee,
} from "@/lib/firestore";
import Logo from "@/assets/logo.svg";


// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns initials from a name e.g. "Emma Thompson" → "ET"
const getInitials = (name = "") =>
  name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

// Returns a consistent color for the avatar based on first letter
const avatarColor = (name = "") => {
  const colors = [
    "bg-primary/20 text-primary",
    "bg-accent/20 text-accent",
    "bg-secondary/20 text-secondary",
    "bg-blue-100 text-blue-600",
    "bg-orange-100 text-orange-600",
    "bg-purple-100 text-purple-600",
  ];
  return colors[name.charCodeAt(0) % colors.length];
};

// Returns Tailwind classes for the RSVP status badge — exact Figma hex
const statusBadge = (status) => {
  const map = {
    Accepted: "bg-[#E6EFEA] text-[#3C6B54] border border-[#3C6B54]/15",
    Declined: "bg-[#F7E6E6] text-[#C9666E] border border-[#C9666E]/20",
    Pending:  "bg-[#FDF3E1] text-[#D09B45] border border-[#D09B45]/25",
  };
  return map[status] || "bg-muted text-muted-foreground border border-border";
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
// Same sidebar as Dashboard for consistent navigation
const Sidebar = ({ invitation, onLogout }) => {
  const groomFirst  = invitation?.groomName?.first || "";
  const brideFirst  = invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : null;
  const weddingDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
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

        <Heart size={16} className="text-primary" />
        <img src={Logo} className="h-8 w-auto"/>

        <span className="font-heading text-lg font-semibold text-foreground">ToGather</span>
      </div>
      <p className="text-xs text-muted-foreground px-1 mb-8">Plan the day. Share the joy.</p>

      <nav className="flex-1 space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Overview</p>
          <NavItem to="/dashboard"   icon={LayoutDashboard} label="Dashboard" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Planning</p>
          <div className="space-y-0.5">
            <NavItem to="/wedding-details" icon={Heart}        label="Wedding Details" />
            <NavItem to="/guest-list"      icon={Users}        label="Guest List"      active />
            <NavItem to="/dashboard"       icon={Gift}         label="Registry" />
            <NavItem to="/dashboard"       icon={MapPin}       label="Travel & Stay" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Invitations</p>
          <div className="space-y-0.5">
            <NavItem to="/dashboard"         icon={CalendarCheck} label="Save the Date" />
            <NavItem to="/dashboard"         icon={Mail}          label="Paper Invitations" />
            <NavItem to="/create-invitation" icon={Smartphone}    label="Mobile Invitation" />
          </div>
        </div>
      </nav>

      <div className="space-y-3 mt-6">
        {coupleNames && (
          <div className="bg-primary/8 rounded-xl px-3 py-3 border border-primary/15">
            <p className="text-sm font-semibold text-foreground">{coupleNames}</p>
            {weddingDate && <p className="text-xs text-muted-foreground mt-0.5">{weddingDate}</p>}
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

// ── Add Guest Modal ───────────────────────────────────────────────────────────
const AddGuestModal = ({ onAdd, onClose, saving }) => {
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [group, setGroup]               = useState("Family");
  const [plusOneLimit, setPlusOneLimit] = useState(0);
  const [error, setError]               = useState("");

  const handleSubmit = () => {
    if (!name.trim()) { setError("Guest name is required."); return; }
    onAdd(name.trim(), email.trim(), group, Number(plusOneLimit));
  };

  const groups = ["Family", "Friends", "Coworkers", "Other"];

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-sm space-y-5">
        <h3 className="font-heading text-lg font-semibold text-foreground italic">Add a Guest</h3>

        {/* Guest name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Guest Name *</label>
          <Input placeholder="Full name" value={name} autoFocus
            onChange={e => { setName(e.target.value); setError(""); }}
            className="h-11 bg-background border-border/60 rounded-xl" />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Email <span className="text-muted-foreground/60 font-normal">(optional)</span>
          </label>
          <Input type="email" placeholder="guest@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-11 bg-background border-border/60 rounded-xl" />
        </div>

        {/* Group */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Group</label>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <button key={g} onClick={() => setGroup(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  group === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border/60 hover:border-primary/40"
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Plus one limit */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Plus One Limit</label>
          <div className="flex gap-2">
            {[0,1,2,3].map(n => (
              <button key={n} onClick={() => setPlusOneLimit(n)}
                className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                  plusOneLimit === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-foreground hover:border-primary/40"
                }`}>
                {n === 0 ? "None" : `+${n}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Max extra guests this person can bring.</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button variant="default" className="flex-1 rounded-xl" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Adding...</span>
              : "Add Guest"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Guest Row ─────────────────────────────────────────────────────────────────
// Each guest row — click to expand and see plus one details
const GuestRow = ({ guest, onDelete, deleting, onCopyLink }) => {
  // expanded shows the plus one details below the row
  const [expanded, setExpanded] = useState(false);

  // Parse plus ones — stored as JSON string or array in Firestore
  const plusOnes = Array.isArray(guest.plusOnes)
    ? guest.plusOnes
    : [];

  const hasPlusOnes = plusOnes.length > 0;

  return (
    <>
      {/* Main guest row */}
      <tr
        onClick={() => hasPlusOnes && setExpanded(!expanded)}
        className={`border-b border-border/30 last:border-0 transition-colors ${
          hasPlusOnes ? "cursor-pointer hover:bg-muted/20" : "hover:bg-muted/10"
        }`}
      >
        {/* Name + avatar */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(guest.guestName)}`}>
              {getInitials(guest.guestName)}
            </div>
            <p className="font-medium text-foreground text-sm">{guest.guestName}</p>
          </div>
        </td>

        {/* Email — separate column matching Figma wireframe */}
        <td className="px-5 py-4 text-sm text-muted-foreground">
          {guest.email || <span className="text-muted-foreground/40">—</span>}
        </td>

        {/* Group */}
        <td className="px-5 py-4">
          {guest.group ? (
            <span className="text-xs bg-muted px-2 py-1 rounded-lg text-muted-foreground font-medium">
              {guest.group}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </td>

        {/* Plus one */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">
              {guest.plusOneLimit > 0 ? `+${guest.plusOneLimit} allowed` : "None"}
            </span>
            {/* Show expand arrow if they brought plus ones */}
            {hasPlusOnes && (
              <span className="text-primary">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            )}
          </div>
        </td>

        {/* RSVP status badge */}
        <td className="px-5 py-4">
          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(guest.rsvpStatus)}`}>
            {guest.rsvpStatus}
          </span>
        </td>

        {/* Meal / Dietary */}
        <td className="px-5 py-4 text-sm text-muted-foreground max-w-[180px]">
          {guest.dietaryRestrictions || "—"}
        </td>

        {/* Actions */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            {/* Copy RSVP link */}
            <button
              onClick={e => { e.stopPropagation(); onCopyLink(guest); }}
              className="text-xs text-primary hover:underline whitespace-nowrap"
              title="Copy guest's RSVP link">
              Copy link
            </button>
            {/* Delete */}
            {deleting ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onDelete(guest.inviteeId); }}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Remove guest">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded plus one details */}
      {expanded && hasPlusOnes && (
        <tr className="bg-muted/20 border-b border-border/30">
          <td colSpan={7} className="px-5 py-3">
            <div className="ml-11 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Plus Ones
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {plusOnes.map((po, i) => (
                  <div key={i}
                    className="flex items-center gap-3 bg-card rounded-xl px-3 py-2 border border-border/40">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(po.name || "Guest")}`}>
                      {getInitials(po.name || "G")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{po.name || "Guest"}</p>
                      {po.meal && (
                        <p className="text-xs text-muted-foreground capitalize">{po.meal}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Main GuestList Page ───────────────────────────────────────────────────────
const GuestList = () => {
  // const { user, logout } = useAuth();
  const { user, userProfile, logout } = useAuth();
  const navigate         = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [invitation, setInvitation]       = useState(null);
  const [guests, setGuests]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("All"); // All, Accepted, Declined, Pending
  const [showAddModal, setShowAddModal]   = useState(false);
  const [addingSaving, setAddingSaving]   = useState(false);
  const [deletingId, setDeletingId]       = useState(null);

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
      console.error("GuestList load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Add a guest ────────────────────────────────────────────────────────────
  const handleAddGuest = async (name, email, group, plusOneLimit) => {
    if (!invitation?.weddingId) return;
    setAddingSaving(true);
    try {
      // addInvitee creates the Firestore doc and generates a unique RSVP token
      await addInvitee(invitation.weddingId, name, plusOneLimit, email, group);
      const updated = await getInvitees(invitation.weddingId);
      setGuests(updated);
      setShowAddModal(false);
    } catch (err) {
      console.error("Add guest error:", err);
      alert("Add guest failed: " + err.message);
    } finally {
      setAddingSaving(false);
    }
  };

  // ── Delete a guest ─────────────────────────────────────────────────────────
  const handleDeleteGuest = async (inviteeId) => {
    if (!window.confirm("Remove this guest?")) return;
    setDeletingId(inviteeId);
    try {
      await deleteInvitee(inviteeId);
      setGuests(prev => prev.filter(g => g.inviteeId !== inviteeId));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Copy RSVP link ─────────────────────────────────────────────────────────
  const handleCopyLink = (guest) => {
    const link = `${window.location.origin}/rsvp/${guest.inviteeId}/${guest.token}`;
    navigator.clipboard.writeText(link);
    alert(`RSVP link copied!\n${link}`);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ── Computed stats ─────────────────────────────────────────────────────────
  const total    = guests.length;
  const accepted = guests.filter(g => g.rsvpStatus === "Accepted").length;
  const declined = guests.filter(g => g.rsvpStatus === "Declined").length;
  const pending  = guests.filter(g => g.rsvpStatus === "Pending").length;

  // ── Filter guests by search + status ──────────────────────────────────────
  const filtered = guests.filter(g => {
    const matchesSearch = g.guestName?.toLowerCase().includes(search.toLowerCase()) ||
      g.email?.toLowerCase().includes(search.toLowerCase()) ||
      g.group?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || g.rsvpStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading guest list...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">

      {/* Sidebar navigation */}
      <Sidebar invitation={invitation} onLogout={handleLogout} />

      {/* Add Guest Modal */}
      {showAddModal && (
        <AddGuestModal
          onAdd={handleAddGuest}
          onClose={() => setShowAddModal(false)}
          saving={addingSaving}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">

        {/* Mobile top bar */}
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

        <div className="px-6 lg:px-10 py-8 max-w-6xl mx-auto">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-semibold text-foreground">Guest List</h1>
              {/* Subtitle showing total count */}
              <p className="text-sm text-muted-foreground mt-1">
                {total} {total === 1 ? "guest" : "guests"} · Manage and track RSVPs
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {/* Export CSV — placeholder for future feature */}
              <Button variant="outline" size="sm" className="rounded-xl gap-2 border-border/60">
                <Download size={15} /> Export CSV
              </Button>
              <Button variant="default" size="sm" className="rounded-xl gap-2"
                onClick={() => {
                  if (!invitation?.weddingId) {
                    alert("Please fill in your wedding details first.");
                    return;
                  }
                  setShowAddModal(true);
                }}>
                <UserPlus size={15} /> Add Guest
              </Button>
            </div>
          </div>

          {/* Stats bar — quick summary above the table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total",    value: total,    color: "text-foreground",   bg: "bg-card" },
              { label: "Accepted", value: accepted, color: "text-primary",      bg: "bg-primary/8" },
              { label: "Declined", value: declined, color: "text-destructive",  bg: "bg-destructive/8" },
              { label: "Pending",  value: pending,  color: "text-amber-600",    bg: "bg-amber-50" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-border/40 px-4 py-3`}>
                <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search guests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 bg-card border-border/60 rounded-xl"
              />
            </div>

            {/* Status filter buttons */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground flex-shrink-0" />
              {["All", "Accepted", "Declined", "Pending"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Guest table */}
          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <Users size={36} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-heading text-lg text-foreground mb-1">
                {search || statusFilter !== "All" ? "No guests match your filters" : "No guests yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== "All"
                  ? "Try adjusting your search or filter"
                  : `Click "Add Guest" to start building your list`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {["Name", "Email", "Group", "Plus One", "RSVP", "Meal / Dietary", ""].map(h => (
                      <th key={h}
                        className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <GuestRow
                      key={g.inviteeId}
                      guest={g}
                      onDelete={handleDeleteGuest}
                      deleting={deletingId === g.inviteeId}
                      onCopyLink={handleCopyLink}
                    />
                  ))}
                </tbody>
              </table>

              {/* Table footer showing count */}
              <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {total} guests
                  {statusFilter !== "All" && ` · Filtered by: ${statusFilter}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GuestList;
