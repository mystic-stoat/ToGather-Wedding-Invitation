// src/pages/WeddingDetails.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Lets the host fill in and save their wedding information.
//   On load, it checks Firestore for an existing invitation document.
//   On save, it either creates a new document or updates the existing one.
//
// FIRESTORE COLLECTION: `invitations`
// FIELDS SAVED: groomName, brideName, weddingDate, ceremonyTime,
//               inviteDeadline, venueName, venueAddress,
//               colorPalette1, colorPalette2, font1, font2
//
// LAYOUT NOTE: this follows the same sidebar + main-content shell as
// Dashboard.jsx. Two things below are reconstructed from the migration plan
// rather than copied from Dashboard.jsx/Sidebar.jsx directly (those files
// weren't available while editing this one):
//   1. The shape of the `invitation` object passed into <Sidebar />.
//   2. The mobile hamburger -> drawer behavior (Dashboard's exact markup for
//      this wasn't specified, just "hidden lg:flex" for the sidebar itself).
// If these don't match the real Sidebar/Dashboard implementation, share those
// two files and this can be tightened up to match exactly.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, CheckCircle2, Loader2, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser, saveInvitation } from "@/lib/firestore";
import Sidebar from "@/components/Sidebar";

// ── Reusable labeled form field wrapper ───────────────────────────────────────
const FormField = ({ label, children, error, helper }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    {children}
    {helper && !error && <p className="text-xs text-muted-foreground">{helper}</p>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const inputCls =
  "h-12 border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ── Default empty form — used before any data loads or on first visit ─────────
const EMPTY = {
  groomName: { first: "", middle: "", last: "" },
  brideName: { first: "", middle: "", last: "" },
  ceremonyTime: "",
  venueName: "",
  venueAddress: "",
  weddingDate: "",
  inviteDeadline: "",
  colorPalette1: "#7a9e7e", // matches ToGather's sage green theme
  colorPalette2: "#f5f0eb", // matches ToGather's warm beige theme
  font1: "Playfair Display",
  font2: "DM Sans",
  gif: "",
};

const WeddingDetails = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // form state — holds all the field values the user is editing
  const [form, setForm] = useState(EMPTY);

  // weddingId — the Firestore document ID of their invitation.
  // undefined means they haven't created one yet (first save will create it).
  const [weddingId, setWeddingId] = useState(undefined);

  // the raw invitation record as loaded from Firestore (separate from `form`
  // since Sidebar needs the whole record, not just the editable fields)
  const [invitationData, setInvitationData] = useState(null);

  // UI state for loading, saving, save confirmation, and load failures
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ── Load existing invitation when the page mounts ──────────────────────────
  useEffect(() => {
    if (!user) return; // shouldn't happen (protected route), but safety check

    (async () => {
      try {
        const invitation = await getInvitationByUser(user.uid);
        if (invitation) {
          setWeddingId(invitation.weddingId);
          setInvitationData(invitation);

          setForm({
            groomName: invitation.groomName ?? EMPTY.groomName,
            brideName: invitation.brideName ?? EMPTY.brideName,
            ceremonyTime: invitation.ceremonyTime ?? "",
            venueName: invitation.venueName ?? "",
            venueAddress: invitation.venueAddress ?? "",
            weddingDate: invitation.weddingDate ?? "",
            inviteDeadline: invitation.inviteDeadline ?? "",
            colorPalette1: invitation.colorPalette1 ?? EMPTY.colorPalette1,
            colorPalette2: invitation.colorPalette2 ?? EMPTY.colorPalette2,
            font1: invitation.font1 ?? EMPTY.font1,
            font2: invitation.font2 ?? EMPTY.font2,
            gif: invitation.gif ?? "",
          });
        }
        // If invitation is null they're a new user — form stays as EMPTY defaults
      } catch (err) {
        console.error("Failed to load wedding details:", err);
        setLoadError("We couldn't load your saved details. You can still fill out the form below and save.");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user]);

  // ── Update a top-level string field ────────────────────────────────────────
  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // ── Update a nested name field ──────────────────────────────────────────────
  const setName = (partner, part, value) =>
    setForm(prev => ({ ...prev, [partner]: { ...prev[partner], [part]: value } }));

  // ── Validation handler ─────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};

    if (!form.groomName.first.trim()) errors["groomName.first"] = "First name is required.";
    if (!form.brideName.first.trim()) errors["brideName.first"] = "First name is required.";
    if (!form.weddingDate) errors.weddingDate = "Wedding date is required.";
    if (!form.ceremonyTime) errors.ceremonyTime = "Ceremony time is required.";
    if (!form.inviteDeadline) errors.inviteDeadline = "RSVP deadline is required.";

    if (form.weddingDate && form.inviteDeadline && form.inviteDeadline > form.weddingDate) {
      errors.inviteDeadline = "RSVP deadline must be on or before the wedding date.";
    }

    if (!form.venueName.trim()) errors.venueName = "Venue name is required.";
    if (!form.venueAddress.trim()) errors.venueAddress = "Venue address is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;

    setSaveError("");
    setSaved(false);

    if (!validateForm()) {
      setSaveError("Please complete the required fields before saving.");
      return;
    }

    setSaving(true);
    try {
      const id = await saveInvitation(user.uid, { ...form, isPublished: false }, weddingId);
      if (!weddingId) setWeddingId(id);

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        navigate("/dashboard");
      }, 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError("Failed to save. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Logout handler ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // ── Loading state (page-level, before anything Firestore-dependent renders) ─
  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  const saveButton = (
    <Button
      variant="default"
      className= "w-full rounded-xl"
      size="default"
      onClick={handleSave}
      disabled={saving}
    >
      {saving ? (
        <>
          <Loader2 size={16} className="animate-spin" /> Saving...
        </>
      ) : saved ? (
        <>
          <CheckCircle2 size={16} /> Saved!
        </>
      ) : (
        <>
          <Save size={16} /> Save
        </>
      )}
    </Button>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — persistent on desktop, hidden on mobile (Dashboard pattern) */}
      <div className="hidden lg:flex">
        <Sidebar invitation={invitationData} onLogout={handleLogout} />
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 h-full bg-card shadow-xl">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>
            <Sidebar invitation={invitationData} onLogout={handleLogout} />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between border-b border-border/50 bg-card/60 px-4 py-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="font-heading text-lg font-semibold text-foreground">Wedding Details</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>

        <div className="px-6 lg:px-10 py-8 max-w-5xl mx-auto space-y-10">
          {loadError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 space-y-8">
            {/* Desktop title + save row */}
            <div className="hidden lg:flex items-center justify-between">
              <div>
                <h1 className="font-heading text-2xl font-semibold text-foreground">Wedding Details</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Core information that populates your invitations</p>
              </div>
            </div>

            {/* Mobile save row (title lives in the top bar above) */}
            <div className="lg:hidden flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Core information that populatores your invitations</p>
              <div className="flex items-center gap-3 ml-auto">
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                {saveButton}
              </div>
            </div>

            {/* ── Partner Names ── */}
            <section className="space-y-6">
              <h2 className="font-heading text-xl font-semibold text-foreground">Partner Names</h2>

              <FormField label="Partner One's name" error={fieldErrors["groomName.first"]}>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="First"
                    value={form.groomName.first}
                    onChange={e => setName("groomName", "first", e.target.value)}
                    className={inputCls}
                  />
                  <Input
                    placeholder="Middle"
                    value={form.groomName.middle}
                    onChange={e => setName("groomName", "middle", e.target.value)}
                    className={inputCls}
                  />
                  <Input
                    placeholder="Last"
                    value={form.groomName.last}
                    onChange={e => setName("groomName", "last", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </FormField>

              <FormField label="Partner Two's name" error={fieldErrors["brideName.first"]}>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="First"
                    value={form.brideName.first}
                    onChange={e => setName("brideName", "first", e.target.value)}
                    className={inputCls}
                  />
                  <Input
                    placeholder="Middle"
                    value={form.brideName.middle}
                    onChange={e => setName("brideName", "middle", e.target.value)}
                    className={inputCls}
                  />
                  <Input
                    placeholder="Last"
                    value={form.brideName.last}
                    onChange={e => setName("brideName", "last", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </FormField>
            </section>

            {/* ── Date & Time ── */}
            <section className="space-y-6">
              <h2 className="font-heading text-xl font-semibold text-foreground">Date & Time</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Wedding Date" error={fieldErrors.weddingDate}>
                  <Input
                    type="date"
                    value={form.weddingDate}
                    onChange={e => set("weddingDate", e.target.value)}
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Ceremony Time" error={fieldErrors.ceremonyTime}>
                  <Input
                    type="time"
                    value={form.ceremonyTime}
                    onChange={e => set("ceremonyTime", e.target.value)}
                    className={inputCls}
                  />
                </FormField>
              </div>

              <FormField
                label="RSVP Deadline"
                error={fieldErrors.inviteDeadline}
                helper="Guests won't be able to RSVP after this date."
              >
                <Input
                  type="date"
                  value={form.inviteDeadline}
                  onChange={e => set("inviteDeadline", e.target.value)}
                  className={inputCls}
                />
              </FormField>
            </section>

            {/* ── Venue ── */}
            <section className="space-y-6">
              <h2 className="font-heading text-xl font-semibold text-foreground">Venue & Location</h2>

              <FormField label="Venue Name" error={fieldErrors.venueName}>
                <Input
                  placeholder="The Grand Pavilion"
                  value={form.venueName}
                  onChange={e => set("venueName", e.target.value)}
                  className={inputCls}
                />
              </FormField>

              <FormField label="Venue Address" error={fieldErrors.venueAddress}>
                <Input
                  placeholder="123 Garden Lane, Austin, TX 78701"
                  value={form.venueAddress}
                  onChange={e => set("venueAddress", e.target.value)}
                  className={inputCls}
                />
              </FormField>
            </section>

            {/* ── Invitation Style ── */}
            {/* These values are used by CreateInvitation.tsx to style the invitation */}
            <section className="space-y-6">
              <h2 className="font-heading text-xl font-semibold text-foreground">Invitation Style</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Primary Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.colorPalette1}
                      onChange={e => set("colorPalette1", e.target.value)}
                      className="w-12 h-12 rounded-xl border border-border/60 cursor-pointer bg-background p-1"
                    />
                    <Input
                      value={form.colorPalette1}
                      onChange={e => set("colorPalette1", e.target.value)}
                      className={inputCls}
                      placeholder="#7a9e7e"
                    />
                  </div>
                </FormField>

                <FormField label="Secondary Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.colorPalette2}
                      onChange={e => set("colorPalette2", e.target.value)}
                      className="w-12 h-12 rounded-xl border border-border/60 cursor-pointer bg-background p-1"
                    />
                    <Input
                      value={form.colorPalette2}
                      onChange={e => set("colorPalette2", e.target.value)}
                      className={inputCls}
                      placeholder="#f5f0eb"
                    />
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Heading Font">
                  <Select value={form.font1} onValueChange={v => set("font1", v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select font..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                      <SelectItem value="Cormorant Garamond">Cormorant Garamond</SelectItem>
                      <SelectItem value="Great Vibes">Great Vibes</SelectItem>
                      <SelectItem value="Libre Baskerville">Libre Baskerville</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Body Font">
                  <Select value={form.font2} onValueChange={v => set("font2", v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select font..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="DM Sans">DM Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Nunito">Nunito</SelectItem>
                      <SelectItem value="Source Sans 3">Source Sans 3</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="flex items-center gap-3">
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                {saveButton}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WeddingDetails;