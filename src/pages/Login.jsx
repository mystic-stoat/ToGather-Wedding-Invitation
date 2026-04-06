// src/pages/Login.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The login page. Lets existing users sign in with email + password.
//   Uses the `login` function from AuthContext which calls Firebase.
//
// FLOW:
//   1. User fills in email + password
//   2. Client-side validation runs (catches empty fields, bad format)
//   3. If valid → calls login() from AuthContext
//   4. If Firebase login succeeds → navigate to /dashboard
//   5. If Firebase login fails → show a friendly error message
//
// FIREBASE ERROR CODES WE HANDLE:
//   auth/invalid-credential → wrong email or password
//   auth/too-many-requests  → account temporarily locked after too many attempts
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Footer from "@/components/Footer";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // get login function from AuthContext

  // ── Form state ────────────────────────────────────────────────────────────
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]             = useState({}); // field-level errors
  const [loading, setLoading]           = useState(false);

  // ── Client-side validation ────────────────────────────────────────────────
  // Runs before hitting Firebase — catches obvious mistakes instantly
  // without a network request
  const validate = () => {
    const errs = {};
    if (!email)
      errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    if (!password)
      errs.password = "Password is required";
    else if (password.length < 8)
      errs.password = "Must be at least 8 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0; // true means no errors
  };

  // ── Form submission ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent browser page reload
    if (!validate()) return; // stop if client validation fails

    setLoading(true);
    setErrors({});

    try {
      // Call Firebase via AuthContext
      await login(email, password);
      // If we get here, login succeeded — go to dashboard
      navigate("/dashboard");
    } catch (err) {
      // Firebase error codes → friendly messages
      const code = err.code;
      if (code === "auth/user-not-found" ||
          code === "auth/wrong-password" ||
          code === "auth/invalid-credential") {
        setErrors({ general: "Incorrect email or password. Please try again." });
      } else if (code === "auth/too-many-requests") {
        setErrors({ general: "Too many attempts. Please wait a moment and try again." });
      } else {
        setErrors({ general: "Something went wrong. Please try again." });
      }
    } finally {
      setLoading(false); // always re-enable the button
    }
  };

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
              <h1 className="font-heading text-2xl font-semibold text-foreground">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to manage your wedding</p>
            </div>

            {/* General error banner — shown for wrong password, etc. */}
            {errors.general && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive">{errors.general}</p>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  {/* Icon inside the input */}
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Clear the error for this field as soon as user starts typing
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={`h-12 pl-10 bg-background border rounded-xl transition-all focus:ring-2 focus:ring-primary/20 ${
                      errors.email ? "border-destructive" : "border-border"
                    }`}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              {/* Password field with show/hide toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                    Password
                  </Label>
                  {/* Forgot password link */}
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"} // toggle visibility
                    placeholder="At least 8 characters..."
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className={`h-12 pl-10 pr-11 bg-background border rounded-xl transition-all focus:ring-2 focus:ring-primary/20 ${
                      errors.password ? "border-destructive" : "border-border"
                    }`}
                  />
                  {/* Eye toggle button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive mt-1">{errors.password}</p>
                )}
              </div>

              {/* Submit button — disabled + spinner while loading */}
              <Button
                variant="default"
                className="w-full rounded-xl"
                size="lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : "Log in"}
              </Button>
            </form>

            {/* Link to signup for new users */}
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline transition-colors">
                Sign up
              </Link>
            </p>

          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
