// src/components/rsvp/RsvpForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   The guest RSVP form — attendance → your info → plus-ones / confirm — and
//   the confirmation screen. Moved out of src/pages/RSVP.jsx UNCHANGED (same
//   steps, fields, validation and submitted data) so it can sit inside the
//   RSVP section of the guest invitation website (Phase 4).
//
//   Data in:   guest       the guest's own details (src/lib/guestInvitation.js
//                          toGuestDetails): pre-fills name/email; plusOneLimit
//              invitation  the guest-safe invitation (meal options, couple
//                          names, date/time/venue for the confirmation card)
//   Data out:  onSubmit(payload) → { success } | { success: false, error }
//              — the page decides how to submit (Phase 4: submitRSVP;
//              Phase 5: a server-verified Cloud Function).
//
//   Must be rendered inside an element with the invitation theme
//   (tg-invite-theme + buildGuestThemeStyle) so its colors follow the couple's
//   Color Theme, as on the former RSVP page.
//
//   Not changed here (see docs/INVITATION_WEBSITE.md): the RSVP deadline is
//   shown but NOT enforced — guests can still submit after it.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Heart,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  Sparkles,
} from "lucide-react";
import { normalizeMealOptions } from "@/lib/rsvpOptions";
import { getVenueDisplay } from "@/lib/venueDisplay";

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
  "h-12 border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// Empty plus-one record — same shape that is saved to Firestore
const emptyPlusOne = () => ({ name: "", mealId: "", meal: "", dietaryRestrictions: "" });

