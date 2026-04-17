// src/pages/RSVP.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The guest-facing RSVP page. Guests reach this page via their unique link:
//   e.g. yourapp.com/rsvp/abc-123-def-456
//
// FLOW:
//   1. Page loads → reads token from the URL (:token param)
//   2. Looks up the invitee in Firestore by token
//   3. Uses the invitee's weddingId to load the invitation details
//   4. Guest fills out the multi-step form
//   5. On submit → calls submitRSVP()
//
// ERROR STATES HANDLED:
//   - Invalid token
//   - Token already used
//   - Firestore errors on submit
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Footer from "@/components/Footer";
import {
  Heart,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { submitRSVP } from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3; // attendance → your info → plus ones / final confirm

// ── Step indicator dots ───────────────────────────────────────────────────────
const StepIndicator = ({ current, total }) => (
  <div className="mb-8 flex items-center justify-center gap-2">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`rounded-full transition-all duration-300 ${
          i <= current ? "h-2 w-6 bg-primary" : "h-2 w-2 bg-border"
        }`}
      />
    ))}
  </div>
);

const inputCls =
  "h-12 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ── Invitation Header — shows real wedding details from Firestore ────────────
const InvitationHeader = ({ invitation }) => {
  const formattedDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const groomFirst = invitation?.groomName?.first || "";
  const brideFirst = invitation?.brideName?.first || "";
  const coupleNames =
    groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : "Your Wedding";

  return (
    <div className="mb-10 animate-fade-up text-center">
      <div className="mb-4 flex items-center justify-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
        <Heart size={14} className="fill-accent text-accent" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
      </div>

      <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Together with their families
      </p>

      <h1 className="mb-2 font-heading text-4xl font-semibold italic text-foreground sm:text-5xl">
        {coupleNames}
      </h1>

      <p className="mb-1 text-sm text-muted-foreground">
        Request the pleasure of your company
      </p>

      {formattedDate && (
        <p className="font-heading text-base text-foreground">
          {formattedDate}
          {invitation?.ceremonyTime && ` · ${invitation.ceremonyTime}`}
        </p>
      )}

      {invitation?.venueName && (
        <p className="mt-1 text-sm text-muted-foreground">
          {invitation.venueName}
          {invitation?.venueAddress && `, ${invitation.venueAddress}`}
        </p>
      )}

      {invitation?.inviteDeadline && (
        <p className="mt-2 text-xs font-medium text-accent">
          Kindly reply by{" "}
          {new Date(invitation.inviteDeadline + "T00:00:00").toLocaleDateString(
            "en-US",
            {
              month: "long",
              day: "numeric",
              year: "numeric",
            }
          )}
        </p>
      )}

      <div className="mt-5 flex items-center justify-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
        <Heart size={14} className="fill-accent text-accent" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
      </div>
    </div>
  );
};

