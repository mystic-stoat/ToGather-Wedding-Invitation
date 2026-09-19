// src/pages/WeddingDetailsEdit.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The Wedding Details EDIT FORM (route: /wedding-details/edit).
//   Lets the host fill in and save the fields shown in the Figma edit
//   reference. The read-only summary lives at /wedding-details
//   (see WeddingDetails.jsx).
//
// FIRESTORE COLLECTION: `invitations` (same doc as the summary screen)
// FIELDS THIS FORM OWNS AND SAVES:
//   groomName, brideName, eventTitle, weddingDate, weddingDateUndecided,
//   ceremonyTime, timeZone, ceremonyVenueName, receptionVenueName,
//   city, state — plus a backward-compatible mirror into the legacy
//   venueName/venueAddress fields still read by Dashboard/RSVP/CreateInvitation.
//
// DESIGN NOTE — fields intentionally NOT in this form:
//   Reception hours, cocktail hour/countdown toggles, dress code, wedding
//   website, and personal message appear on the summary screen but have no
//   control in the Figma edit-form reference (image 4) and no existing
//   editing UI anywhere else in the app. RSVP deadline and invitation
//   style (colors/fonts) DO have an existing editing surface — RSVP
//   deadline and colors/fonts remain editable from CreateInvitation.jsx.
//   None of these fields are included in the save payload below, so
//   Firestore's partial `updateDoc` merge leaves whatever is already
//   stored for them completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import { Save, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser, saveInvitation } from "@/lib/firestore";
import { TIME_ZONE_OPTIONS, DEFAULT_TIME_ZONE } from "@/utils/weddingDate";