// ── Meal picker — host-configured options, one choice, never preselected ────
// Rendered only when the host configured at least one meal option.
const MealPicker = ({ options, value, onSelect, error, compact = false }) => (
  <div className="space-y-2" role="radiogroup">
    <div className={`grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(opt)}
            className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
              selected
                ? "border-primary bg-primary/8 shadow-sm"
                : "border-border/60 bg-card hover:border-primary/40"
            } ${error && !selected ? "border-destructive/60" : ""}`}
          >
            <p className="pr-6 text-sm font-semibold text-foreground">{opt.name}</p>
            {opt.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
            )}
            {selected && (
              <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                <CheckCircle2 size={10} className="text-primary-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

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
        className={`group relative rounded-2xl border-2 p-6 text-center flex flex-col items-center transition-all duration-200${
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
        className={`group relative rounded-2xl border-2 p-6 text-center flex flex-col items-center transition-all duration-200 ${
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
const StepYourInfo = ({ data, onChange, errors, isAttending, mealOptions }) => (
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

      {isAttending && mealOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">Meal *</Label>
          <MealPicker
            options={mealOptions}
            value={data.mealId}
            onSelect={(opt) => {
              onChange("mealId", opt.id);
              onChange("meal", opt.name);
            }}
            error={errors.mealId}
          />
        </div>
      )}

      {isAttending && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Dietary Restrictions / Allergies
            <span className="font-normal text-muted-foreground/60"> (optional)</span>
          </Label>
          <Input
            placeholder="e.g. Gluten-free, peanut allergy"
            value={data.dietaryNotes}
            onChange={(e) => onChange("dietaryNotes", e.target.value)}
            className={inputCls}
          />
        </div>
      )}
    </div>
  </div>
);

// ── Step 3 — Plus Ones ────────────────────────────────────────────────────────
const StepPlusOnes = ({ data, onChange, maxPlusOnes, mealOptions, errors, onClearError }) => {
  const limit = maxPlusOnes ?? 3;

  const updatePlusOneCount = (count) => {
    const current = data.plusOnes;
    const updated = Array.from({ length: count }, (_, i) => ({
      ...emptyPlusOne(),
      ...(current[i] || {}),
    }));

    onChange("plusOneCount", count);
    onChange("plusOnes", updated);
  };

  const updatePlusOne = (index, changes) => {
    const updated = data.plusOnes.map((p, i) =>
      i === index ? { ...p, ...changes } : p
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

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    placeholder="Guest name"
                    value={guest.name}
                    onChange={(e) => updatePlusOne(i, { name: e.target.value })}
                    className={inputCls}
                  />
                </div>

                {mealOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Meal *
                    </Label>
                    <MealPicker
                      compact
                      options={mealOptions}
                      value={guest.mealId}
                      onSelect={(opt) => {
                        updatePlusOne(i, { mealId: opt.id, meal: opt.name });
                        onClearError(`plusOne_${i}_meal`);
                      }}
                      error={errors[`plusOne_${i}_meal`]}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Dietary Restrictions / Allergies
                    <span className="font-normal text-muted-foreground/60"> (optional)</span>
                  </Label>
                  <Input
                    placeholder="e.g. Gluten-free, peanut allergy"
                    value={guest.dietaryRestrictions}
                    onChange={(e) => updatePlusOne(i, { dietaryRestrictions: e.target.value })}
                    className={inputCls}
                  />
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
          <Sparkles size={40} className="text-accent-light" />
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

          {getVenueDisplay(invitation).section && invitation.venueName && (
            <p className="text-muted-foreground" data-testid="confirmation-venue">{invitation.venueName}</p>
          )}
        </div>
      </div>
    )}
  </div>
);

// ── The form ──────────────────────────────────────────────────────────────────
const RsvpForm = ({ guest, invitation, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submittedFirstName, setSubmittedFirstName] = useState(""); // name actually saved
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState({});

  // Pre-filled from the guest's own record so they only edit what changed.
  const [form, setForm] = useState(() => ({
    attendance: null,
    firstName: guest?.firstName || "",
    lastName: guest?.lastName || "",
    email: guest?.email || "",
    plusOneCount: 0,
    plusOnes: [],
    dietaryNotes: "",
    mealId: "", // main guest meal option id — never preselected
    meal: "",   // main guest meal name snapshot
  }));

  const isAttending = form.attendance === "attending";

  // Host-configured meal options only — no hardcoded fallback.
  // Empty array = no meal selection shown or required.
  const mealOptions = normalizeMealOptions(invitation?.mealOptions);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const clearError = (key) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // A selected meal only counts if it is still one of the host's options.
  const isValidMealId = (id) => Boolean(id) && mealOptions.some((m) => m.id === id);

  // Errors for a single step (0 = attendance, 1 = your info, 2 = plus ones)
  const getStepErrors = (stepIndex) => {
    const errs = {};

    if (stepIndex === 0 && !form.attendance) {
      errs.attendance = "Please select an option.";
    }

    if (stepIndex === 1) {
      if (!form.firstName.trim()) errs.firstName = "First name is required.";
      if (!form.lastName.trim()) errs.lastName = "Last name is required.";
      if (!form.email.trim()) errs.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errs.email = "Enter a valid email.";
      }
      if (isAttending && mealOptions.length > 0 && !isValidMealId(form.mealId)) {
        errs.mealId = "Please select your meal.";
      }
    }

    if (stepIndex === 2 && isAttending && mealOptions.length > 0) {
      form.plusOnes.slice(0, form.plusOneCount).forEach((p, i) => {
        if (!isValidMealId(p.mealId)) {
          errs[`plusOne_${i}_meal`] = "Please select a meal for this guest.";
        }
      });
    }

    return errs;
  };

  const validateStep = () => {
    const errs = getStepErrors(step);
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
    // Re-check every step before writing (the last step has no "Continue").
    for (const s of [0, 1, 2]) {
      const errs = getStepErrors(s);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        setStep(s);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError("");

    // Name/email are synced back to the invitee for both accept and decline.
    const guestName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const identity = { guestName, email: form.email.trim() };

    // Declining never sends meal / plus-one details, even if the form still
    // holds values from before the guest switched to "decline".
    const payload = isAttending
      ? {
          ...identity,
          attending: true,
          dietaryRestrictions: form.dietaryNotes.trim(),
          mealId: mealOptions.length > 0 ? form.mealId : "",
          meal: mealOptions.length > 0 ? form.meal : "",
          guestCount: form.plusOneCount + 1,
          plusOnes: form.plusOnes.slice(0, form.plusOneCount).map((p) => ({
            name: p.name.trim(),
            mealId: mealOptions.length > 0 ? p.mealId : "",
            meal: mealOptions.length > 0 ? p.meal : "",
            dietaryRestrictions: p.dietaryRestrictions.trim(),
          })),
        }
      : {
          ...identity,
          attending: false,
          dietaryRestrictions: "",
          mealId: "",
          meal: "",
          guestCount: 0,
          plusOnes: [],
        };

    try {
      const result = await onSubmit(payload);

      if (result.success) {
        setSubmittedFirstName(form.firstName.trim()); // name shown on confirmation
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
  const invitee = guest; // plus-one limit (same field the former page used)

  return (
    <>
      {submitted ? (
        <ConfirmationScreen
          isAttending={isAttending}
          name={submittedFirstName}
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
              mealOptions={mealOptions}
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
                  errors={errors}
                  onClearError={clearError}
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
    </>
  );
};

export default RsvpForm;
