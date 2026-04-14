// src/pages/RSVP.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The guest-facing RSVP page. Guests reach this page via their unique link:
//   e.g. yourapp.com/rsvp/abc-123-def-456
//
// FLOW:
//   1. Page loads → reads token from the URL (:token param)
//   2. Looks up the invitee in Firestore by token (getInviteeByToken)
//   3. Uses the invitee's weddingId to load the invitation details
//      (so we can show real couple names, venue, date)
//   4. Guest fills out the multi-step form
//   5. On submit → calls submitRSVP() which:
//        - Creates a doc in the `rsvp` collection
//        - Updates the `invitee` doc with their response
//        - Sets tokenUsed = true (prevents duplicate submissions)
//
// ERROR STATES HANDLED:
//   - Invalid token (no invitee found)
//   - Token already used (already RSVP'd)
//   - Firestore errors on submit
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom"; // reads :token from the URL
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Footer from "@/components/Footer";
import {
  Heart, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  Users, MessageSquare, Sparkles, Loader2, AlertCircle,
} from "lucide-react";
import {
  submitRSVP,         // writes to rsvp collection + updates invitee doc
} from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";


// ── Constants ─────────────────────────────────────────────────────────────────
const MEAL_OPTIONS = ["Chicken", "Fish", "Beef", "Vegetarian", "Vegan", "No Preference"];
const TOTAL_STEPS  = 4; // attendance → your info → plus ones → message

// ── Step indicator dots ───────────────────────────────────────────────────────
const StepIndicator = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`transition-all duration-300 rounded-full ${
        i <= current ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-border"
      }`} />
    ))}
  </div>
);

const inputCls = "h-12 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ── Invitation Header — shows real wedding details from Firestore ──────────────
const InvitationHeader = ({ invitation, invitee }) => {
  // Format the wedding date nicely if it exists
  const formattedDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : null;

  // Build couple names from the invitation doc
  const groomFirst = invitation?.groomName?.first || "";
  const brideFirst = invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst
    ? `${groomFirst} & ${brideFirst}`
    : "Your Wedding";

  return (
    <div className="text-center mb-10 animate-fade-up">
      {/* Decorative flourish */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
        <Heart size={14} className="text-accent fill-accent" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
      </div>

      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
        Together with their families
      </p>

      {/* Real couple names from Firestore */}
      <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-foreground italic mb-2">
        {coupleNames}
      </h1>

      <p className="text-sm text-muted-foreground mb-1">
        Request the pleasure of your company
      </p>

      {/* Real date and time */}
      {formattedDate && (
        <p className="font-heading text-base text-foreground">
          {formattedDate}
          {invitation?.ceremonyTime && ` · ${invitation.ceremonyTime}`}
        </p>
      )}

      {/* Real venue */}
      {invitation?.venueName && (
        <p className="text-sm text-muted-foreground mt-1">
          {invitation.venueName}
          {invitation?.venueAddress && `, ${invitation.venueAddress}`}
        </p>
      )}

      {/* RSVP deadline reminder */}
      {invitation?.inviteDeadline && (
        <p className="text-xs text-accent font-medium mt-2">
          Kindly reply by{" "}
          {new Date(invitation.inviteDeadline + "T00:00:00").toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric",
          })}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 mt-5">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
        <Heart size={14} className="text-accent fill-accent" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
      </div>
    </div>
  );
};

// ── Step 1 — Attendance ───────────────────────────────────────────────────────
const StepAttendance = ({ value, onChange }) => (
  <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">
        Will you be joining us?
      </h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      <button type="button" onClick={() => onChange("attending")}
        className={`group relative p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
          value === "attending"
            ? "border-primary bg-primary/8 shadow-md shadow-primary/10"
            : "border-border/60 bg-card hover:border-primary/40 hover:shadow-md"
        }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
          value === "attending" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        }`}>
          <CheckCircle2 size={22} />
        </div>
        <p className="font-heading text-lg font-semibold text-foreground italic">Joyfully accepts</p>
        <p className="text-xs text-muted-foreground mt-0.5">I'll be there to celebrate!</p>
        {value === "attending" && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <CheckCircle2 size={12} className="text-primary-foreground" />
          </div>
        )}
      </button>

      <button type="button" onClick={() => onChange("declined")}
        className={`group relative p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
          value === "declined"
            ? "border-destructive/60 bg-destructive/5 shadow-md shadow-destructive/5"
            : "border-border/60 bg-card hover:border-destructive/30 hover:shadow-md"
        }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
          value === "declined" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
        }`}>
          <XCircle size={22} />
        </div>
        <p className="font-heading text-lg font-semibold text-foreground italic">Regretfully declines</p>
        <p className="text-xs text-muted-foreground mt-0.5">I won't be able to make it.</p>
        {value === "declined" && (
          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-destructive/60 flex items-center justify-center">
            <CheckCircle2 size={12} className="text-white" />
          </div>
        )}
      </button>
    </div>
  </div>
);

