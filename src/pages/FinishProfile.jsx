// src/pages/FinishProfile.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Last-resort repair for an account whose betrothed/{uid} profile is missing.
//   Reached only when AuthContext confirmed the doc is absent AND couldn't
//   rebuild it silently (the name wasn't recoverable from the Auth profile).
//
//   The user is signed in — we ask for the one piece we can't invent (their
//   name), then recoverProfile() writes it through an idempotent transaction
//   that never overwrites an existing profile.
//
//   On mount the page re-checks Firestore once: the profile may have been
//   created since the auth listener last looked (signup race, another tab),
//   in which case there's nothing to do and the user continues straight on.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Footer from "@/components/Footer";
import { Loader2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/assets/logo.svg";
import FormError from "@/components/ui/form-error";
import { validateName } from "@/utils/validation";

const FinishProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profileMissing, logout, recoverProfile, refreshUserProfile } = useAuth();

  const [name, setName]           = useState("");
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [checking, setChecking]   = useState(true); // one refresh pass on mount

  // Prefill whatever name the Auth profile still holds — the user confirms it
  // rather than re-typing when it's right.
  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
  }, [user?.displayName]);

  // The doc may exist by now (signup race resolved, another tab repaired it).
  // refreshUserProfile is a fresh closure each render, so the ref — not the
  // dep array — is what guarantees this runs exactly once.
  const didRefresh = useRef(false);
  useEffect(() => {
    if (didRefresh.current) return;
    didRefresh.current = true;
    let cancelled = false;
    (async () => {
      try { await refreshUserProfile(); } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshUserProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameError = validateName(name);
    if (nameError) { setError(nameError); return; }
    setSaving(true);
    setError(null);
    try {
      await recoverProfile(name);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch {
      setError("We couldn't save your profile right now. Please try again.");
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Session still resolving, or we're doing the one mount-time re-check.
  if (loading || checking || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Nothing to repair after all — the refresh found the profile (or another
  // path fixed it). Send them where they were headed.
  if (!profileMissing) {
    return <Navigate to={location.state?.from || "/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md animate-fade-up">
          <div className="bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 space-y-8">

            <div className="text-center space-y-4">
              <img src={Logo} className="h-20 mx-auto w-auto" alt="ToGather logo" />
              <UserRound size={40} className="mx-auto text-primary" aria-hidden="true" />
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                Finish setting up your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Your account <span className="font-semibold text-foreground">{user.email}</span> was
                created, but your profile didn't finish saving. Confirm your name
                below and we'll complete it — you only need to do this once.
              </p>
            </div>

            <FormError message={error} />

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-semibold text-foreground">Full name</Label>
                <Input id="name" placeholder="Jane Smith" value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  className={`bg-popover h-12 border rounded-xl transition-all focus:ring-2 focus:ring-primary/20 ${
                    error ? "border-destructive" : "border-border"}`} />
              </div>

              <Button variant="default" className="w-full rounded-xl" size="lg" type="submit" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </span>
                ) : "Save and continue"}
              </Button>
            </form>

            <button type="button" onClick={handleLogout}
              className="w-full min-h-11 flex items-center justify-center gap-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <LogOut size={15} /> Log out
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FinishProfile;
