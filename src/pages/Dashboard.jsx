// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The main hub after login. Shows the host:
//     - A welcome message with their name and days until the wedding
//     - Summary cards: total guests, confirmed, pending, declined
//     - RSVP status pie chart (live from Firestore)
//     - Meal preference pie chart (live from Firestore)
//     - Full guest list with search, add, and delete
//
// DATA FLOW:
//   1. On load → fetch invitation from `invitations` collection (to get weddingId)
//   2. Use weddingId → fetch all guests from `invitee` collection
//   3. Calculate stats from guest data (no hardcoded numbers)
//   4. Add Guest → calls addInvitee() in firestore.js → re-fetches list
//   5. Delete Guest → calls deleteInvitee() in firestore.js → re-fetches list
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import ScrollReveal from "@/components/ScrollReveal";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Users, CheckCircle2, Clock, XCircle,
  Search, UserPlus, Trash2, Loader2, AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser, // fetches the invitation to get weddingId
  getInvitees,         // fetches all guests for a weddingId
  addInvitee,          // adds a new guest
  deleteInvitee,       // removes a guest
} from "@/lib/firestore";

// ── Color helpers ─────────────────────────────────────────────────────────────

// Returns the right Tailwind classes for each RSVP status badge
const statusBadge = (status) => {
  const map = {
    Accepted: "bg-primary/15 text-primary border-primary/20",
    Pending:  "bg-accent/20 text-accent border-accent/20",
    Declined: "bg-destructive/15 text-destructive border-destructive/20",
  };
  return map[status] || "bg-muted text-muted-foreground border-border";
};

