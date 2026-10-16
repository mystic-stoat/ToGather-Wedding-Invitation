// VerifyEmail page — resend cooldown, "I've verified" reload flow, logout,
// the signup-failed notice, and pending-user messaging. AuthContext is mocked;
// Firebase itself is never touched.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ value: {} }));
const firestore = vi.hoisted(() => ({ createUserProfile: vi.fn(async () => {}) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.value,
}));
vi.mock("@/lib/firestore", () => ({
  createUserProfile: firestore.createUserProfile,
}));
// Footer pulls in links/icons — keep it simple.
vi.mock("@/components/Footer", () => ({ default: () => <div /> }));

import VerifyEmail from "@/pages/VerifyEmail.jsx";

const pendingUser = { uid: "uid-123", email: "new.user@example.com", emailVerified: false };

const setAuth = (overrides = {}) => {
  auth.value = {
    user: pendingUser,
    loading: false,
    logout: vi.fn(async () => {}),
    resendVerificationEmail: vi.fn(async () => {}),
    reloadCurrentUser: vi.fn(async () => ({ ...pendingUser })),
    ...overrides,
  };
};

const renderPage = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/verify-email", state }]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("VerifyEmail page", () => {
  beforeEach(() => { setAuth(); firestore.createUserProfile.mockClear(); });
  afterEach(() => vi.useRealTimers());

  it("shows the heading, message and the user's email", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /verify your email address/i })).toBeInTheDocument();
    expect(screen.getByText(/new\.user@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i've verified my email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("warns when signup reports the verification email failed to send", () => {
    renderPage({ verificationSendFailed: true });
    expect(screen.getByText(/couldn't be sent/i)).toBeInTheDocument();
  });

  it("tells the user their account exists when the profile write was deferred", () => {
    renderPage({ profileSaveFailed: true, name: "Jane Smith", email: "jane@example.com" });
    expect(screen.getByText(/account was created/i)).toBeInTheDocument();
    expect(screen.getByText(/profile is still being saved/i)).toBeInTheDocument();
  });

  it("retries the deferred profile write when the user continues verified", async () => {
    auth.value.reloadCurrentUser = vi.fn(async () => ({ ...pendingUser, emailVerified: true }));
    renderPage({ profileSaveFailed: true, name: "Jane Smith", email: "jane@example.com" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /i've verified my email/i }));
    });
    expect(firestore.createUserProfile).toHaveBeenCalledWith("uid-123", "Jane Smith", "jane@example.com");
    expect(await screen.findByText("dashboard-page")).toBeInTheDocument();
  });

  it("still reaches /dashboard when the profile retry fails — never blocks entry", async () => {
    auth.value.reloadCurrentUser = vi.fn(async () => ({ ...pendingUser, emailVerified: true }));
    firestore.createUserProfile.mockRejectedValueOnce(new Error("firestore down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage({ profileSaveFailed: true, name: "Jane Smith", email: "jane@example.com" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /i've verified my email/i }));
    });
    expect(await screen.findByText("dashboard-page")).toBeInTheDocument();
  });

  it("'I've verified my email' reloads the user and continues to /dashboard when verified", async () => {
    auth.value.reloadCurrentUser = vi.fn(async () => ({ ...pendingUser, emailVerified: true }));
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /i've verified my email/i }));
    });
    expect(auth.value.reloadCurrentUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("dashboard-page")).toBeInTheDocument();
  });

  it("keeps the user on the page with a friendly message while still unverified", async () => {
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /i've verified my email/i }));
    });
    expect(screen.getByText(/isn't verified yet/i)).toBeInTheDocument();
    expect(screen.queryByText("dashboard-page")).not.toBeInTheDocument();
  });

  it("shows an error when the status check itself fails", async () => {
    auth.value.reloadCurrentUser = vi.fn(async () => { throw new Error("offline"); });
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /i've verified my email/i }));
    });
    expect(screen.getByText(/couldn't check your verification status/i)).toBeInTheDocument();
  });

  it("resends the email, confirms, and starts the cooldown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    });
    expect(auth.value.resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/verification email sent/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /resend verification email \(\d+s\)/i });
    expect(btn).toBeDisabled();
    // cooldown counts down and re-enables
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(screen.getByRole("button", { name: /^resend verification email$/i })).toBeEnabled();
  });

  it("handles Firebase rate limiting on resend with a clear message", async () => {
    auth.value.resendVerificationEmail = vi.fn(async () => {
      throw Object.assign(new Error("rate"), { code: "auth/too-many-requests" });
    });
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    });
    expect(screen.getByText(/too many emails requested/i)).toBeInTheDocument();
  });

  it("logs out and lands on /login so verification can finish from a fresh sign-in", async () => {
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    });
    expect(auth.value.logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("login-page")).toBeInTheDocument();
  });
});
