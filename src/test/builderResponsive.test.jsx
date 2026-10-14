// src/test/builderResponsive.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Responsive Invitation Builder (Phase 4). Below 1280px an Edit / Preview
// invitation toggle chooses between the settings and the phone preview; both
// stay mounted so unsaved edits are never lost. Below 1024px the section
// sidebar becomes a horizontal tab strip — still the single
// <nav aria-label="Invitation sections">. jsdom applies no CSS, so these tests
// check state, ARIA and the responsive classes; layout itself was verified in
// a real browser.
// Firestore / auth / storage are mocked — no emulator needed.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
  addRegistry: vi.fn(), updateRegistry: vi.fn(), deleteRegistry: vi.fn(),
}));
vi.mock("@/lib/firestore", () => fs);
vi.mock("@/lib/storyStore", () => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/weddingPartyStore", () => ({
  loadPartyContacts: vi.fn(async () => ({})), savePartyContacts: vi.fn(async () => {}),
}));
vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn(), buildStoryPath: vi.fn(), buildPartyPath: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
}));

import CreateInvitation from "@/pages/CreateInvitation";

const renderBuilder = async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/create-invitation"]}><CreateInvitation /></MemoryRouter>);
  await screen.findByText("Invitation Title");
  return user;
};

const viewGroup = () => screen.getByRole("group", { name: "Builder view" });
const editBtn = () => within(viewGroup()).getByRole("button", { name: "Edit" });
const previewBtn = () => within(viewGroup()).getByRole("button", { name: "Preview invitation" });
const settings = () => screen.getByRole("main");
const previewPane = () => screen.getByTestId("invitation-preview").closest("aside");
const sectionNav = () => screen.getByRole("navigation", { name: "Invitation sections" });

beforeEach(() => {
  fs.getInvitationByUser.mockResolvedValue({
    weddingId: "w1", groomName: { first: "Chris" }, brideName: { first: "Taylor" }, weddingDate: "2027-05-22",
  });
});

describe("Invitation Builder — Edit / Preview invitation toggle (below 1280px)", () => {
  it("starts in Edit with the preview mounted but hidden on small screens", async () => {
    await renderBuilder();
    expect(editBtn()).toHaveAttribute("aria-pressed", "true");
    expect(previewBtn()).toHaveAttribute("aria-pressed", "false");
    expect(settings().className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(previewPane()).toHaveClass("hidden", "xl:flex");
    // The toggle itself is not shown at desktop widths
    expect(viewGroup().parentElement).toHaveClass("xl:hidden");
  });

  it("switches to the preview and back without unmounting either view", async () => {
    const user = await renderBuilder();
    const preview = screen.getByTestId("invitation-preview");

    await user.click(previewBtn());
    expect(previewBtn()).toHaveAttribute("aria-pressed", "true");
    expect(previewPane()).toHaveClass("flex");
    expect(previewPane()).not.toHaveClass("hidden");
    expect(settings()).toHaveClass("hidden", "xl:block");
    expect(sectionNav().closest("aside")).toHaveClass("hidden", "lg:flex");
    expect(screen.getByTestId("invitation-preview")).toBe(preview); // same element, never remounted

    await user.click(editBtn());
    expect(editBtn()).toHaveAttribute("aria-pressed", "true");
    expect(settings().className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("keeps unsaved edits when switching views, and the preview shows them", async () => {
    const user = await renderBuilder();
    const title = screen.getByPlaceholderText("Together with their families...");
    await user.type(title, "Join Us Phase Four");

    await user.click(previewBtn());
    expect(within(screen.getByTestId("invitation-preview")).getByText(/Join Us Phase Four/i)).toBeInTheDocument();

    await user.click(editBtn());
    expect(screen.getByPlaceholderText("Together with their families...")).toHaveValue("Join Us Phase Four");
  });

  it("returns to Edit when a section is chosen", async () => {
    const user = await renderBuilder();
    await user.click(previewBtn());
    await user.click(within(sectionNav()).getByRole("button", { name: /Venue/ }));
    expect(editBtn()).toHaveAttribute("aria-pressed", "true");
    expect(within(settings()).getByRole("heading", { level: 2, name: "Venue" })).toBeInTheDocument();
  });
});

describe("Invitation Builder — section tabs and header at every width", () => {
  it("uses one section nav: a tab strip below lg, the sidebar from lg", async () => {
    await renderBuilder();
    expect(screen.getAllByRole("navigation", { name: "Invitation sections" })).toHaveLength(1);
    expect(sectionNav()).toHaveClass("flex", "overflow-x-auto", "lg:flex-col");
    const tabs = within(sectionNav()).getAllByRole("button");
    expect(tabs).toHaveLength(11);
    // Every tab is at least 44px tall on phones
    for (const t of tabs) expect(t).toHaveClass("min-h-11", "lg:min-h-0");
  });

  it("keeps Back to Dashboard, Save and View Invitation in the header", async () => {
    await renderBuilder();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(within(header).getByRole("button", { name: /^Save$/ })).toBeInTheDocument();
    // Visible text is just "View" on phones; the accessible name stays the full label
    expect(within(header).getByRole("button", { name: "View Invitation" })).toBeInTheDocument();
  });

  it("keeps the desktop three-column classes for 1280px and up", async () => {
    await renderBuilder();
    expect(sectionNav().closest("aside")).toHaveClass("lg:w-64", "lg:border-r");
    expect(previewPane()).toHaveClass("xl:w-[400px]", "xl:border-l");
  });
});