// ── Step 1 — Attendance ───────────────────────────────────────────────────────
const StepAttendance = ({ value, onChange }) => (
  <div className="animate-fade-up space-y-6">
    <div className="space-y-1 text-center">
      <h2 className="font-heading text-2xl font-semibold italic text-foreground">
        Will you be joining us?
      </h2>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange("attending")}
        className={`group relative rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
          value === "attending"
            ? "border-primary bg-primary/8 shadow-md shadow-primary/10"
            : "border-border/60 bg-card hover:border-primary/40 hover:shadow-md"
        }`}
      >
        <div
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            value === "attending"
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          <CheckCircle2 size={22} />
        </div>

        <p className="font-heading text-lg font-semibold italic text-foreground">
          Joyfully accepts
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          I'll be there to celebrate!
        </p>

        {value === "attending" && (
          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <CheckCircle2 size={12} className="text-primary-foreground" />
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange("declined")}
        className={`group relative rounded-2xl border-2 p-6 text-left transition-all duration-200 ${
          value === "declined"
            ? "border-destructive/60 bg-destructive/5 shadow-md shadow-destructive/5"
            : "border-border/60 bg-card hover:border-destructive/30 hover:shadow-md"
        }`}
      >
        <div
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            value === "declined"
              ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <XCircle size={22} />
        </div>

        <p className="font-heading text-lg font-semibold italic text-foreground">
          Regretfully declines
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          I won't be able to make it.
        </p>

        {value === "declined" && (
          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/60">
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
    <div className="space-y-1 text-center">
      <h2 className="font-heading text-2xl font-semibold italic text-foreground">
        Your information
      </h2>
      <p className="text-sm text-muted-foreground">
        {isAttending ? "We can't wait to see you!" : "We'll miss you dearly."}
      </p>
    </div>

    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            First Name *
          </Label>
          <Input
            placeholder="Jane"
            value={data.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            className={`${inputCls} ${errors.firstName ? "border-destructive" : ""}`}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Last Name *
          </Label>
          <Input
            placeholder="Smith"
            value={data.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            className={`${inputCls} ${errors.lastName ? "border-destructive" : ""}`}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-muted-foreground">
          Email Address *
        </Label>
        <Input
          type="email"
          placeholder="you@example.com"
          value={data.email}
          onChange={(e) => onChange("email", e.target.value)}
          className={`${inputCls} ${errors.email ? "border-destructive" : ""}`}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        <p className="text-xs text-muted-foreground">
          We'll send your confirmation here.
        </p>
      </div>

      {isAttending && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Dietary Restrictions
            <span className="font-normal text-muted-foreground/60"> (optional)</span>
          </Label>
          <Input
            placeholder="Gluten-free, nut allergy, chicken, etc."
            value={data.dietaryNotes}
            onChange={(e) => onChange("dietaryNotes", e.target.value)}
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground">
            Include your meal preference and any dietary needs.
          </p>
        </div>
      )}
    </div>
  </div>
);

// ── Step 3 — Plus Ones ────────────────────────────────────────────────────────
const StepPlusOnes = ({ data, onChange, maxPlusOnes, mealOptions }) => {
  const limit = maxPlusOnes ?? 3;

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
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-2xl font-semibold italic text-foreground">
          Will you bring guests?
        </h2>
        <p className="text-sm text-muted-foreground">
          You may bring up to {limit} additional {limit === 1 ? "guest" : "guests"}.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Additional guests
        </Label>
        <div className="flex gap-2">
          {Array.from({ length: limit + 1 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => updatePlusOneCount(n)}
              className={`h-12 flex-1 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                data.plusOneCount === n
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {n === 0 ? "None" : `+${n}`}
            </button>
          ))}
        </div>
      </div>

      {data.plusOneCount > 0 && (
        <div className="space-y-4">
          {data.plusOnes.map((guest, i) => (
            <div
              key={i}
              className="space-y-3 rounded-2xl border border-border/40 bg-muted/40 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                  <Users size={12} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Guest {i + 1}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    placeholder="Guest name"
                    value={guest.name}
                    onChange={(e) => updatePlusOne(i, "name", e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Meal Preference
                  </Label>
                  <Select
                    value={guest.meal}
                    onValueChange={(v) => updatePlusOne(i, "meal", v)}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select meal..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {mealOptions.map((meal) => (
                        <SelectItem key={meal} value={meal.toLowerCase()}>
                          {meal}
                        </SelectItem>
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
        <div className="rounded-2xl border border-border/40 bg-muted/30 p-5 text-center">
          <Users size={28} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Just you — we'll save a seat!</p>
        </div>
      )}
    </div>
  );
};

// ── Confirmation screen ───────────────────────────────────────────────────────
const ConfirmationScreen = ({ isAttending, name, invitation, coupleNames }) => (
  <div className="animate-fade-up space-y-6 py-4 text-center">
    <div className="relative inline-flex items-center justify-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        {isAttending ? (
          <Heart size={40} className="fill-primary/30 text-primary" />
        ) : (
          <Sparkles size={40} className="text-accent" />
        )}
      </div>

      <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md">
        <CheckCircle2 size={18} className="text-primary-foreground" />
      </div>
    </div>

    <div className="space-y-2">
      <h2 className="font-heading text-3xl font-semibold italic text-foreground">
        {isAttending ? "See you there!" : "We'll miss you!"}
      </h2>
      <p className="text-muted-foreground">
        {isAttending
          ? `Thank you, ${name}! Your RSVP has been recorded.`
          : `Thank you, ${name}. ${coupleNames} will miss you, but appreciate you letting them know.`}
      </p>
    </div>

    {isAttending && invitation && (
      <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 text-left shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Event Details
        </p>

        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-foreground">{coupleNames}'s Wedding</p>

          {invitation.weddingDate && (
            <p className="text-muted-foreground">
              {new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
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
  const { inviteeId, token } = useParams();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [invitee, setInvitee] = useState(null);
  const [invitation, setInvitation] = useState(null);

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    attendance: null,
    firstName: "",
    lastName: "",
    email: "",
    plusOneCount: 0,
    plusOnes: [],
    dietaryNotes: "",
  });

  const isAttending = form.attendance === "attending";

  const mealOptions = invitation?.mealOptions?.length
    ? invitation.mealOptions
    : ["Chicken", "Fish", "Beef", "Vegetarian"];

  useEffect(() => {
    if (!token) {
      setPageError("No invitation token found. Please check your link.");
      setPageLoading(false);
      return;
    }

    (async () => {
      try {
        const inviteeRef = doc(db, "invitee", inviteeId);
        const inviteeSnap = await getDoc(inviteeRef);

        if (!inviteeSnap.exists()) {
          setPageError("This invitation link is invalid or has expired.");
          setPageLoading(false);
          return;
        }

        const inviteeData = { inviteeId: inviteeSnap.id, ...inviteeSnap.data() };

        if (inviteeData.token !== token) {
          setPageError("This invitation link is invalid or has expired.");
          setPageLoading(false);
          return;
        }

        if (inviteeData.tokenUsed) {
          setPageError("This RSVP has already been submitted. Thank you!");
          setPageLoading(false);
          return;
        }

        setInvitee(inviteeData);

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
  }, [token, inviteeId]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateStep = () => {
    const errs = {};

    if (step === 0 && !form.attendance) {
      errs.attendance = "Please select an option.";
    }

    if (step === 1) {
      if (!form.firstName.trim()) errs.firstName = "First name is required.";
      if (!form.lastName.trim()) errs.lastName = "Last name is required.";
      if (!form.email.trim()) errs.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errs.email = "Enter a valid email.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await submitRSVP(token, {
        attending: isAttending,
        dietaryRestrictions: form.dietaryNotes,
        guestCount: form.plusOneCount + 1,
        plusOnes: form.plusOnes,
      });

      if (result.success) {
        setSubmitted(true);
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

  const groomFirst = invitation?.groomName?.first || "";
  const brideFirst = invitation?.brideName?.first || "";
  const coupleNames =
    groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : "The Couple";

  const visibleSteps = TOTAL_STEPS;
  const visualStep = step;

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
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
              <p className="text-muted-foreground">{pageError}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="h-1 bg-gradient-to-r from-primary via-accent-light to-primary" />

      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <div className="mb-6 inline-block rounded-xl bg-foreground px-5 py-2.5">
              <span className="font-heading text-xl font-bold tracking-tight text-primary-foreground">
                ToGather
              </span>
            </div>
          </div>

          <InvitationHeader invitation={invitation} />

          <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-xl shadow-foreground/[0.04] sm:p-8">
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

                {step === 0 && (
                  <StepAttendance
                    value={form.attendance}
                    onChange={(v) => updateForm("attendance", v)}
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

                {step === 2 && (
                  <>
                    {isAttending ? (
                      <StepPlusOnes
                        data={form}
                        onChange={updateForm}
                        maxPlusOnes={invitee?.plusOneLimit ?? 0}
                        mealOptions={mealOptions}
                      />
                    ) : (
                      <div className="animate-fade-up space-y-6">
                        <div className="space-y-1 text-center">
                          <h2 className="font-heading text-2xl font-semibold italic text-foreground">
                            Confirm your response
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            You're letting {coupleNames} know you can't attend.
                          </p>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/8 p-5">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                            RSVP Summary
                          </p>

                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <span className="font-medium text-foreground">
                                {form.firstName} {form.lastName}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Attending</span>
                              <span className="font-semibold text-destructive">
                                Regretfully declining
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {step === 0 && errors.attendance && (
                  <p className="mt-3 text-center text-xs text-destructive">
                    {errors.attendance}
                  </p>
                )}

                {submitError && (
                  <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                    <p className="text-sm text-destructive">{submitError}</p>
                  </div>
                )}

                <div
                  className={`mt-8 flex items-center ${
                    step > 0 ? "justify-between" : "justify-end"
                  }`}
                >
                  {step > 0 && (
                    <Button
                      variant="ghost"
                      onClick={prevStep}
                      className="gap-1.5 rounded-xl text-muted-foreground"
                    >
                      <ChevronLeft size={16} /> Back
                    </Button>
                  )}

                  {step < TOTAL_STEPS - 1 ? (
                    <Button
                      variant="default"
                      onClick={nextStep}
                      className="gap-1.5 rounded-xl"
                      disabled={step === 0 && !form.attendance}
                    >
                      Continue <ChevronRight size={16} />
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={handleSubmit}
                      className="gap-1.5 rounded-xl px-6"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                          Submitting...
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          {isAttending ? "Send my RSVP" : "Send response"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-heading font-semibold text-foreground">ToGather</span>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RSVP;
