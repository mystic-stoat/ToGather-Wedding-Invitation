// src/pages/WeddingDetails.tsx
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
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import ScrollReveal from "@/components/ScrollReveal";
import { Heart, MapPin, Calendar, Save, CheckCircle2, Loader2, Palette } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser, saveInvitation } from "@/lib/firestore";

// ── Reusable section card layout ──────────────────────────────────────────────
const SectionCard = ({
  icon: Icon,
  title,
  children,
  delay = 0
}) => <ScrollReveal delay={delay}>
    <section className="bg-card rounded-2xl border border-border/50 shadow-md shadow-foreground/[0.03] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <Icon size={20} className="text-accent" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-foreground italic">{title}</h2>
      </div>
      {children}
    </section>
  </ScrollReveal>;

// ── Reusable labeled form field wrapper ───────────────────────────────────────
const FormField = ({
  label,
  children
}) => <div className="space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>;
const inputCls = "h-12 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ── Type for the form — excludes DB-only fields we don't let the user edit ────
// Omit removes: userId (set from auth), weddingId (set by Firestore),
//               createdAt (set by server), isPublished (set by publish button)

// ── Default empty form — used before any data loads or on first visit ─────────
const EMPTY = {
  groomName: {
    first: "",
    middle: "",
    last: ""
  },
  brideName: {
    first: "",
    middle: "",
    last: ""
  },
  ceremonyTime: "",
  venueName: "",
  venueAddress: "",
  weddingDate: "",
  inviteDeadline: "",
  colorPalette1: "#7a9e7e",
  // matches ToGather's sage green theme
  colorPalette2: "#f5f0eb",
  // matches ToGather's warm beige theme
  font1: "Playfair Display",
  font2: "DM Sans",
  gif: ""
};

// ── Main Component ────────────────────────────────────────────────────────────

