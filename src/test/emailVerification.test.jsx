// Email verification — the requiresEmailVerification predicate plus the
// route-guard wiring in App.jsx. Pages are stubbed to plain markers and
// useAuth is mocked, so this tests routing decisions, not page contents.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  requiresEmailVerification,
  EMAIL_VERIFICATION_REQUIRED_AFTER,
  verificationActionCodeSettings,
} from "@/lib/emailVerification";

// ── Fake users ────────────────────────────────────────────────────────────────
const before = (ms) => new Date(EMAIL_VERIFICATION_REQUIRED_AFTER - ms).toUTCString();
const after  = (ms) => new Date(EMAIL_VERIFICATION_REQUIRED_AFTER + ms).toUTCString();

const legacyUser = { uid: "old", emailVerified: false, metadata: { creationTime: before(86_400_000) } };
const pendingUser = { uid: "new", emailVerified: false, metadata: { creationTime: after(60_000) } };
const verifiedUser = { uid: "ok", emailVerified: true, metadata: { creationTime: after(60_000) } };
const noMetadataUser = { uid: "x", emailVerified: false, metadata: {} };

describe("requiresEmailVerification", () => {
  it("is false for a verified user", () => {
    expect(requiresEmailVerification(verifiedUser)).toBe(false);
  });
  it("is false for a legacy account created before rollout, even when unverified", () => {
    expect(requiresEmailVerification(legacyUser)).toBe(false);
  });
  it("is true for an unverified account created after rollout", () => {
    expect(requiresEmailVerification(pendingUser)).toBe(true);
  });
  it("is false when creationTime is missing or unparsable (fail open for legacy data)", () => {
    expect(requiresEmailVerification(noMetadataUser)).toBe(false);
    expect(requiresEmailVerification({ uid: "x", emailVerified: false })).toBe(false);
  });
  it("is false for no user at all", () => {
    expect(requiresEmailVerification(null)).toBe(false);
    expect(requiresEmailVerification(undefined)).toBe(false);
  });
});

describe("verificationActionCodeSettings", () => {
  it("returns a /verify-email continue URL when the origin is a real http(s) URL", () => {
    expect(verificationActionCodeSettings("https://togather.app")).toEqual({ url: "https://togather.app/verify-email" });
    expect(verificationActionCodeSettings("http://localhost:5173")).toEqual({ url: "http://localhost:5173/verify-email" });
  });

  it("omits the setting at an opaque origin so the SDK can't throw invalid-continue-uri", () => {
    // jsdom's about:blank reports origin "null" — passing "null/verify-email"
    // as the continue URL is what threw auth/invalid-continue-uri in tests.
    expect(verificationActionCodeSettings("null")).toBeUndefined();
    expect(verificationActionCodeSettings(undefined)).toBeUndefined();
  });
});

// ── Route guards in App.jsx ───────────────────────────────────────────────────
// Mock useAuth so the guard components see the user we choose; AuthProvider
// becomes a passthrough. Every page is a named marker div.
const auth = vi.hoisted(() => ({ value: { user: null, loading: false } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.value,
  AuthProvider: ({ children }) => children,
}));

const { marker } = vi.hoisted(() => ({
  marker: (name) => () => <div data-testid={name}>{name}</div>,
}));
vi.mock("@/pages/Index.jsx",            () => ({ default: marker("page-index") }));
vi.mock("@/pages/Login.jsx",            () => ({ default: marker("page-login") }));
vi.mock("@/pages/ForgotPassword.jsx",   () => ({ default: marker("page-forgot") }));
vi.mock("@/pages/Signup.jsx",           () => ({ default: marker("page-signup") }));
vi.mock("@/pages/VerifyEmail.jsx",      () => ({ default: marker("page-verify-email") }));
vi.mock("@/pages/Dashboard.jsx",        () => ({ default: marker("page-dashboard") }));
vi.mock("@/pages/WeddingDetails.jsx",   () => ({ default: marker("page-details") }));
vi.mock("@/pages/WeddingAssistant.jsx", () => ({ default: marker("page-assistant") }));
vi.mock("@/pages/CreateInvitation.jsx", () => ({ default: marker("page-builder") }));
vi.mock("@/pages/InvitationPreview.jsx",() => ({ default: marker("page-preview") }));
vi.mock("@/pages/RSVP.jsx",             () => ({ default: marker("page-rsvp") }));
vi.mock("@/pages/GuestList.jsx",        () => ({ default: marker("page-guests") }));
vi.mock("@/pages/Registry.jsx",         () => ({ default: marker("page-registry") }));
vi.mock("@/pages/NotFound.jsx",         () => ({ default: marker("page-404") }));

