// Guest RSVP page: the invitation's Color Theme is applied to the invitation
// area (header, RSVP card, registry) only, older invitations get defaults, and
// the ToGather badge / error screens keep the app's look.
// Firestore is mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const db = vi.hoisted(() => ({ docs: {} }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, collection, id) => ({ path: `${collection}/${id}`, id }),
  getDoc: vi.fn(async (ref) => {
    const data = db.docs[ref.path];
    return { id: ref.id, exists: () => Boolean(data), data: () => data };
  }),
}));
vi.mock("@/lib/firestore", () => ({ submitRSVP: vi.fn(async () => ({ success: true })) }));

import RSVP from "@/pages/RSVP";
import { hexToHslTriplet, applyColorPreset } from "@/lib/invitationTheme";
import { googleFontId } from "@/hooks/useGoogleFonts";

const invitee = { token: "tok", weddingId: "w1", guestName: "Jane Smith", plusOneLimit: 1 };
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/rsvp/i1/tok"]}>
      <Routes><Route path="/rsvp/:inviteeId/:token" element={<RSVP />} /></Routes>
    </MemoryRouter>
  );

const rgb = (hex) => {
  const h = hex.replace("#", "");
  return `rgb(${[0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
};

describe("RSVP page — invitation theme", () => {
  beforeEach(() => {
    db.docs = {};
    document.head.querySelectorAll("link[id^='google-font-']").forEach(l => l.remove());
  });

  it("applies a saved theme's colors and fonts to the invitation area", async () => {
    db.docs["invitee/i1"] = invitee;
    db.docs["invitations/w1"] = {
      groomName: { first: "Sam" }, brideName: { first: "Alex" },
      ...applyColorPreset("Navy"), colorButton: "#7a1f3d",
      font1: "Libre Baskerville", font2: "Source Sans 3",
      sectionBackgrounds: { rsvp: "#ffffff", header: "#e8eef6" },
    };
    const { container } = renderPage();
    expect(await screen.findByText("Sam & Alex")).toBeTruthy();

    const area = screen.getByTestId("invitation-theme");
    expect(area).toHaveClass("tg-invite-theme");
    expect(area.style.getPropertyValue("--primary")).toBe(hexToHslTriplet("#7a1f3d"));
    expect(area.style.getPropertyValue("--background")).toBe(hexToHslTriplet("#f5f7fa"));
    expect(area.style.getPropertyValue("--card")).toBe(hexToHslTriplet("#ffffff"));
    expect(area.style.getPropertyValue("--muted-foreground")).toBe(hexToHslTriplet("#46483c"));
    expect(area.style.getPropertyValue("--tg-heading-font")).toBe('"Libre Baskerville", serif');
    expect(area.style.fontFamily).toMatch(/Source Sans 3/);

    // Page background = main background; header has its own panel color
    expect(container.firstChild.style.backgroundColor).toBe(rgb("#f5f7fa"));
    expect(screen.getByTestId("invitation-header").style.backgroundColor).toBe(rgb("#e8eef6"));

    // The RSVP card and its buttons are inside the themed area
    expect(area.contains(screen.getByText("Will you be joining us?"))).toBe(true);
    expect(area.contains(screen.getByRole("button", { name: /Continue/ }))).toBe(true);
    // The ToGather badge is not
    expect(area.contains(screen.getAllByText("ToGather")[0])).toBe(false);

    // Fonts are requested from Google Fonts
    expect(document.getElementById(googleFontId("Libre Baskerville"))).toBeTruthy();
    expect(document.getElementById(googleFontId("Source Sans 3"))).toBeTruthy();
  });

  it("gives an older invitation sensible defaults while keeping its saved colors and fonts", async () => {
    db.docs["invitee/i1"] = invitee;
    db.docs["invitations/w1"] = {
      groomName: { first: "Sam" }, brideName: { first: "Alex" },
      colorPalette1: "#9b3a5a", colorPalette2: "#c97a95", font1: "Great Vibes", font2: "Nunito",
    };
    renderPage();
    await screen.findByText("Sam & Alex");
    const area = screen.getByTestId("invitation-theme");
    expect(area.style.getPropertyValue("--primary")).toBe(hexToHslTriplet("#9b3a5a"));
    expect(area.style.getPropertyValue("--background")).toBe(hexToHslTriplet("#fdf5f7")); // Rose bg
    expect(area.style.getPropertyValue("--tg-heading-font")).toBe('"Great Vibes", cursive');
    // No custom header background → no extra panel
    expect(screen.getByTestId("invitation-header").getAttribute("style")).toBeNull();
  });

  it("uses Garden + Classic for an invitation with no theme fields at all", async () => {
    db.docs["invitee/i1"] = invitee;
    db.docs["invitations/w1"] = { groomName: { first: "Sam" }, brideName: { first: "Alex" } };
    renderPage();
    await screen.findByText("Sam & Alex");
    const area = screen.getByTestId("invitation-theme");
    expect(area.style.getPropertyValue("--primary")).toBe(hexToHslTriplet("#56642b"));
    expect(area.style.getPropertyValue("--tg-heading-font")).toBe('"Playfair Display", serif');
  });

  it("leaves the error screen unthemed", async () => {
    renderPage(); // no invitee doc
    expect(await screen.findByText("Invitation Not Found")).toBeTruthy();
    expect(screen.queryByTestId("invitation-theme")).toBeNull();
  });
});
