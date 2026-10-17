// AuthProvider: the profile read on sign-in uses the `betrothed` collection
// (the one firestore.rules lets the owner read), and a failed read can neither
// escape as an unhandled rejection nor leave `loading` stuck on true.
// Firebase is mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const fb = vi.hoisted(() => ({ authCallback: null }));

vi.mock("@/lib/firebase", () => ({ firebaseAuth: {}, db: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => { fb.authCallback = cb; return () => {}; }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: vi.fn(),
}));
// jsdom runs at an opaque origin — stub the settings builder so the test can
// assert AuthContext passes through whatever it returns.
vi.mock("@/lib/emailVerification", () => ({
  verificationActionCodeSettings: vi.fn(() => ({ url: "https://app.test/verify-email" })),
}));
// Profile repair goes through the transaction helper — mock the boundary so
// tests assert WHAT AuthContext asks for, not Firestore plumbing.
vi.mock("@/lib/firestore", () => ({
  recoverUserProfile: vi.fn(),
}));

import { doc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { recoverUserProfile } from "@/lib/firestore";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const Probe = () => {
  const { user, userProfile, profileMissing, loading } = useAuth();
  return (
    <p data-testid="probe" data-missing={String(profileMissing)}>
      {loading ? "loading" : "ready"}|{user?.uid ?? "none"}|{userProfile?.name ?? "no-profile"}
    </p>
  );
};

const renderProvider = () =>
  render(<AuthProvider><Probe /></AuthProvider>);

// Fire the auth listener and wait for its async work (returns its promise).
const fireAuth = (user) => act(async () => { await fb.authCallback(user); });

describe("AuthProvider profile load", () => {
  beforeEach(() => {
    fb.authCallback = null;
    vi.mocked(doc).mockClear();
    vi.mocked(getDoc).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reads the profile from betrothed/{uid}", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ name: "Chris" }) });
    renderProvider();
    await fireAuth({ uid: "u1" });

    expect(doc).toHaveBeenCalledWith({}, "betrothed", "u1");
    expect(screen.getByTestId("probe").textContent).toBe("ready|u1|Chris");
  });

  it("a permission-denied profile read is handled: no rejection, loading cleared, user still signed in", async () => {
    const denied = Object.assign(new Error("No matching allow statements"), { code: "permission-denied" });
    vi.mocked(getDoc).mockRejectedValue(denied);
    renderProvider();

    // If the listener's promise rejected, this await would throw and fail the test
    await fireAuth({ uid: "u1" });
    expect(screen.getByTestId("probe").textContent).toBe("ready|u1|no-profile");
    expect(console.error).toHaveBeenCalledWith("Failed to load user profile:", denied);
  });

  it("signing out clears user and profile without reading Firestore", async () => {
    renderProvider();
    await fireAuth(null);
    expect(getDoc).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").textContent).toBe("ready|none|no-profile");
  });
});

// ── signup() — verification email on account creation ─────────────────────────
// The provider's signup() creates the auth account, sets the display name and
// sends the verification email. A failed send must NOT fail the signup or
// retry account creation.
const SignupProbe = ({ onReady }) => {
  const { signup } = useAuth();
  return <button data-testid="go" onClick={async () => {
    try { onReady(await signup("Jane", "jane@example.com", "passw0rd1")); }
    catch (err) { onReady(err); }
  }} />;
};

const runSignup = async (result) => {
  render(<AuthProvider><SignupProbe onReady={(r) => { result.current = r; }} /></AuthProvider>);
  await fireAuth(null); // settle the provider
  await act(async () => { screen.getByTestId("go").click(); });
};

describe("AuthProvider signup + verification email", () => {
  const fakeUser = { uid: "new-uid" };

  beforeEach(() => {
    vi.mocked(createUserWithEmailAndPassword).mockReset().mockResolvedValue({ user: fakeUser });
    vi.mocked(updateProfile).mockReset().mockResolvedValue();
    vi.mocked(sendEmailVerification).mockReset().mockResolvedValue();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends a verification email after creating the account", async () => {
    const result = {};
    await runSignup(result);

    expect(updateProfile).toHaveBeenCalledWith(fakeUser, { displayName: "Jane" });
    expect(sendEmailVerification).toHaveBeenCalledWith(fakeUser, { url: "https://app.test/verify-email" });
    expect(result.current).toEqual({ uid: "new-uid", verificationSent: true });
  });

  it("still resolves when the verification email fails — no duplicate account creation", async () => {
    vi.mocked(sendEmailVerification).mockRejectedValue(Object.assign(new Error("rate"), { code: "auth/too-many-requests" }));
    const result = {};
    await runSignup(result);

    expect(result.current).toEqual({ uid: "new-uid", verificationSent: false });
    expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
  });

  it("still resolves when updateProfile fails — the account already exists", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error("profile write failed"));
    const result = {};
    await runSignup(result);

    // The email still goes out and signup resolves — the canonical name
    // lives in the betrothed Firestore doc, not the Auth profile.
    expect(result.current).toEqual({ uid: "new-uid", verificationSent: true });
    expect(sendEmailVerification).toHaveBeenCalled();
  });

  it("propagates account-creation failures and never sends an email", async () => {
    const err = Object.assign(new Error("exists"), { code: "auth/email-already-in-use" });
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValue(err);
    const result = {};
    await runSignup(result);

    expect(result.current).toBe(err);
    expect(sendEmailVerification).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

// ── Profile recovery — missing betrothed/{uid} detection and repair ────────────
// Signup can lose the profile write after the Auth account exists. The
// provider detects the missing doc on every sign-in (covers refresh,
// logout/login, and already-verified sessions — none depend on route state),
// repairs it silently when the name is still on the Auth profile, and flags
// profileMissing when it isn't so guards can route to /finish-profile.
const RecoveryProbe = ({ onReady }) => {
  const ctx = useAuth();
  return (
    <>
      <Probe />
      <button data-testid="recover" onClick={async () => {
        try { onReady(await ctx.recoverProfile(ctx.pendingName)); }
        catch (err) { onReady(err); }
      }} />
      <button data-testid="refresh" onClick={async () => {
        onReady(await ctx.refreshUserProfile());
      }} />
    </>
  );
};

const renderRecovery = (onReady = () => {}) =>
  render(<AuthProvider><RecoveryProbe onReady={onReady} /></AuthProvider>);

describe("AuthProvider profile recovery", () => {
  beforeEach(() => {
    fb.authCallback = null;
    vi.mocked(doc).mockClear();
    vi.mocked(getDoc).mockReset();
    vi.mocked(recoverUserProfile).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("repairs a missing profile silently when the Auth display name survives", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    vi.mocked(recoverUserProfile).mockResolvedValue({
      created: true,
      profile: { userId: "u9", name: "Jane Smith", email: "jane@example.com" },
    });
    renderRecovery();
    await fireAuth({ uid: "u9", displayName: "Jane Smith", email: "jane@example.com" });

    expect(recoverUserProfile).toHaveBeenCalledWith("u9", "Jane Smith", "jane@example.com");
    const probe = screen.getByTestId("probe");
    expect(probe.textContent).toBe("ready|u9|Jane Smith");
    expect(probe.dataset.missing).toBe("false");
  });

  it("flags profileMissing instead of repairing when no name is recoverable", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    renderRecovery();
    await fireAuth({ uid: "u9", displayName: null, email: "jane@example.com" });

    expect(recoverUserProfile).not.toHaveBeenCalled();
    const probe = screen.getByTestId("probe");
    expect(probe.textContent).toBe("ready|u9|no-profile");
    expect(probe.dataset.missing).toBe("true");
  });

  it("never touches recovery for an account whose profile exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ name: "Chris" }) });
    renderRecovery();
    await fireAuth({ uid: "u1", displayName: "Chris", email: "c@x.com" });

    expect(recoverUserProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").dataset.missing).toBe("false");
  });

  it("does not flag profileMissing when the profile READ fails", async () => {
    // A failed read is not a confirmed-missing doc — flagging it would send
    // users to a repair screen for a transient error.
    vi.mocked(getDoc).mockRejectedValue(new Error("offline"));
    renderRecovery();
    await fireAuth({ uid: "u1", displayName: "Chris", email: "c@x.com" });

    expect(recoverUserProfile).not.toHaveBeenCalled();
    const probe = screen.getByTestId("probe");
    expect(probe.textContent).toBe("ready|u1|no-profile");
    expect(probe.dataset.missing).toBe("false");
  });

  it("skips auto-repair while signup is in flight — Signup owns the write", async () => {
    // Hold signup() mid-flight so the listener runs while the flag is set.
    vi.mocked(createUserWithEmailAndPassword).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    let context;
    const CtxProbe = () => { context = useAuth(); return <Probe />; };
    render(<AuthProvider><CtxProbe /></AuthProvider>);
    await fireAuth(null);

    context.signup("Jane", "jane@example.com", "passw0rd1"); // never resolves — flag stays up
    await fireAuth({ uid: "u9", displayName: "Jane", email: "jane@example.com" });

    expect(recoverUserProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").dataset.missing).toBe("true");
  });

  it("recoverProfile writes through the transaction and clears the flag", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    vi.mocked(recoverUserProfile).mockResolvedValue({
      created: true,
      profile: { userId: "u9", name: "Jane Smith", email: "jane@example.com" },
    });
    let context;
    const CtxProbe = () => { context = useAuth(); return <Probe />; };
    render(<AuthProvider><CtxProbe /></AuthProvider>);
    await fireAuth({ uid: "u9", displayName: null, email: "jane@example.com" });
    expect(screen.getByTestId("probe").dataset.missing).toBe("true");

    await act(async () => { await context.recoverProfile("  Jane Smith  "); });

    expect(recoverUserProfile).toHaveBeenCalledWith("u9", "Jane Smith", "jane@example.com");
    const probe = screen.getByTestId("probe");
    expect(probe.textContent).toBe("ready|u9|Jane Smith");
    expect(probe.dataset.missing).toBe("false");
  });

  it("recoverProfile falls back to the Auth display name when none is typed", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    vi.mocked(recoverUserProfile).mockResolvedValue({
      created: true, profile: { userId: "u9", name: "Jane", email: "j@x.com" },
    });
    let context;
    const CtxProbe = () => { context = useAuth(); return <Probe />; };
    render(<AuthProvider><CtxProbe /></AuthProvider>);
    await fireAuth({ uid: "u9", displayName: "Jane", email: "j@x.com" });
    // displayName present → auto-repair already ran once; reset and call manually
    vi.mocked(recoverUserProfile).mockClear();

    await act(async () => { await context.recoverProfile("   "); });
    expect(recoverUserProfile).toHaveBeenCalledWith("u9", "Jane", "j@x.com");
  });

  it("recoverProfile refuses to invent a name when none is recoverable", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    let context;
    const CtxProbe = () => { context = useAuth(); return <Probe />; };
    render(<AuthProvider><CtxProbe /></AuthProvider>);
    await fireAuth({ uid: "u9", displayName: null, email: "j@x.com" });

    await expect(act(async () => { await context.recoverProfile("   "); }))
      .rejects.toThrow(/enter your name/i);
    expect(recoverUserProfile).not.toHaveBeenCalled();
  });

  it("refreshUserProfile picks up a profile created after the last check", async () => {
    // First read: missing (displayName null → can't auto-repair) → flag set.
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    let context;
    const CtxProbe = () => { context = useAuth(); return <Probe />; };
    render(<AuthProvider><CtxProbe /></AuthProvider>);
    await fireAuth({ uid: "u9", displayName: null, email: "j@x.com" });
    expect(screen.getByTestId("probe").dataset.missing).toBe("true");

    // Another tab / delayed signup write creates it; a refresh finds it.
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ name: "Jane Smith" }) });
    await act(async () => { await context.refreshUserProfile(); });

    const probe = screen.getByTestId("probe");
    expect(probe.textContent).toBe("ready|u9|Jane Smith");
    expect(probe.dataset.missing).toBe("false");
    expect(recoverUserProfile).not.toHaveBeenCalled();
  });
});