// Compose the REAL guard components the same way App.jsx wires them, but in
// a MemoryRouter so entries are deterministic and no browser history is needed.
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicRoute, ProtectedRoute, VerifyEmailRoute } from "@/App.jsx";

const Page = ({ name }) => <div data-testid={name} />;
const P = (name) => <Page name={name} />;

const renderGuards = (path, user) => {
  auth.value = {
    user, loading: false,
    login: vi.fn(), signup: vi.fn(), logout: vi.fn(),
    resetPassword: vi.fn(), resendVerificationEmail: vi.fn(), reloadCurrentUser: vi.fn(),
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<PublicRoute>{P("page-login")}</PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmailRoute>{P("page-verify-email")}</VerifyEmailRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute>{P("page-dashboard")}</ProtectedRoute>} />
        <Route path="/wedding-details" element={<ProtectedRoute>{P("page-details")}</ProtectedRoute>} />
        <Route path="/guest-list" element={<ProtectedRoute>{P("page-guests")}</ProtectedRoute>} />
        <Route path="/create-invitation" element={<ProtectedRoute>{P("page-builder")}</ProtectedRoute>} />
        <Route path="/wedding-assistant" element={<ProtectedRoute>{P("page-assistant")}</ProtectedRoute>} />
        <Route path="/invitation/preview" element={<ProtectedRoute>{P("page-preview")}</ProtectedRoute>} />
        <Route path="/gift-registry" element={<ProtectedRoute>{P("page-registry")}</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("App route guards", () => {
  beforeEach(() => { auth.value = { user: null, loading: false }; });

  it("sends a pending (new, unverified) user to /verify-email when they hit /dashboard", async () => {
    renderGuards("/dashboard", pendingUser);
    expect(await screen.findByTestId("page-verify-email")).toBeInTheDocument();
  });

  it("sends a pending user to /verify-email from every protected route", async () => {
    for (const path of ["/wedding-details", "/guest-list", "/create-invitation", "/wedding-assistant", "/invitation/preview", "/gift-registry"]) {
      const { unmount } = renderGuards(path, pendingUser);
      expect(await screen.findByTestId("page-verify-email")).toBeInTheDocument();
      unmount();
    }
  });

  it("sends a pending signed-in user away from public pages to /verify-email", async () => {
    renderGuards("/login", pendingUser);
    expect(await screen.findByTestId("page-verify-email")).toBeInTheDocument();
  });

  it("lets a verified user reach /dashboard", async () => {
    renderGuards("/dashboard", verifiedUser);
    expect(await screen.findByTestId("page-dashboard")).toBeInTheDocument();
  });

  it("lets a legacy unverified user keep using /dashboard", async () => {
    renderGuards("/dashboard", legacyUser);
    expect(await screen.findByTestId("page-dashboard")).toBeInTheDocument();
  });

  it("sends a signed-out visitor of /verify-email back to /login", async () => {
    renderGuards("/verify-email", null);
    expect(await screen.findByTestId("page-login")).toBeInTheDocument();
  });

  it("sends a verified user visiting /verify-email onward to /dashboard", async () => {
    renderGuards("/verify-email", verifiedUser);
    expect(await screen.findByTestId("page-dashboard")).toBeInTheDocument();
  });

  it("shows the verification screen to a pending user on /verify-email", async () => {
    renderGuards("/verify-email", pendingUser);
    expect(await screen.findByTestId("page-verify-email")).toBeInTheDocument();
  });
});