// ── Step 2 — Your Info ────────────────────────────────────────────────────────
const StepYourInfo = ({ data, onChange, errors, isAttending }) => (
  <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">Your information</h2>
      <p className="text-sm text-muted-foreground">
        {isAttending ? "We can't wait to see you!" : "We'll miss you dearly."}
      </p>
    </div>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">First Name *</Label>
          <Input placeholder="Jane" value={data.firstName}
            onChange={e => onChange("firstName", e.target.value)}
            className={`${inputCls} ${errors.firstName ? "border-destructive" : ""}`} />
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">Last Name *</Label>
          <Input placeholder="Smith" value={data.lastName}
            onChange={e => onChange("lastName", e.target.value)}
            className={`${inputCls} ${errors.lastName ? "border-destructive" : ""}`} />
          {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-muted-foreground">Email Address *</Label>
        <Input type="email" placeholder="you@example.com" value={data.email}
          onChange={e => onChange("email", e.target.value)}
          className={`${inputCls} ${errors.email ? "border-destructive" : ""}`} />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        <p className="text-xs text-muted-foreground">We'll send your confirmation here.</p>
      </div>

      {isAttending && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">Dietary Restrictions
            <span className="text-muted-foreground/60 font-normal"> (optional)</span>
          </Label>
          <Input placeholder="Gluten-free, nut allergy, chicken, etc."
            value={data.dietaryNotes}
            onChange={e => onChange("dietaryNotes", e.target.value)}
            className={inputCls} />
          <p className="text-xs text-muted-foreground">
            Include your meal preference and any dietary needs.
          </p>
        </div>
      )}
    </div>
  </div>
);

