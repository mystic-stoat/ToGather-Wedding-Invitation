// src/pages/VerifyEmail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Landing screen for newly registered accounts that must verify their email.
//   The user stays signed in (so Resend works) but every protected route
//   bounces them here until Firebase reports emailVerified === true.
//
//   Buttons:
//     "I've verified my email" → reloads the Firebase user, then continues
//     "Resend verification email" → new email; 60s cooldown per send
//     "Log out" → back to /login so they can sign in later (after verifying
//     in another tab or on another device, a fresh login also works)
//
// REACHED FROM:
//   Signup.jsx after account creation, Login.jsx for unverified new accounts,
//   and ProtectedRoute in App.jsx when a pending user hits a protected URL.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { MailCheck, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createUserProfile } from "@/lib/firestore";
import Logo from "@/assets/logo.svg";
import { VERIFICATION_RESEND_COOLDOWN } from "@/lib/emailVerification";

// Maps Firebase errors to friendly copy for the resend/refresh actions.
const describeSendError = (code) => {
  if (code === "auth/too-many-requests")
    return "Too many emails requested. Please wait a few minutes before trying again.";
  if (code === "auth/network-request-failed")
    return "Network error — check your connection and try again.";
  if (code === "auth/user-token-expired" || code === "auth/requires-recent-login")
    return "Your session expired. Please log out and sign in again.";
  return "We couldn't send the email right now. Please try again.";
};

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout, resendVerificationEmail, reloadCurrentUser } = useAuth();

  const [checking, setChecking]       = useState(false); // "I've verified" in flight
  const [sending, setSending]         = useState(false); // resend in flight
  const [cooldown, setCooldown]       = useState(0);     // seconds left before resend re-enables
  const [message, setMessage]         = useState(null);  // { kind: "info"|"success"|"error", text }
  const cooldownTimer                 = useRef(null);

  // Signup can land here when part of the follow-up work failed — the
  // account itself always exists at this point, so the messages below say
  // exactly what still needs finishing instead of implying a failed signup.
  const pendingProfile = location.state?.profileSaveFailed
    ? { name: location.state.name, email: location.state.email }
    : null;

  useEffect(() => {
    const { verificationSendFailed, profileSaveFailed } = location.state ?? {};
    if (verificationSendFailed) {
      setMessage({
        kind: "error",
        text: "Your account was created, but the verification email couldn't be sent. Use the resend button below.",
      });
    } else if (profileSaveFailed) {
      setMessage({
        kind: "info",
        text: "Your account was created — your profile is still being saved and will finish when you continue.",
      });
    }
  }, [location.state]);

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownTimer.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(cooldownTimer.current), []);

  // ── "I've verified my email" ──────────────────────────────────────────────
  const handleCheckVerified = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const fresh = await reloadCurrentUser();
      if (fresh?.emailVerified) {
        // Finish the deferred profile write from signup, if any. Best-effort —
        // never block entry to the app on it.
        if (pendingProfile) {
          try {
            await createUserProfile(fresh.uid, pendingProfile.name, pendingProfile.email);
          } catch (err) {
            console.error("Profile save retry failed:", err);
          }
        }
        navigate("/dashboard", { replace: true });
      } else {
        setMessage({
          kind: "info",
          text: "Your email isn't verified yet. Click the link in your inbox, then try again.",
        });
      }
    } catch {
      setMessage({ kind: "error", text: "Couldn't check your verification status. Please try again." });
    } finally {
      setChecking(false);
    }
  };

  // ── "Resend verification email" ───────────────────────────────────────────
  const handleResend = async () => {
    setSending(true);
    setMessage(null);
    try {
      await resendVerificationEmail();
      startCooldown(VERIFICATION_RESEND_COOLDOWN);
      setMessage({ kind: "success", text: "Verification email sent — check your inbox and spam folder." });
    } catch (err) {
      const code = err?.code;
      if (code === "auth/too-many-requests") startCooldown(VERIFICATION_RESEND_COOLDOWN);
      setMessage({ kind: "error", text: describeSendError(code) });
    } finally {
      setSending(false);
    }
  };

  // ── "Log out" — lets them sign back in once the link is clicked elsewhere ──
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // The route wrapper already redirects signed-out and verified users away;
  // this guard only covers the brief window before AuthContext resolves.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const messageStyles = {
    info:    "border-border bg-muted/50 text-foreground",
    success: "border-primary/30 bg-status-accepted-bg text-status-accepted",
    error:   "border-destructive/30 bg-destructive/5 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md animate-fade-up">
          <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 space-y-8">

            {/* Brand header */}
            <div className="text-center space-y-4">
              <img src={Logo} className="h-20 mx-auto w-auto" alt="ToGather logo" />
              <MailCheck size={40} className="mx-auto text-primary" aria-hidden="true" />
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                Verify your email address
              </h1>
              <p className="text-sm text-muted-foreground">
                We've sent a verification link to{" "}
                <span className="font-semibold text-foreground">{user.email}</span>.
                Please check your inbox and click the link to activate your account.
              </p>
            </div>

            {/* Status message — announced to screen readers */}
            {message && (
              <div role="status" aria-live="polite"
                className={`rounded-xl border px-4 py-3 text-sm ${messageStyles[message.kind]}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-3">
              {/* Primary action — refresh verification status */}
              <Button variant="default" className="w-full rounded-xl" size="lg"
                onClick={handleCheckVerified} disabled={checking || sending}>
                {checking ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Checking...
                  </span>
                ) : "I've verified my email"}
              </Button>

              {/* Resend — disabled while sending or cooling down */}
              <Button variant="outline" className="w-full rounded-xl" size="lg"
                onClick={handleResend} disabled={sending || checking || cooldown > 0}>
                {sending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Sending...
                  </span>
                ) : cooldown > 0 ? (
                  `Resend verification email (${cooldown}s)`
                ) : "Resend verification email"}
              </Button>

              {/* Escape hatch — verify later from a fresh login */}
              <button type="button" onClick={handleLogout}
                className="w-full min-h-11 flex items-center justify-center gap-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <LogOut size={15} /> Log out
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Verified on another device or in a different tab? Just log out and
              sign back in — your account will pick up the change.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VerifyEmail;
