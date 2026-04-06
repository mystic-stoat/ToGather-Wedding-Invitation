import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Footer from "@/components/Footer";
import { Heart, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Users, MessageSquare, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_OPTIONS = ["Chicken", "Fish", "Beef", "Vegetarian", "Vegan", "No Preference"];
const TOTAL_STEPS = 4; // attendance, your info, plus ones, message

// ─── Sub-components ──────────────────────────────────────────────────────────

const StepIndicator = ({
  current,
  total
}) => <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({
    length: total
  }).map((_, i) => <div key={i} className={`transition-all duration-300 rounded-full ${i < current ? "w-6 h-2 bg-primary" : i === current ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-border"}`} />)}
  </div>;
const inputCls = "h-12 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

// ─── Invitation Header ────────────────────────────────────────────────────────

const InvitationHeader = () => <div className="text-center mb-10 animate-fade-up">
    {/* Decorative flourish */}
    <div className="flex items-center justify-center gap-3 mb-4">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
      <Heart size={14} className="text-accent fill-accent" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
    </div>

    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
      Together with their families
    </p>

    <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-foreground italic mb-2">
      Sarah &amp; Michael
    </h1>

    <p className="text-sm text-muted-foreground mb-1">
      Request the pleasure of your company
    </p>
    <p className="font-heading text-base text-foreground">
      Saturday, June 15, 2025 &nbsp;·&nbsp; 4:00 PM
    </p>
    <p className="text-sm text-muted-foreground mt-1">
      The Grand Pavilion, Austin, TX
    </p>

    {/* Bottom flourish */}
    <div className="flex items-center justify-center gap-3 mt-5">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
      <Heart size={14} className="text-accent fill-accent" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
    </div>
  </div>;

// ─── Step 1 — Attendance ──────────────────────────────────────────────────────