// ── Reusable labeled form field wrapper ───────────────────────────────────────
// `id` links the <Label> to its control via htmlFor so the field has a real
// accessible name (screen readers + testing-library's getByLabelText) — the
// child input must be given the matching `id`.
const FormField = ({ id, label, children, error, helper }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-sm font-medium text-foreground">{label}</Label>
    {children}
    {helper && !error && <p className="text-xs text-muted-foreground">{helper}</p>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

// A group of related inputs (e.g. First/Middle/Last name) that share one
// visual heading but aren't a single form control — uses a <fieldset>/
// <legend> instead of <label htmlFor> so each input still needs its own
// accessible name (supplied via aria-label at the call site).
const FieldGroup = ({ legend, children, error }) => (
  <fieldset className="space-y-1.5 border-0 p-0 m-0">
    <legend className="text-sm font-medium text-foreground mb-1.5">{legend}</legend>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </fieldset>
);

const inputCls = "h-11 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ── Default empty form — used before any data loads or on first visit ─────────
const EMPTY = {
  groomName: { first: "", middle: "", last: "" },
  brideName: { first: "", middle: "", last: "" },
  eventTitle: "",
  weddingDate: "",
  weddingDateUndecided: false,
  ceremonyTime: "",
  timeZone: DEFAULT_TIME_ZONE,
  ceremonyVenueName: "",
  receptionVenueName: "",
  city: "",
  state: "",
};

const WeddingDetailsEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [weddingId, setWeddingId] = useState(undefined);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Load existing invitation, mapped onto this form's fields ──────────────
  // Legacy venueName/venueAddress (single-venue schema) is mapped onto the
  // new ceremonyVenueName field when the new field hasn't been set yet —
  // this is a read-time compatibility mapping, not a destructive guess at
  // name parts (groomName/brideName are already stored as first/middle/last).
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await getInvitationByUser(user.uid);
        if (data) {
          setWeddingId(data.weddingId);
          setForm({
            groomName: data.groomName ?? EMPTY.groomName,
            brideName: data.brideName ?? EMPTY.brideName,
            eventTitle: data.eventTitle ?? "",
            weddingDate: data.weddingDate ?? "",
            weddingDateUndecided: !!data.weddingDateUndecided,
            ceremonyTime: data.ceremonyTime ?? "",
            timeZone: data.timeZone ?? DEFAULT_TIME_ZONE,
            ceremonyVenueName: data.ceremonyVenueName ?? data.venueName ?? "",
            receptionVenueName: data.receptionVenueName ?? data.venueName ?? "",
            city: data.city ?? "",
            state: data.state ?? "",
          });
        }
      } catch (err) {
        console.error("Failed to load wedding details:", err);
        setSaveError("Couldn't load your wedding details. Please try refreshing the page.");
      } finally {
        setLoadingData(false);
      }
    })();
    // Depend on the uid, not the `user` object reference — some auth
    // providers (and mocked test doubles) hand back a new object on every
    // render, which would otherwise re-trigger this fetch every time.
  }, [user?.uid]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const setName = (partner, part, value) => setForm(prev => ({
    ...prev,
    [partner]: { ...prev[partner], [part]: value },
  }));

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    if (!form.groomName.first.trim()) errors["groomName.first"] = "First name is required.";
    if (!form.brideName.first.trim()) errors["brideName.first"] = "First name is required.";
    if (!form.weddingDateUndecided && !form.weddingDate) {
      errors.weddingDate = "Wedding date is required (or check \u201cWe're still deciding\u201d).";
    }
    if (!form.ceremonyTime) errors.ceremonyTime = "Ceremony time is required.";
    if (!form.ceremonyVenueName.trim()) errors.ceremonyVenueName = "Event venue is required.";

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

    // Only include fields this form owns — everything else (reception
    // hours, dress code, website, personal message, RSVP deadline,
    // invitation colors/fonts) is intentionally left out so Firestore's
    // partial-update merge doesn't touch those stored values.
    const cityState = [form.city.trim(), form.state.trim()].filter(Boolean).join(", ");
    const data = {
      groomName: form.groomName,
      brideName: form.brideName,
      eventTitle: form.eventTitle.trim(),
      weddingDateUndecided: form.weddingDateUndecided,
      weddingDate: form.weddingDateUndecided ? "" : form.weddingDate,
      ceremonyTime: form.ceremonyTime,
      timeZone: form.timeZone,
      ceremonyVenueName: form.ceremonyVenueName.trim(),
      receptionVenueName: form.receptionVenueName.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      // Backward-compatible mirror — Dashboard.jsx, RSVP.jsx and
      // CreateInvitation.jsx all still read the legacy singular venue field.
      venueName: form.ceremonyVenueName.trim(),
    };
    if (cityState) {
      data.venueAddress = cityState;
      data.ceremonyVenueAddress = cityState;
      data.receptionVenueAddress = cityState;
    }

    try {
      const id = await saveInvitation(user.uid, data, weddingId);
      if (!weddingId) setWeddingId(id);

      setSaved(true);
      // Give the "Saved!" confirmation a beat to be visible before leaving.
      setTimeout(() => {
        setSaved(false);
        navigate("/wedding-details");
      }, 900);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError("Failed to save. Please check your connection and try again.");
      // Intentionally NOT clearing `form` here — entered values must survive
      // a failed save so the host can retry without re-typing everything.
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => navigate("/wedding-details");

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your wedding details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Page title bar with Cancel / Save actions */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Wedding Details</h1>
          <div className="flex items-center gap-3">
            {saveError && <p className="text-xs text-destructive max-w-[220px] text-right">{saveError}</p>}
            <Button variant="outline" size="default" className="rounded-xl gap-2" onClick={handleCancel} disabled={saving}>
              <ArrowLeft size={16} /> Cancel
            </Button>
            <Button variant="default" size="default" className="rounded-xl gap-2" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : saved
                ? <><CheckCircle2 size={16} /> Saved!</>
                : <><Save size={16} /> Save</>}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-6 py-10 max-w-2xl">
        <div className="bg-card rounded-2xl border border-border/50 shadow-md shadow-foreground/[0.03] p-6 sm:p-8 space-y-10">

          {/* ── Personal Info ── */}
          <section className="space-y-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">Personal Info</h2>

            <FieldGroup legend="Partner one" error={fieldErrors["groomName.first"]}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input aria-label="Partner one first name" placeholder="First Name" value={form.groomName.first}
                  onChange={e => setName("groomName", "first", e.target.value)} className={inputCls} />
                <Input aria-label="Partner one middle name" placeholder="Middle Name" value={form.groomName.middle}
                  onChange={e => setName("groomName", "middle", e.target.value)} className={inputCls} />
                <Input aria-label="Partner one last name" placeholder="Last Name" value={form.groomName.last}
                  onChange={e => setName("groomName", "last", e.target.value)} className={inputCls} />
              </div>
            </FieldGroup>

            <FieldGroup legend="Partner two" error={fieldErrors["brideName.first"]}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input aria-label="Partner two first name" placeholder="First Name" value={form.brideName.first}
                  onChange={e => setName("brideName", "first", e.target.value)} className={inputCls} />
                <Input aria-label="Partner two middle name" placeholder="Middle Name" value={form.brideName.middle}
                  onChange={e => setName("brideName", "middle", e.target.value)} className={inputCls} />
                <Input aria-label="Partner two last name" placeholder="Last Name" value={form.brideName.last}
                  onChange={e => setName("brideName", "last", e.target.value)} className={inputCls} />
              </div>
            </FieldGroup>

            <FormField id="eventTitle" label="Event Display Title" helper="Shown on your invitation instead of the names above, e.g. “Jane & John”.">
              <Input id="eventTitle" placeholder="Jane & John" value={form.eventTitle}
                onChange={e => set("eventTitle", e.target.value)} className={inputCls} />
            </FormField>
          </section>

          {/* ── Wedding Details ── */}
          <section className="space-y-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">Wedding Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <FormField id="weddingDate" label="Date" error={fieldErrors.weddingDate}>
                <Input id="weddingDate" type="date" value={form.weddingDate}
                  disabled={form.weddingDateUndecided}
                  onChange={e => set("weddingDate", e.target.value)}
                  className={`${inputCls} disabled:opacity-50`} />
                <label htmlFor="weddingDateUndecided" className="flex items-center gap-2 mt-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox id="weddingDateUndecided" checked={form.weddingDateUndecided}
                    onCheckedChange={checked => set("weddingDateUndecided", !!checked)} />
                  We're still deciding
                </label>
              </FormField>

              <FormField id="timeZone" label="Time Zone">
                <Select value={form.timeZone} onValueChange={v => set("timeZone", v)}>
                  <SelectTrigger id="timeZone" aria-label="Time Zone" className={inputCls}>
                    <SelectValue placeholder="Select time zone..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {TIME_ZONE_OPTIONS.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField id="ceremonyTime" label="Ceremony Time" error={fieldErrors.ceremonyTime}>
              <Input id="ceremonyTime" type="time" value={form.ceremonyTime}
                onChange={e => set("ceremonyTime", e.target.value)} className={inputCls} />
            </FormField>

            <FormField id="ceremonyVenueName" label="Event Venue" error={fieldErrors.ceremonyVenueName}>
              <Input id="ceremonyVenueName" placeholder="Wedding Gardens" value={form.ceremonyVenueName}
                onChange={e => set("ceremonyVenueName", e.target.value)} className={inputCls} />
            </FormField>

            <FormField id="receptionVenueName" label="Reception Venue">
              <Input id="receptionVenueName" placeholder="Wedding Reception Gardens" value={form.receptionVenueName}
                onChange={e => set("receptionVenueName", e.target.value)} className={inputCls} />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="city" label="City">
                <Input id="city" placeholder="Napa Valley" value={form.city}
                  onChange={e => set("city", e.target.value)} className={inputCls} />
              </FormField>
              <FormField id="state" label="State">
                <Input id="state" placeholder="CA" value={form.state}
                  onChange={e => set("state", e.target.value)} className={inputCls} />
              </FormField>
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WeddingDetailsEdit;
