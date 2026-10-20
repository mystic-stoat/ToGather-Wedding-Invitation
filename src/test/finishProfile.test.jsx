// FinishProfile page — the user-facing repair for a missing betrothed doc.
// AuthContext is mocked; the page's own contract is what matters here:
// re-check on mount, ask for the name rather than invent it, save through
// recoverProfile, and get out of the way when nothing needs repairing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.value,
}));
vi.mock("@/components/Footer", () => ({ default: () => <div /> }));

import FinishProfile from "@/pages/FinishProfile.jsx";

const verifiedUser = {
  uid: "u9",
  email: "jane@example.com",
  emailVerified: true,
  displayName: null,
  metadata: { creationTime: new Date().toUTCString() },
};

const setAuth = (overrides = {}) => {
  auth.value = {
    user: verifiedUser,
    loading: false,
    profileMissing: true,
    logout: vi.fn(async () => {}),
    recoverProfile: vi.fn(async () => ({ name: "Jane Smith" })),
    refreshUserProfile: vi.fn(async () => {}),
    ...overrides,
  };
};

const renderPage = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/finish-profile", state }]}>
      <Routes>
        <Route path="/finish-profile" element={<FinishProfile />} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
        <Route path="/guest-list" element={<div>guest-list-page</div>} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("FinishProfile page", () => {
  beforeEach(() => setAuth());

  it("re-checks Firestore once on mount, then shows the form", async () => {
    renderPage();
    expect(auth.value.refreshUserProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: /finish setting up your account/i })).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.com/)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save and continue/i })).toBeInTheDocument();
  });

  it("saves the entered name through recoverProfile and continues to /dashboard", async () => {
    renderPage();
    await screen.findByLabelText(/full name/i);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Smith" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    });
    expect(auth.value.recoverProfile).toHaveBeenCalledWith("Jane Smith");
    expect(await screen.findByText("dashboard-page")).toBeInTheDocument();
  });

  it("returns the user to the page they were blocked from", async () => {
    renderPage({ from: "/guest-list" });
    await screen.findByLabelText(/full name/i);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Smith" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    });
    expect(await screen.findByText("guest-list-page")).toBeInTheDocument();
  });

  it("prefills the Auth display name so the user confirms rather than retypes", async () => {
    setAuth({ user: { ...verifiedUser, displayName: "Jane Smith" } });
    renderPage();
    expect(await screen.findByLabelText(/full name/i)).toHaveValue("Jane Smith");
  });

  it("requires a name — never submits empty input to invent one", async () => {
    renderPage();
    await screen.findByLabelText(/full name/i);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    });
    expect(auth.value.recoverProfile).not.toHaveBeenCalled();
    expect(screen.queryByText("dashboard-page")).not.toBeInTheDocument();
  });

  it("shows a recoverable error when the save fails and stays on the page", async () => {
    auth.value.recoverProfile = vi.fn(async () => { throw new Error("firestore down"); });
    renderPage();
    await screen.findByLabelText(/full name/i);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Smith" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    });
    expect(await screen.findByText(/couldn't save your profile/i)).toBeInTheDocument();
    expect(screen.queryByText("dashboard-page")).not.toBeInTheDocument();
  });

  it("redirects straight through when the profile is already there", async () => {
    // Refresh found the doc (signup race resolved / another tab repaired it)
    // — nothing to ask the user for.
    setAuth({ profileMissing: false });
    renderPage();
    expect(await screen.findByText("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save and continue/i })).not.toBeInTheDocument();
  });

  it("offers logout so a stuck user can start over from sign-in", async () => {
    renderPage();
    await screen.findByRole("button", { name: /log out/i });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    });
    expect(auth.value.logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("login-page")).toBeInTheDocument();
  });
});
