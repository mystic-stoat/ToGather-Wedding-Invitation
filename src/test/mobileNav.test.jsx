// src/test/mobileNav.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Mobile / tablet navigation (src/components/MobileNav.jsx): the hamburger
// button opens the SAME Sidebar in a slide-out drawer with every link, the
// couple-info card and Log out; the drawer closes via its close button, the
// Escape key, choosing a link, or Log out.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";

const invitation = {
  groomName: { first: "Chris" },
  brideName: { first: "Jean" },
  weddingDate: "2027-06-17",
};

const NAV_LABELS = [
  "Dashboard", "Wedding Details", "Guest List", "Wedding Assistant",
  "Save the Date", "Mobile Invitation",
];

const Where = () => <p data-testid="location">{useLocation().pathname}</p>;

const renderNav = ({ path = "/dashboard", onLogout = vi.fn() } = {}) => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileNav invitation={invitation} onLogout={onLogout} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>
  );
  const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
  return { user, onLogout, menuButton };
};

const openDrawer = async (user, menuButton) => {
  await user.click(menuButton);
  return screen.findByRole("dialog", { name: "Navigation menu" });
};

describe("MobileNav — slide-out navigation drawer", () => {
  it("is closed initially and the menu button reports its state", () => {
    const { menuButton } = renderNav();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the full sidebar: every link, the couple card and Log out", async () => {
    const { user, menuButton } = renderNav();
    const drawer = await openDrawer(user, menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const nav = within(drawer).getByRole("navigation", { name: "Main navigation" });
    for (const label of NAV_LABELS) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(within(drawer).getByText("Chris & Jean")).toBeInTheDocument();
    expect(within(drawer).getByText("June 17, 2027")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("marks the current page for screen readers", async () => {
    const { user, menuButton } = renderNav({ path: "/guest-list" });
    const drawer = await openDrawer(user, menuButton);
    expect(within(drawer).getByRole("link", { name: "Guest List" })).toHaveAttribute("aria-current", "page");
    expect(within(drawer).getByRole("link", { name: "Wedding Details" })).not.toHaveAttribute("aria-current");
  });

  it("closes with the close button and returns focus to the menu button", async () => {
    const { user, menuButton } = renderNav();
    const drawer = await openDrawer(user, menuButton);
    await user.click(within(drawer).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(menuButton).toHaveFocus();
  });

  it("closes with the Escape key", async () => {
    const { user, menuButton } = renderNav();
    await openDrawer(user, menuButton);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("navigates and closes when a link is chosen", async () => {
    const { user, menuButton } = renderNav();
    const drawer = await openDrawer(user, menuButton);
    await user.click(within(drawer).getByRole("link", { name: "Wedding Details" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/wedding-details");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("logs out from inside the drawer and closes it", async () => {
    const { user, menuButton, onLogout } = renderNav();
    const drawer = await openDrawer(user, menuButton);
    await user.click(within(drawer).getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps Log out available in the top bar", async () => {
    const { user, onLogout } = renderNav();
    await user.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe("Sidebar — desktop variant is unchanged", () => {
  it("still renders as the hidden-below-lg desktop column by default", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar invitation={invitation} onLogout={() => {}} />
      </MemoryRouter>
    );
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("hidden", "lg:flex", "w-52");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
});
