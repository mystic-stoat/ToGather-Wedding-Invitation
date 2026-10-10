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
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: vi.fn(),
}));

import { doc, getDoc } from "firebase/firestore";
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
