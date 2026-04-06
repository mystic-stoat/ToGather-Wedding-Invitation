// src/pages/Signup.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   New user registration. When the form submits, TWO things happen:
//
//   1. Firebase Auth account is created (handles login credentials)
//   2. A `bethrothed` document is created in Firestore (stores profile info)
//
// WHY BOTH?
//   Firebase Auth only stores email + password for authentication.
//   Firestore stores the user's name, join date, and preferences —
//   data the app needs to display and work with.
//
// FIREBASE ERROR CODES WE HANDLE:
//   auth/email-already-in-use → account with this email exists
//   auth/weak-password        → password not strong enough
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Footer from "@/components/Footer";
import { Eye, EyeOff, Mail, Lock, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createUserProfile } from "@/lib/firestore"; // creates the bethrothed doc

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth(); // get signup function from AuthContext

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirm, setConfirm]           = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [errors, setErrors]             = useState({});
  const [loading, setLoading]           = useState(false);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!name.trim())
      errs.name = "Full name is required";
    if (!email)
      errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    if (!password)
      errs.password = "Password is required";
    else if (password.length < 8)
      errs.password = "Must be at least 8 characters";
    if (!confirm)
      errs.confirm = "Please confirm your password";
    else if (confirm !== password)
      errs.confirm = "Passwords don't match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Form submission ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      // Step 1: Create Firebase Auth account
      // signup() is in AuthContext — calls Firebase and returns { uid }
      const { uid } = await signup(name.trim(), email, password);

      // Step 2: Create the Firestore profile document in `bethrothed` collection
      // We use the Firebase Auth uid as the document ID so it's easy to look up
      await createUserProfile(uid, name.trim(), email);

      // Step 3: Go to dashboard
      navigate("/dashboard");

    } catch (err) {
    // ADD THIS LINE so you can see the real error in the browser console
      console.error("Signup error:", err);

      const code = err.code;
      if (code === "auth/email-already-in-use") {
        setErrors({ general: "An account with this email already exists." });
      } else if (code === "auth/weak-password") {
        setErrors({ password: "Password is too weak." });
      } else {
        setErrors({ general: `Something went wrong: ${err.message}` });
      }
    }
  };

  // Helper: remove a field's error when user starts typing again
  const clearError = (key) =>
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });

  // Helper: adds red border to input if that field has an error
  const inputCls = (key) =>
    `h-12 pl-10 bg-background border rounded-xl transition-all focus:ring-2 focus:ring-primary/20 ${
      errors[key] ? "border-destructive" : "border-border"
    }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md animate-fade-up">
          <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 space-y-8">

            {/* Brand header */}
            <div className="text-center space-y-4">
              <div className="inline-block bg-foreground rounded-xl px-6 py-3">
                <span className="font-heading text-2xl font-bold text-primary-foreground tracking-tight">
                  ToGather
                </span>
              </div>
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                Create your account
              </h1>
              <p className="text-sm text-muted-foreground">Start planning your perfect day</p>
            </div>

            {/* General error banner */}
            {errors.general && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive">{errors.general}</p>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-semibold text-foreground">Full name</Label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" placeholder="Jane Smith" value={name}
                    onChange={(e) => { setName(e.target.value); clearError("name"); }}
                    className={inputCls("name")} />
                </div>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                    className={inputCls("email")} />
                </div>
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters..." value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                    className={`${inputCls("password")} pr-11`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-semibold text-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="confirm" type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your password..." value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); clearError("confirm"); }}
                    className={`${inputCls("confirm")} pr-11`} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirm ? "Hide password" : "Show password"}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
              </div>

              {/* Submit */}
              <Button variant="default" className="w-full rounded-xl" size="lg" type="submit" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Signup;
