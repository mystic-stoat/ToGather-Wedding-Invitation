// Invitation Builder layout: the fixed tab order, the phone preview following
// the same order, and the readable sidebar styling.
// Firestore / auth / storage are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
  addRegistry: vi.fn(), updateRegistry: vi.fn(), deleteRegistry: vi.fn(),
}));
vi.mock("@/lib/firestore", () => fs);

const story = vi.hoisted(() => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/storyStore", () => story);
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
import { THEME_SECTIONS } from "@/lib/invitationTheme";

const TAB_ORDER = [
  "Greetings", "Color Theme", "Date", "Music", "Our Story",
  "Wedding Party", "Venue", "Travel & Stay", "RSVP", "Registry", "Q&A",
];

// An invitation with EVERY optional preview section switched on
const FULL_INVITATION = {
  weddingId: "w1",
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", venueName: "The Adolphus", venueAddress: "1321 Commerce St",
  musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: true,
  dateShowCalendar: true,
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
  partyMembers: [{ id: "m1", name: "Ana Ruiz", role: "maidOfHonor", side: "bride" }],
  registryMessage: "Thank you!",
  registries: [{ id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true }],
};

const renderBuilder = (path = "/create-invitation") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);
const nav = () => screen.getByRole("navigation", { name: "Invitation sections" });

beforeEach(() => {
  vi.clearAllMocks();
  fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
  story.loadAllStoryEntries.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("builder tabs", () => {
  it("uses the exact fixed tab order, with Q&A after Registry", async () => {
    renderBuilder();
    await screen.findByText("Invitation Title");
    const labels = within(nav()).getAllByRole("button").map(b => b.textContent.trim());
    expect(labels).toEqual(TAB_ORDER);
  });

  it("opens Greetings first and shows the renamed Our Story tab", async () => {
    renderBuilder();
    await screen.findByText("Invitation Title");
    expect(within(nav()).getByRole("button", { name: /Greetings/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("button", { name: /Our Story/ })).toBeTruthy();
    expect(within(nav()).queryByRole("button", { name: /^Story$/ })).toBeNull();
  });

  it("keeps ?section=story links working, now titled Our Story", async () => {
    renderBuilder("/create-invitation?section=story");
    expect(await screen.findByRole("heading", { level: 2, name: "Our Story" })).toBeTruthy();
    expect(within(nav()).getByRole("button", { name: /Our Story/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("phone preview order", () => {
  it("follows the tab order (Color Theme has no section), then the closing", async () => {
    fs.getInvitationByUser.mockResolvedValue(FULL_INVITATION);
    story.loadAllStoryEntries.mockResolvedValue([{
      docId: "s1",
      data: { id: "s1", layout: "textOnly", title: "How we met", description: "At UNT.", images: [], order: 0 },
    }]);
    renderBuilder();
    await screen.findByText("Invitation Title");
    const preview = screen.getByTestId("invitation-preview");
    await within(preview).findByText("How we met");

    const order = [...preview.querySelectorAll("[data-section], section.tg-story")]
      .map(el => (el.matches("section.tg-story") ? "story" : el.getAttribute("data-section")));
    expect(order).toEqual([
      "header", "greetings",   // Greetings tab (title + hero photo + message)
      "date", "music", "story", "party", "venue", "travel", "rsvp", "registry", "qa",
      "closure",
    ]);
  });

  it("keeps the Spotify player unchanged, right after the Date section", async () => {
    fs.getInvitationByUser.mockResolvedValue(FULL_INVITATION);
    renderBuilder();
    await screen.findByText("Invitation Title");
    const music = screen.getByTestId("invitation-preview").querySelector('[data-section="music"]');
    expect(music.previousElementSibling.getAttribute("data-section")).toBe("date");
    expect(within(music).getByTitle("Spotify song").getAttribute("src"))
      .toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
  });

  it("lists Color Theme section backgrounds in the same order", () => {
    expect(THEME_SECTIONS.map(s => s.id)).toEqual([
      "header", "greetings", "date", "music", "story", "party", "venue", "travel", "rsvp", "closure",
    ]);
  });
});

describe("sidebar readability", () => {
  it("uses solid charcoal labels, solid dark green icons and keeps the active highlight", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", groomName: { first: "Chris" }, brideName: { first: "Taylor" } });
    renderBuilder();
    await screen.findByText("Invitation Title");

    const inactive = within(nav()).getByRole("button", { name: /Venue/ });
    expect(inactive.style.color).toBe("rgb(44, 44, 44)");            // #2C2C2C
    expect(inactive.querySelector("svg").style.color).toBe("rgb(63, 95, 71)"); // #3F5F47
    expect(inactive.style.backgroundColor).toBe("");                  // no fill until hover
    expect(inactive.className).toMatch(/hover:bg-white/);

    const active = within(nav()).getByRole("button", { name: /Greetings/ });
    expect(active.style.color).toBe("rgb(63, 95, 71)");                // dark green text
    expect(active.style.backgroundColor).toBe("rgb(252, 235, 239)");  // #FCEBEF blush

    // No faded (alpha-suffixed) colors left on any tab
    for (const b of within(nav()).getAllByRole("button")) {
      expect(b.getAttribute("style")).not.toMatch(/rgba|#[0-9a-f]{8}/i);
    }

    // Subtitle (couple names) is solid dark green now
    const sidebar = nav().closest("aside");
    expect(within(sidebar).getByText("Chris & Taylor").style.color).toBe("rgb(63, 95, 71)");
  });
});