// ── Reusable chart card ───────────────────────────────────────────────────────
// Renders a donut chart with a legend for RSVP or meal data
const ChartCard = ({ title, data }) => (
  <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-md shadow-foreground/[0.03]">
    <h3 className="font-heading text-base font-semibold text-foreground mb-4">{title}</h3>
    {/* Show empty state if no data yet */}
    {data.every(d => d.value === 0) ? (
      <div className="flex items-center justify-center h-28 text-sm text-muted-foreground">
        No data yet
      </div>
    ) : (
      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="w-28 h-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={28} outerRadius={48}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(24, 26%, 92%)"
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 20% 95%)",
                  border: "1px solid hsl(24 16% 84%)",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2.5 text-sm">
              <span className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.value}</span>
              <span className="text-foreground font-medium">·</span>
              <span className="text-foreground">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Add Guest Modal ───────────────────────────────────────────────────────────
// Simple inline form for adding a new guest
const AddGuestModal = ({ onAdd, onClose, saving }) => {
  const [name, setName]               = useState("");
  const [plusOneLimit, setPlusOneLimit] = useState(0);
  const [error, setError]             = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Guest name is required.");
      return;
    }
    onAdd(name.trim(), Number(plusOneLimit));
  };

  return (
    // Backdrop
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-sm space-y-5">
        <h3 className="font-heading text-lg font-semibold text-foreground italic">
          Add a Guest
        </h3>

        {/* Guest name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Guest Name *
          </label>
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            className="h-11 bg-background border-border/60 rounded-xl"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Plus one limit */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Plus One Limit
          </label>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setPlusOneLimit(n)}
                className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                  plusOneLimit === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-foreground hover:border-primary/40"
                }`}
              >
                {n === 0 ? "None" : `+${n}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Max extra guests this person can bring.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1 rounded-xl"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Adding...
              </span>
            ) : "Add Guest"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard Component ──────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth(); // get logged-in user from AuthContext

  // ── State ──────────────────────────────────────────────────────────────────
  const [invitation, setInvitation]   = useState(null);  // wedding details
  const [guests, setGuests]           = useState([]);     // guest list from Firestore
  const [loading, setLoading]         = useState(true);   // initial data load
  const [loadError, setLoadError]     = useState("");     // load failure message
  const [search, setSearch]           = useState("");     // search box value
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [deletingId, setDeletingId]   = useState(null);  // ID of guest being deleted

  // ── Load data on mount ─────────────────────────────────────────────────────
  // useEffect runs once after the component renders.
  // Fetches invitation first (to get weddingId), then fetches guests.
  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      // Step 1: Get this user's invitation (gives us the weddingId)
      const inv = await getInvitationByUser(user.uid);
      setInvitation(inv);

      // Step 2: If they have an invitation, load the guest list
      if (inv?.weddingId) {
        const guestList = await getInvitees(inv.weddingId);
        setGuests(guestList);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
      setLoadError("Failed to load your data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  // ── Add a guest ────────────────────────────────────────────────────────────
  const handleAddGuest = async (name, plusOneLimit) => {
    if (!invitation?.weddingId) return;
    setAddingSaving(true);
    try {
      // addInvitee creates the Firestore doc and generates a unique RSVP token
      await addInvitee(invitation.weddingId, name, plusOneLimit);
      // Re-fetch the guest list so the new guest appears
      const updated = await getInvitees(invitation.weddingId);
      setGuests(updated);
      setShowAddModal(false);
    } catch (err) {
      console.error("Add guest error:", err);
    } finally {
      setAddingSaving(false);
    }
  };

  // ── Delete a guest ─────────────────────────────────────────────────────────
  const handleDeleteGuest = async (inviteeId) => {
    if (!window.confirm("Remove this guest from the list?")) return;
    setDeletingId(inviteeId); // show spinner on that specific row
    try {
      await deleteInvitee(inviteeId);
      // Remove from local state immediately (no need to re-fetch)
      setGuests((prev) => prev.filter((g) => g.inviteeId !== inviteeId));
    } catch (err) {
      console.error("Delete guest error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Calculate stats from real guest data ───────────────────────────────────
  // These are computed on every render from the actual `guests` array
  const total    = guests.length;
  const accepted = guests.filter((g) => g.rsvpStatus === "Accepted").length;
  const declined = guests.filter((g) => g.rsvpStatus === "Declined").length;
  const pending  = guests.filter((g) => g.rsvpStatus === "Pending").length;

  // ── RSVP chart data ────────────────────────────────────────────────────────
  const rsvpChartData = [
    { name: "Accepted", value: accepted, color: "hsl(100, 14%, 49%)" },
    { name: "Pending",  value: pending,  color: "hsl(110, 16%, 61%)" },
    { name: "Declined", value: declined, color: "hsl(350, 80%, 72%)" },
  ];

  // ── Meal preference chart data ─────────────────────────────────────────────
  // Count how many accepted guests chose each meal
  const mealCounts = guests
    .filter((g) => g.rsvpStatus === "Accepted" && g.dietaryRestrictions)
    .reduce((acc, g) => {
      const meal = g.dietaryRestrictions || "No Preference";
      acc[meal] = (acc[meal] || 0) + 1;
      return acc;
    }, {});

  const mealColors = [
    "hsl(100, 14%, 49%)",
    "hsl(110, 16%, 61%)",
    "hsl(350, 56%, 84%)",
    "hsl(30, 60%, 65%)",
    "hsl(200, 40%, 60%)",
  ];

  const mealChartData = Object.entries(mealCounts).map(([name, value], i) => ({
    name,
    value,
    color: mealColors[i % mealColors.length],
  }));

  // ── Summary cards config ───────────────────────────────────────────────────
  const summaryCards = [
    { label: "Total Guests", value: total,    icon: Users,        color: "bg-primary/10 text-primary" },
    { label: "Confirmed",    value: accepted, icon: CheckCircle2, color: "bg-primary/10 text-primary" },
    { label: "Pending",      value: pending,  icon: Clock,        color: "bg-accent/15 text-accent" },
    { label: "Declined",     value: declined, icon: XCircle,      color: "bg-destructive/10 text-destructive" },
  ];

  // ── Days until wedding ─────────────────────────────────────────────────────
  const daysUntil = invitation?.weddingDate
    ? Math.ceil((new Date(invitation.weddingDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // ── Filtered guest list (search) ───────────────────────────────────────────
  const filtered = guests.filter((g) =>
    g.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    g.rsvpStatus?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Add Guest Modal — shown when showAddModal is true */}
      {showAddModal && (
        <AddGuestModal
          onAdd={handleAddGuest}
          onClose={() => setShowAddModal(false)}
          saving={addingSaving}
        />
      )}

      {/* Quick action bar */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3 overflow-x-auto">
          <Link to="/wedding-details">
            <Button variant="default" size="sm" className="rounded-xl whitespace-nowrap">
              Wedding Details
            </Button>
          </Link>
          <Link to="/create-invitation">
            <Button variant="default" size="sm" className="rounded-xl whitespace-nowrap">
              Create Invitation
            </Button>
          </Link>
          <Link to="/" className="ml-auto">
            <div className="bg-foreground rounded-xl px-4 py-1.5">
              <span className="font-heading text-base font-bold text-primary-foreground">ToGather</span>
            </div>
          </Link>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-6 py-10">

        {/* Error banner */}
        {loadError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{loadError}</p>
            <button onClick={loadDashboardData}
              className="ml-auto text-xs text-destructive underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Welcome heading */}
        <ScrollReveal>
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
              Welcome back, {user?.displayName?.split(" ")[0] || "there"}!
            </h1>
            {/* Show days until wedding if date is saved */}
            {daysUntil !== null && daysUntil > 0 && (
              <p className="text-muted-foreground mt-1">
                Your wedding is in{" "}
                <span className="font-semibold text-primary">{daysUntil} days</span>.
                {" "}Here's your overview.
              </p>
            )}
            {/* Prompt to fill in details if no invitation yet */}
            {!invitation && (
              <p className="text-muted-foreground mt-1">
                Get started by filling in your{" "}
                <Link to="/wedding-details" className="text-primary underline hover:no-underline">
                  wedding details
                </Link>.
              </p>
            )}
          </div>
        </ScrollReveal>

        {/* Summary stat cards */}
        <ScrollReveal delay={60}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {summaryCards.map((c) => (
              <div key={c.label}
                className="bg-card rounded-2xl border border-border/50 p-5 shadow-md shadow-foreground/[0.03] hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                    <c.icon size={20} />
                  </div>
                </div>
                {/* Real number from Firestore, not hardcoded */}
                <p className="font-heading text-2xl font-bold text-foreground tabular-nums">
                  {c.value}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* RSVP + Meal charts */}
        <ScrollReveal delay={120}>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <ChartCard title="RSVP Status"     data={rsvpChartData} />
            <ChartCard title="Meal Preference" data={mealChartData.length > 0 ? mealChartData : [{ name: "No responses yet", value: 0, color: "#ccc" }]} />
          </div>
        </ScrollReveal>

        {/* Guest List */}
        <ScrollReveal delay={180}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-heading text-xl font-semibold text-foreground uppercase tracking-wider">
              Guest List
            </h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search box */}
              <div className="relative flex-1 sm:flex-initial">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-card border-border/60 rounded-xl w-full sm:w-64"
                />
              </div>
              {/* Add Guest button — opens modal */}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 border-border/60"
                onClick={() => {
                  // Can't add guests without an invitation set up
                  if (!invitation?.weddingId) {
                    alert("Please fill in your wedding details first.");
                    return;
                  }
                  setShowAddModal(true);
                }}
              >
                <UserPlus size={16} /> Add Guest
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <Users size={40} className="mx-auto text-muted-foreground/40 mb-4" />
              <p className="font-heading text-lg text-foreground mb-1">
                {search ? "No guests match your search" : "No guests yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Try a different search term"
                  : "Click \"Add Guest\" to start building your list"}
              </p>
            </div>
          ) : (
            /* Guest table */
            <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card shadow-md shadow-foreground/[0.03]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Name", "RSVP Status", "Meal", "Plus One Limit", "RSVP Link", ""].map((h) => (
                      <th key={h}
                        className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => (
                    <tr key={g.inviteeId}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors duration-150">

                      {/* Guest name */}
                      <td className="px-5 py-4 font-medium text-foreground">{g.guestName}</td>

                      {/* RSVP status badge */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge(g.rsvpStatus)}`}>
                          {g.rsvpStatus}
                        </span>
                      </td>

                      {/* Meal preference — only set after they RSVP */}
                      <td className="px-5 py-4 text-muted-foreground">
                        {g.dietaryRestrictions || "—"}
                      </td>

                      {/* Plus one limit set when adding the guest */}
                      <td className="px-5 py-4 text-muted-foreground">
                        {g.plusOneLimit > 0 ? `+${g.plusOneLimit}` : "None"}
                      </td>

                      {/* Copyable RSVP link — guests use this to RSVP */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/rsvp/${g.token}`;
                            navigator.clipboard.writeText(link);
                            alert(`RSVP link copied!\n${link}`);
                          }}
                          className="text-xs text-primary hover:underline"
                          title="Click to copy RSVP link"
                        >
                          Copy link
                        </button>
                      </td>

                      {/* Delete button */}
                      <td className="px-5 py-4">
                        {deletingId === g.inviteeId ? (
                          <Loader2 size={14} className="animate-spin text-muted-foreground" />
                        ) : (
                          <button
                            onClick={() => handleDeleteGuest(g.inviteeId)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove guest"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollReveal>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
