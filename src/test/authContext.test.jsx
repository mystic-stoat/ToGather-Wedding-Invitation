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

import { doc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const Probe = () => {
  const { user, userProfile, loading } = useAuth();
  return (
    <p data-testid="probe">
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