// ── Step 3 — Plus Ones ────────────────────────────────────────────────────────
// maxPlusOnes comes from the invitee's plusOneLimit set by the host
const StepPlusOnes = ({ data, onChange, maxPlusOnes }) => {
  const limit = maxPlusOnes ?? 3; // default to 3 if not set

  const updatePlusOneCount = (count) => {
    const current = data.plusOnes;
    const updated = Array.from({ length: count }, (_, i) => ({
      name: current[i]?.name ?? "",
      meal: current[i]?.meal ?? "",
    }));
    onChange("plusOneCount", count);
    onChange("plusOnes", updated);
  };

  const updatePlusOne = (index, field, value) => {
    const updated = data.plusOnes.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    onChange("plusOnes", updated);
  };

  return (
    <div className="animate-fade-up space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-heading text-2xl font-semibold text-foreground italic">
          Will you bring guests?
        </h2>
        <p className="text-sm text-muted-foreground">
          You may bring up to {limit} additional {limit === 1 ? "guest" : "guests"}.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Additional guests</Label>
        <div className="flex gap-2">
          {/* Show buttons up to the guest's plusOneLimit */}
          {Array.from({ length: limit + 1 }, (_, n) => (
            <button key={n} type="button" onClick={() => updatePlusOneCount(n)}
              className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                data.plusOneCount === n
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-card text-foreground hover:border-primary/40"
              }`}>
              {n === 0 ? "None" : `+${n}`}
            </button>
          ))}
        </div>
      </div>

      {data.plusOneCount > 0 && (
        <div className="space-y-4">
          {data.plusOnes.map((guest, i) => (
            <div key={i} className="bg-muted/40 rounded-2xl p-4 border border-border/40 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  <Users size={12} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Guest {i + 1}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                  <Input placeholder="Guest name" value={guest.name}
                    onChange={e => updatePlusOne(i, "name", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Meal Preference</Label>
                  <Select value={guest.meal} onValueChange={v => updatePlusOne(i, "meal", v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select meal..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {MEAL_OPTIONS.map(m => (
                        <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.plusOneCount === 0 && (
        <div className="bg-muted/30 rounded-2xl p-5 border border-border/40 text-center">
          <Users size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Just you — we'll save a seat!</p>
        </div>
      )}
    </div>
  );
};

// ── Step 4 — Message ──────────────────────────────────────────────────────────
const StepMessage = ({ data, onChange, isAttending, coupleNames }) => (
  <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">
        {isAttending ? "Leave them a note" : "Send your wishes"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isAttending
          ? "Share your excitement with the couple!"
          : `Let ${coupleNames} know you're thinking of them.`}
      </p>
    </div>

    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">
        Your message <span className="text-muted-foreground/60 font-normal">(optional)</span>
      </Label>
      <Textarea
        placeholder={isAttending ? "Can't wait to celebrate with you both! 🥂" : "Wishing you both all the happiness in the world!"}
        value={data.message}
        onChange={e => onChange("message", e.target.value)}
        className="min-h-[140px] bg-background border-border/60 rounded-xl resize-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <p className="text-xs text-muted-foreground text-right">{data.message.length}/300</p>
    </div>

    {/* Summary before submitting */}
    <div className="bg-primary/8 border border-primary/20 rounded-2xl p-5 space-y-2">
      <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">
        Your RSVP Summary
      </p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium text-foreground">{data.firstName} {data.lastName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Attending</span>
          <span className={`font-semibold ${isAttending ? "text-primary" : "text-destructive"}`}>
            {isAttending ? "Yes, accepting!" : "Regretfully declining"}
          </span>
        </div>
        {isAttending && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total guests</span>
              <span className="font-medium text-foreground">
                {data.plusOneCount + 1} {data.plusOneCount + 1 === 1 ? "person" : "people"}
              </span>
            </div>
            {data.dietaryNotes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dietary notes</span>
                <span className="font-medium text-foreground">{data.dietaryNotes}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

// ── Confirmation screen ───────────────────────────────────────────────────────
const ConfirmationScreen = ({ isAttending, name, invitation, coupleNames }) => (
  <div className="text-center animate-fade-up space-y-6 py-4">
    <div className="relative inline-flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        {isAttending
          ? <Heart size={40} className="text-primary fill-primary/30" />
          : <Sparkles size={40} className="text-accent" />}
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
        <CheckCircle2 size={18} className="text-primary-foreground" />
      </div>
    </div>

    <div className="space-y-2">
      <h2 className="font-heading text-3xl font-semibold text-foreground italic">
        {isAttending ? "See you there!" : "We'll miss you!"}
      </h2>
      <p className="text-muted-foreground">
        {isAttending
          ? `Thank you, ${name}! Your RSVP has been recorded.`
          : `Thank you, ${name}. ${coupleNames} will miss you, but appreciate you letting them know.`}
      </p>
    </div>

    {/* Show event details card if attending */}
    {isAttending && invitation && (
      <div className="bg-card border border-border/50 rounded-2xl p-5 text-left space-y-3 shadow-sm">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Event Details
        </p>
        <div className="space-y-1.5 text-sm">
          <p className="text-foreground font-medium">{coupleNames}'s Wedding</p>
          {invitation.weddingDate && (
            <p className="text-muted-foreground">
              {new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
              {invitation.ceremonyTime && ` · ${invitation.ceremonyTime}`}
            </p>
          )}
          {invitation.venueName && (
            <p className="text-muted-foreground">{invitation.venueName}</p>
          )}
        </div>
      </div>
    )}
  </div>
);

// ── Main RSVP page ────────────────────────────────────────────────────────────
const RSVP = () => {
  // Read the token from the URL: /rsvp/:token
  // Read both inviteeId and token from the URL: /rsvp/:inviteeId/:token
  const { inviteeId, token } = useParams();

  // ── Loading state for initial data fetch ──────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError]     = useState(""); // invalid/used token messages

  // ── Data from Firestore ───────────────────────────────────────────────────
  const [invitee, setInvitee]         = useState(null);     // the guest's record
  const [invitation, setInvitation]   = useState(null);     // the wedding details

  // ── Multi-step form state ─────────────────────────────────────────────────
  const [step, setStep]               = useState(0);
  const [submitted, setSubmitted]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors]           = useState({});

  const [form, setForm] = useState({
    attendance:   null,
    firstName:    "",
    lastName:     "",
    email:        "",
    plusOneCount: 0,
    plusOnes:     [],
    dietaryNotes: "",
    message:      "",
  });

  const isAttending = form.attendance === "attending";

  // ── Load invitee + invitation on mount ────────────────────────────────────
  // This runs when the page loads. It:
  //   1. Looks up the guest by their URL token
  //   2. If found, loads the wedding invitation for that weddingId
  useEffect(() => {
    if (!token) {
      setPageError("No invitation token found. Please check your link.");
      setPageLoading(false);
      return;
    }

    (async () => {
      try {
        // Step 1: Fetch the invitee document directly by ID (no query needed)
        // The inviteeId comes from the URL: /rsvp/:inviteeId/:token
        const inviteeRef = doc(db, "invitee", inviteeId);
        const inviteeSnap = await getDoc(inviteeRef);

        if (!inviteeSnap.exists()) {
          setPageError("This invitation link is invalid or has expired.");
          setPageLoading(false);
          return;
        }

        const inviteeData = { inviteeId: inviteeSnap.id, ...inviteeSnap.data() };

        // Verify the token matches what's stored — security check in app code
        if (inviteeData.token !== token) {
          setPageError("This invitation link is invalid or has expired.");
          setPageLoading(false);
          return;
        }

        // Step 2: Check if they've already submitted
        if (inviteeData.tokenUsed) {
          setPageError("This RSVP has already been submitted. Thank you!");
          setPageLoading(false);
          return;
        }

        setInvitee(inviteeData);

        // Step 3: Load the invitation (wedding details) using the weddingId
        if (inviteeData.weddingId) {
          const invRef = doc(db, "invitations", inviteeData.weddingId);
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            setInvitation({ weddingId: invSnap.id, ...invSnap.data() });
          }
        }

      } catch (err) {
        console.error("RSVP page load error:", err);
        setPageError("Something went wrong loading your invitation. Please try again.");
      } finally {
        setPageLoading(false);
      }
    })();
  }, [token]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  };

  // ── Validation per step ───────────────────────────────────────────────────
  const validateStep = () => {
    const errs = {};
    if (step === 0 && !form.attendance) {
      errs.attendance = "Please select an option.";
    }
    if (step === 1) {
      if (!form.firstName.trim()) errs.firstName = "First name is required.";
      if (!form.lastName.trim())  errs.lastName  = "Last name is required.";
      if (!form.email.trim())     errs.email     = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = "Enter a valid email.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const nextStep = () => {
    if (!validateStep()) return;
    // If declining, skip the plus ones step
    if (step === 1 && !isAttending) setStep(3);
    else setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    if (step === 3 && !isAttending) setStep(1);
    else setStep(s => Math.max(s - 1, 0));
  };

  // ── Submit RSVP to Firestore ──────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");

    try {
      // Call submitRSVP in firestore.js which:
      //   1. Validates the token
      //   2. Creates a doc in `rsvp` collection
      //   3. Updates `invitee` doc with their response + sets tokenUsed = true
      const result = await submitRSVP(token, {
        attending:           isAttending,
        dietaryRestrictions: form.dietaryNotes,
        guestCount:          form.plusOneCount + 1, // total including themselves
        // plusOnes is an array of { name, meal } for each extra guest the main guest is bringing
        // e.g. [{ name: "Jane Smith", meal: "vegetarian" }]
        plusOnes:            form.plusOnes,
        message:             form.message,
      });

      if (result.success) {
        setSubmitted(true); // show confirmation screen
      } else {
        setSubmitError(result.error || "Submission failed. Please try again.");
      }
    } catch (err) {
      console.error("RSVP submit error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Build couple names for display
  const groomFirst = invitation?.groomName?.first || "";
  const brideFirst = invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst
    ? `${groomFirst} & ${brideFirst}`
    : "The Couple";

  const visibleSteps = isAttending ? TOTAL_STEPS : TOTAL_STEPS - 1;
  const visualStep   = step === 3 && !isAttending ? 2 : step;

  // ── Loading spinner while fetching from Firestore ─────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  // ── Error state — invalid/used token ─────────────────────────────────────
  if (pageError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-1 bg-gradient-to-r from-primary via-accent-light to-primary" />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-destructive" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-foreground italic mb-2">
                Invitation Not Found
              </h2>
              <p className="text-muted-foreground">{pageError}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-1 bg-gradient-to-r from-primary via-accent-light to-primary" />

      <main className="flex-1 flex items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-lg">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-block bg-foreground rounded-xl px-5 py-2.5 mb-6">
              <span className="font-heading text-xl font-bold text-primary-foreground tracking-tight">
                ToGather
              </span>
            </div>
          </div>

          {/* Real wedding details header */}
          <InvitationHeader invitation={invitation} invitee={invitee} />

          {/* Form card */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-foreground/[0.04] p-6 sm:p-8">
            {submitted ? (
              <ConfirmationScreen
                isAttending={isAttending}
                name={form.firstName}
                invitation={invitation}
                coupleNames={coupleNames}
              />
            ) : (
              <>
                <StepIndicator current={visualStep} total={visibleSteps} />

                {/* Step content */}
                {step === 0 && (
                  <StepAttendance
                    value={form.attendance}
                    onChange={v => updateForm("attendance", v)}
                  />
                )}
                {step === 1 && (
                  <StepYourInfo
                    data={form}
                    onChange={updateForm}
                    errors={errors}
                    isAttending={isAttending}
                  />
                )}
                {step === 2 && isAttending && (
                  <StepPlusOnes
                    data={form}
                    onChange={updateForm}
                    maxPlusOnes={invitee?.plusOneLimit ?? 0}
                  />
                )}
                {step === 3 && (
                  <StepMessage
                    data={form}
                    onChange={updateForm}
                    isAttending={isAttending}
                    coupleNames={coupleNames}
                  />
                )}

                {/* Attendance error */}
                {step === 0 && errors.attendance && (
                  <p className="text-xs text-destructive text-center mt-3">
                    {errors.attendance}
                  </p>
                )}

                {/* Submit error */}
                {submitError && (
                  <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                    <p className="text-sm text-destructive">{submitError}</p>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className={`flex items-center mt-8 ${step > 0 ? "justify-between" : "justify-end"}`}>
                  {step > 0 && (
                    <Button variant="ghost" onClick={prevStep}
                      className="rounded-xl gap-1.5 text-muted-foreground">
                      <ChevronLeft size={16} /> Back
                    </Button>
                  )}

                  {step < TOTAL_STEPS - 1 ? (
                    <Button variant="default" onClick={nextStep}
                      className="rounded-xl gap-1.5"
                      disabled={step === 0 && !form.attendance}>
                      Continue <ChevronRight size={16} />
                    </Button>
                  ) : (
                    <Button variant="default" onClick={handleSubmit}
                      className="rounded-xl gap-1.5 px-6"
                      disabled={submitting}>
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        <>
                          <MessageSquare size={16} />
                          {isAttending ? "Send my RSVP" : "Send response"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Powered by <span className="font-heading font-semibold text-foreground">ToGather</span>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RSVP;