const WeddingDetails = () => {
  const {
    user
  } = useAuth(); // get the logged-in user from AuthContext

  // form state — holds all the field values the user is editing
  const [form, setForm] = useState(EMPTY);

  // weddingId — the Firestore document ID of their invitation.
  // undefined means they haven't created one yet (first save will create it).
  const [weddingId, setWeddingId] = useState(undefined);

  // UI state for loading, saving, and save confirmation
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Load existing invitation when the page mounts ──────────────────────────
  // useEffect runs once after the component renders.
  // We check if this user already has an invitation saved, and if so, pre-fill the form.
  useEffect(() => {
    if (!user) return; // shouldn't happen (protected route), but safety check

    (async () => {
      try {
        // Look up their invitation in Firestore by userId
        const data = await getInvitationByUser(user.uid);
        if (data) {
          // They have existing data — pre-fill the form
          setWeddingId(data.weddingId); // save the ID so we update instead of creating new

          setForm({
            groomName: data.groomName ?? EMPTY.groomName,
            brideName: data.brideName ?? EMPTY.brideName,
            ceremonyTime: data.ceremonyTime ?? "",
            venueName: data.venueName ?? "",
            venueAddress: data.venueAddress ?? "",
            weddingDate: data.weddingDate ?? "",
            inviteDeadline: data.inviteDeadline ?? "",
            colorPalette1: data.colorPalette1 ?? EMPTY.colorPalette1,
            colorPalette2: data.colorPalette2 ?? EMPTY.colorPalette2,
            font1: data.font1 ?? EMPTY.font1,
            font2: data.font2 ?? EMPTY.font2,
            gif: data.gif ?? ""
          });
        }
        // If data is null they're a new user — form stays as EMPTY defaults
      } catch (err) {
        console.error("Failed to load wedding details:", err);
      } finally {
        setLoadingData(false); // hide the loading spinner either way
      }
    })();
  }, [user]); // re-run if user changes (e.g. they log out and back in)

  // ── Update a top-level string field ────────────────────────────────────────
  // e.g. set("venueName", "The Grand Pavilion")
  const set = (field, value) => setForm(prev => ({
    ...prev,
    [field]: value
  }));

  // ── Update a nested name field ──────────────────────────────────────────────
  // groomName and brideName are stored as { first, middle, last } maps in Firestore.
  // e.g. setName("groomName", "first", "John")
  const setName = (partner, part, value) => setForm(prev => ({
    ...prev,
    [partner]: {
      ...prev[partner],
      [part]: value
    }
  }));

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError("");
    try {
      // saveInvitation in firestore.ts handles create vs update:
      // - If weddingId is undefined → creates new doc and returns the new ID
      // - If weddingId is defined   → updates existing doc and returns same ID
      const id = await saveInvitation(user.uid, {
        ...form,
        isPublished: false
      },
      // pass full form data
      weddingId // undefined on first save, set on updates
      );

      // On first save, store the returned ID so future saves update instead of creating new
      if (!weddingId) setWeddingId(id);

      // Show "Saved!" confirmation for 2.5 seconds then reset
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError("Failed to save. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading spinner while fetching Firestore data ──────────────────────────
  if (loadingData) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your details...</p>
        </div>
      </div>;
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Page title bar with Save button */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Wedding Details</h1>
            {/* Show the weddingId so you can verify it in Firestore console */}
            {weddingId && <p className="text-xs text-muted-foreground mt-0.5">
                Invitation ID: {weddingId}
              </p>}
          </div>
          <div className="flex items-center gap-3">
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <Button variant="default" size="default" className="rounded-xl gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save</>}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-6 py-10 max-w-2xl space-y-8">

        {/* ── Section 1: Partner Names ── */}
        <SectionCard icon={Heart} title="Partner Names">
          <div className="space-y-6">

            <FormField label="Groom's name">
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="First" value={form.groomName.first} onChange={e => setName("groomName", "first", e.target.value)} className={inputCls} />
                <Input placeholder="Middle" value={form.groomName.middle} onChange={e => setName("groomName", "middle", e.target.value)} className={inputCls} />
                <Input placeholder="Last" value={form.groomName.last} onChange={e => setName("groomName", "last", e.target.value)} className={inputCls} />
              </div>
            </FormField>

            <FormField label="Bride's name">
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="First" value={form.brideName.first} onChange={e => setName("brideName", "first", e.target.value)} className={inputCls} />
                <Input placeholder="Middle" value={form.brideName.middle} onChange={e => setName("brideName", "middle", e.target.value)} className={inputCls} />
                <Input placeholder="Last" value={form.brideName.last} onChange={e => setName("brideName", "last", e.target.value)} className={inputCls} />
              </div>
            </FormField>

          </div>
        </SectionCard>

        {/* ── Section 2: Date & Time ── */}
        <SectionCard icon={Calendar} title="Date & Time" delay={80}>
          <div className="space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Wedding Date">
                <Input type="date" value={form.weddingDate} onChange={e => set("weddingDate", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Ceremony Time">
                <Input type="time" value={form.ceremonyTime} onChange={e => set("ceremonyTime", e.target.value)} className={inputCls} />
              </FormField>
            </div>

            <FormField label="RSVP Deadline">
              <Input type="date" value={form.inviteDeadline} onChange={e => set("inviteDeadline", e.target.value)} className={inputCls} />
              <p className="text-xs text-muted-foreground mt-1">
                Guests won't be able to RSVP after this date.
              </p>
            </FormField>

          </div>
        </SectionCard>

        {/* ── Section 3: Venue ── */}
        <SectionCard icon={MapPin} title="Venue & Location" delay={160}>
          <div className="space-y-6">

            <FormField label="Venue Name">
              <Input placeholder="The Grand Pavilion" value={form.venueName} onChange={e => set("venueName", e.target.value)} className={inputCls} />
            </FormField>

            <FormField label="Venue Address">
              <Input placeholder="123 Garden Lane, Austin, TX 78701" value={form.venueAddress} onChange={e => set("venueAddress", e.target.value)} className={inputCls} />
            </FormField>

          </div>
        </SectionCard>

        {/* ── Section 4: Invitation Style ── */}
        {/* These values will be used by CreateInvitation.tsx to style the invitation */}
        <SectionCard icon={Palette} title="Invitation Style" delay={240}>
          <div className="space-y-6">

            {/* Color pickers — native HTML color inputs synced to hex text inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Primary Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.colorPalette1} onChange={e => set("colorPalette1", e.target.value)} className="w-12 h-12 rounded-xl border border-border/60 cursor-pointer bg-background p-1" />
                  <Input value={form.colorPalette1} onChange={e => set("colorPalette1", e.target.value)} className={inputCls} placeholder="#7a9e7e" />
                </div>
              </FormField>

              <FormField label="Secondary Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.colorPalette2} onChange={e => set("colorPalette2", e.target.value)} className="w-12 h-12 rounded-xl border border-border/60 cursor-pointer bg-background p-1" />
                  <Input value={form.colorPalette2} onChange={e => set("colorPalette2", e.target.value)} className={inputCls} placeholder="#f5f0eb" />
                </div>
              </FormField>
            </div>

            {/* Font selectors */}
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

          </div>
        </SectionCard>

      </main>
      <Footer />
    </div>;
};
export default WeddingDetails;