const StepAttendance = ({
  value,
  onChange
}) => <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">
        Will you be joining us?
      </h2>
      <p className="text-sm text-muted-foreground">
        Kindly reply by May 1, 2025
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      {/* Accepts */}
      <button type="button" onClick={() => onChange("attending")} className={`group relative p-6 rounded-2xl border-2 transition-all duration-200 text-left ${value === "attending" ? "border-primary bg-primary/8 shadow-md shadow-primary/10" : "border-border/60 bg-card hover:border-primary/40 hover:shadow-md"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${value === "attending" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          <CheckCircle2 size={22} />
        </div>
        <p className="font-heading text-lg font-semibold text-foreground italic">
          Joyfully accepts
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          I'll be there to celebrate!
        </p>
        {value === "attending" && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <CheckCircle2 size={12} className="text-primary-foreground" />
          </div>}
      </button>

      {/* Declines */}
      <button type="button" onClick={() => onChange("declined")} className={`group relative p-6 rounded-2xl border-2 transition-all duration-200 text-left ${value === "declined" ? "border-destructive/60 bg-destructive/5 shadow-md shadow-destructive/5" : "border-border/60 bg-card hover:border-destructive/30 hover:shadow-md"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${value === "declined" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <XCircle size={22} />
        </div>
        <p className="font-heading text-lg font-semibold text-foreground italic">
          Regretfully declines
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          I won't be able to make it.
        </p>
        {value === "declined" && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-destructive/60 flex items-center justify-center">
            <CheckCircle2 size={12} className="text-white" />
          </div>}
      </button>
    </div>
  </div>;

// ─── Step 2 — Your Info ───────────────────────────────────────────────────────

const StepYourInfo = ({
  data,
  onChange,
  errors,
  isAttending
}) => <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">
        Your information
      </h2>
      <p className="text-sm text-muted-foreground">
        {isAttending ? "We can't wait to see you!" : "We'll miss you dearly."}
      </p>
    </div>

    <div className="space-y-4">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">First Name *</Label>
          <Input placeholder="Jane" value={data.firstName} onChange={e => onChange("firstName", e.target.value)} className={`${inputCls} ${errors.firstName ? "border-destructive" : ""}`} />
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">Last Name *</Label>
          <Input placeholder="Smith" value={data.lastName} onChange={e => onChange("lastName", e.target.value)} className={`${inputCls} ${errors.lastName ? "border-destructive" : ""}`} />
          {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-muted-foreground">Email Address *</Label>
        <Input type="email" placeholder="you@example.com" value={data.email} onChange={e => onChange("email", e.target.value)} className={`${inputCls} ${errors.email ? "border-destructive" : ""}`} />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        <p className="text-xs text-muted-foreground">
          We'll send your confirmation here.
        </p>
      </div>

      {/* Meal preference — only if attending */}
      {isAttending && <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Your Meal Preference *
          </Label>
          <Select value={data.myMeal} onValueChange={v => onChange("myMeal", v)}>
            <SelectTrigger className={`${inputCls} ${errors.myMeal ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select a meal..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {MEAL_OPTIONS.map(m => <SelectItem key={m} value={m.toLowerCase()}>
                  {m}
                </SelectItem>)}
            </SelectContent>
          </Select>
          {errors.myMeal && <p className="text-xs text-destructive">{errors.myMeal}</p>}
        </div>}

      {/* Dietary restrictions */}
      {isAttending && <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Dietary Restrictions{" "}
            <span className="text-muted-foreground/60 font-normal">(optional)</span>
          </Label>
          <Input placeholder="Gluten-free, nut allergy, etc." value={data.dietaryNotes} onChange={e => onChange("dietaryNotes", e.target.value)} className={inputCls} />
        </div>}
    </div>
  </div>;

// ─── Step 3 — Plus Ones ───────────────────────────────────────────────────────

const StepPlusOnes = ({
  data,
  onChange
}) => {
  const updatePlusOneCount = count => {
    const current = data.plusOnes;
    const updated = Array.from({
      length: count
    }, (_, i) => ({
      name: current[i]?.name ?? "",
      meal: current[i]?.meal ?? ""
    }));
    onChange("plusOneCount", count);
    onChange("plusOnes", updated);
  };
  const updatePlusOne = (index, field, value) => {
    const updated = data.plusOnes.map((p, i) => i === index ? {
      ...p,
      [field]: value
    } : p);
    onChange("plusOnes", updated);
  };
  return <div className="animate-fade-up space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-heading text-2xl font-semibold text-foreground italic">
          Will you bring guests?
        </h2>
        <p className="text-sm text-muted-foreground">
          You may bring up to 3 additional guests.
        </p>
      </div>

      {/* Count selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Additional guests
        </Label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(n => <button key={n} type="button" onClick={() => updatePlusOneCount(n)} className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${data.plusOneCount === n ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/60 bg-card text-foreground hover:border-primary/40"}`}>
              {n === 0 ? "None" : `+${n}`}
            </button>)}
        </div>
      </div>

      {/* Plus one fields */}
      {data.plusOneCount > 0 && <div className="space-y-4">
          {data.plusOnes.map((guest, i) => <div key={i} className="bg-muted/40 rounded-2xl p-4 border border-border/40 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  <Users size={12} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Guest {i + 1}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Full Name
                  </Label>
                  <Input placeholder="Guest name" value={guest.name} onChange={e => updatePlusOne(i, "name", e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Meal Preference
                  </Label>
                  <Select value={guest.meal} onValueChange={v => updatePlusOne(i, "meal", v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select meal..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {MEAL_OPTIONS.map(m => <SelectItem key={m} value={m.toLowerCase()}>
                          {m}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>)}
        </div>}

      {data.plusOneCount === 0 && <div className="bg-muted/30 rounded-2xl p-5 border border-border/40 text-center">
          <Users size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Just you — we'll save a seat!
          </p>
        </div>}
    </div>;
};

// ─── Step 4 — Message ─────────────────────────────────────────────────────────

const StepMessage = ({
  data,
  onChange,
  isAttending
}) => <div className="animate-fade-up space-y-6">
    <div className="text-center space-y-1">
      <h2 className="font-heading text-2xl font-semibold text-foreground italic">
        {isAttending ? "Leave them a note" : "Send your wishes"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isAttending ? "Share your excitement with the couple!" : "Let Sarah & Michael know you're thinking of them."}
      </p>
    </div>

    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">
        Your message{" "}
        <span className="text-muted-foreground/60 font-normal">(optional)</span>
      </Label>
      <Textarea placeholder={isAttending ? "Can't wait to celebrate with you both! 🥂" : "Wishing you both all the happiness in the world!"} value={data.message} onChange={e => onChange("message", e.target.value)} className="min-h-[140px] bg-background border-border/60 rounded-xl resize-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      <p className="text-xs text-muted-foreground text-right">
        {data.message.length}/300
      </p>
    </div>

    {/* Summary card */}
    <div className="bg-primary/8 border border-primary/20 rounded-2xl p-5 space-y-2">
      <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">
        Your RSVP Summary
      </p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium text-foreground">
            {data.firstName} {data.lastName}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Attending</span>
          <span className={`font-semibold ${isAttending ? "text-primary" : "text-destructive"}`}>
            {isAttending ? "Yes, accepting!" : "Regretfully declining"}
          </span>
        </div>
        {isAttending && <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total guests</span>
              <span className="font-medium text-foreground">
                {data.plusOneCount + 1}{" "}
                {data.plusOneCount + 1 === 1 ? "person" : "people"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your meal</span>
              <span className="font-medium text-foreground capitalize">
                {data.myMeal || "—"}
              </span>
            </div>
          </>}
      </div>
    </div>
  </div>;

// ─── Confirmation Screen ──────────────────────────────────────────────────────

const ConfirmationScreen = ({
  isAttending,
  name
}) => <div className="text-center animate-fade-up space-y-6 py-4">
    <div className="relative inline-flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        {isAttending ? <Heart size={40} className="text-primary fill-primary/30" /> : <Sparkles size={40} className="text-accent" />}
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
        {isAttending ? `Thank you, ${name}! Your RSVP has been recorded. A confirmation will be sent to your email.` : `Thank you, ${name}. Sarah & Michael will miss you, but appreciate you letting them know.`}
      </p>
    </div>

    {isAttending && <div className="bg-card border border-border/50 rounded-2xl p-5 text-left space-y-3 shadow-sm">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Event Details
        </p>
        <div className="space-y-1.5 text-sm">
          <p className="text-foreground font-medium">Sarah &amp; Michael's Wedding</p>
          <p className="text-muted-foreground">Saturday, June 15, 2025 · 4:00 PM</p>
          <p className="text-muted-foreground">The Grand Pavilion, Austin, TX</p>
        </div>
      </div>}

    <p className="text-xs text-muted-foreground">
      Questions? Contact the couple at{" "}
      <a href="mailto:sarah.michael.wedding@example.com" className="text-primary hover:underline">
        sarah.michael.wedding@example.com
      </a>
    </p>
  </div>;

// ─── Main RSVP Component ──────────────────────────────────────────────────────

const RSVP = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    attendance: null,
    firstName: "",
    lastName: "",
    email: "",
    plusOneCount: 0,
    plusOnes: [],
    myMeal: "",
    dietaryNotes: "",
    message: ""
  });
  const isAttending = form.attendance === "attending";
  const updateForm = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear related errors
    setErrors(prev => {
      const next = {
        ...prev
      };
      delete next[field];
      return next;
    });
  };

  // ── Validation per step ──────────────────────────────────────────────────

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.attendance) errs.attendance = "Please select an option.";
    }
    if (step === 1) {
      if (!form.firstName.trim()) errs.firstName = "First name is required.";
      if (!form.lastName.trim()) errs.lastName = "Last name is required.";
      if (!form.email.trim()) errs.email = "Email is required.";else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email.";
      if (isAttending && !form.myMeal) errs.myMeal = "Please select a meal.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const nextStep = () => {
    if (!validateStep()) return;
    // Skip plus-ones step if not attending
    if (step === 1 && !isAttending) {
      setStep(3); // jump to message
    } else {
      setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
    }
  };
  const prevStep = () => {
    // Mirror the skip logic going back
    if (step === 3 && !isAttending) {
      setStep(1);
    } else {
      setStep(s => Math.max(s - 1, 0));
    }
  };
  const handleSubmit = () => {
    setLoading(true);
    // Simulate API call — replace with Firebase Firestore write
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1600);
  };

  // ── Effective step count (3 if declining, 4 if attending) ────────────────
  const visibleSteps = isAttending ? TOTAL_STEPS : TOTAL_STEPS - 1;
  const visualStep = step === 3 && !isAttending ? 2 : isAttending ? step : step;
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Decorative top bar */}
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

          {/* Invitation header — always visible */}
          <InvitationHeader />

          {/* Card */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-foreground/[0.04] p-6 sm:p-8">
            {submitted ? <ConfirmationScreen isAttending={isAttending} name={form.firstName} /> : <>
                <StepIndicator current={visualStep} total={visibleSteps} />

                {/* Step content */}
                {step === 0 && <StepAttendance value={form.attendance} onChange={v => updateForm("attendance", v)} />}
                {step === 1 && <StepYourInfo data={form} onChange={updateForm} errors={errors} isAttending={isAttending} />}
                {step === 2 && isAttending && <StepPlusOnes data={form} onChange={updateForm} />}
                {step === 3 && <StepMessage data={form} onChange={updateForm} isAttending={isAttending} />}

                {/* Attendance error */}
                {step === 0 && errors.attendance && <p className="text-xs text-destructive text-center mt-3">
                    {errors.attendance}
                  </p>}

                {/* Navigation */}
                <div className={`flex items-center mt-8 ${step > 0 ? "justify-between" : "justify-end"}`}>
                  {step > 0 && <Button variant="ghost" onClick={prevStep} className="rounded-xl gap-1.5 text-muted-foreground">
                      <ChevronLeft size={16} /> Back
                    </Button>}

                  {step < TOTAL_STEPS - 1 ? <Button variant="default" onClick={nextStep} className="rounded-xl gap-1.5" disabled={step === 0 && !form.attendance}>
                      Continue <ChevronRight size={16} />
                    </Button> : <Button variant="default" onClick={handleSubmit} className="rounded-xl gap-1.5 px-6" disabled={loading}>
                      {loading ? <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Submitting...
                        </span> : <>
                          <MessageSquare size={16} />
                          {isAttending ? "Send my RSVP" : "Send response"}
                        </>}
                    </Button>}
                </div>
              </>}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Powered by{" "}
            <span className="font-heading font-semibold text-foreground">
              ToGather
            </span>
          </p>
        </div>
      </main>

      <Footer />
    </div>;
};
export default RSVP;
