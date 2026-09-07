// src/pages/ForgotPassword.jsx

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Allows users to request a password reset email for their ToGather account.
//   Uses the `resetPassword` function from AuthContext which calls Firebase.
//
// FLOW:
//   1. User enters their email address
//   2. Client-side validation checks the email
//   3. If valid → calls resetPassword() from AuthContext
//   4. Firebase sends a password reset email
//   5. User receives a success message and can return to the login page
//
// FIREBASE ERROR CODES WE HANDLE:
//   auth/invalid-email      → email address is invalid
//   auth/too-many-requests  → too many reset attempts
// ─────────────────────────────────────────────────────────────────────────────




import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/assets/logo.svg";
import FormError from "@/components/ui/form-error";
import { useFormState } from "@/hooks/useFormState";
import { validateEmail } from "@/utils/validation";


const ForgotPassword = () => {

// ── Authentication and form state ─────────────────────────────────────────
// Get the existing Firebase password reset function from AuthContext
  const { resetPassword } = useAuth();


// useFormState manages validation errors and the form's loading state
  const {
    errors,
    setErrors,
    loading,
    setLoading,
    clearError
  } = useFormState();

// Store the user's email and the success message shown after submission
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");


// ── Client-side validation ──────────────────────────────────────────────── 
// Check the email before sending a password reset request to Firebase
  const validate = () => {
    const errs = {};

    const emailError = validateEmail(email);

    if (emailError) {
      errs.email = emailError;
    }

    setErrors(errs);

    return Object.keys(errs).length === 0;
  };

// ── Form submission ───────────────────────────────────────────────────────
// Validate the email, then request a password reset through AuthContext
  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setErrors({});
    setSuccess("");

    const isValid = validate();

    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      // Call Firebase password reset through AuthContext
      await resetPassword(email);

      // Show a confirmation message after Firebase accepts the request
      setSuccess(
        "Password reset email sent. Check your inbox for instructions."
      );

    } catch (err) {
      // Convert Firebase error codes into friendly messages for the user
      const code = err.code;

      if (code === "auth/invalid-email") {
        setErrors({
          general: "Please enter a valid email address."
        });
      } else if (code === "auth/too-many-requests") {
        setErrors({
          general: "Too many attempts. Please wait a moment and try again."
        });
      } else {
        setErrors({
          general: "Something went wrong. Please try again."
        });
      }

    } finally {
      // Always re-enable the submit button after Firebase finishes
      setLoading(false);
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
              <div className="inline-block bg-secondary rounded-xl px-6 py-3">
                <img
                  src={Logo}
                  className="h-20 mx-auto w-auto"
                  alt="ToGather logo"
                />

                <span className="font-heading text-2xl font-bold tracking-tight">
                  ToGather
                </span>
              </div>

              <div>
                <h1 className="font-heading text-2xl font-semibold text-foreground">
                  Forgot Password
                </h1>

                <p className="text-sm text-muted-foreground mt-2">
                  Enter your email address and we'll send you a password reset link.
                </p>
              </div>
            </div>
            {/* Password reset form */}
            <form
              className="space-y-5"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* General error and success messages */}
              <FormError message={errors.general} />

              {success && (
                <p className="text-sm text-center text-foreground bg-secondary rounded-xl p-3">
                  {success}
                </p>
              )}
              {/* Email field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-semibold text-foreground"
                >
                  Email Address
                </Label>

                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);

                      // Clear old messages when the user edits the email
                      clearError("email");
                      setSuccess("");
                    }}
                    className={`text-center h-12 pl-10 pr-11 bg-background border rounded-xl transition-all focus:ring-2 focus:ring-primary/20 ${
                      errors.email ? "border-destructive" : "border-border"
                    }`}
                  />
                </div>

                <FormError message={errors.email} />
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
                    Sending...
                  </span>
                ) : "Send Reset Link"}
              </Button>
            </form>
            {/* Link back to login */}
            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                to="/login"
                className="font-semibold text-primary hover:underline transition-colors"
              >
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Shared site footer */}
      <Footer />
    </div>
  );
};

export default ForgotPassword;