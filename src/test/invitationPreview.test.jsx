// Owner preview page — /invitation/preview (Phase 2).
//   - protected: logged-out visitors are sent to /login
//   - loads the couple's LATEST SAVED invitation (doc + Our Story) and renders
//     it with the shared <InvitationContent mode="page">
//   - clear Preview indicator, RSVP turned off, Refresh + back to builder
//   - loading / no invitation / error / Our Story failed states
//   - Q&A section links scroll the page to that section
// Firestore / auth are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const fs = vi.hoisted(() => ({ getInvitationByUser: vi.fn() }));
vi.mock("@/lib/firestore", () => fs);
const story = vi.hoisted(() => ({ loadAllStoryEntries: vi.fn() }));
vi.mock("@/lib/storyStore", () => story);
const auth = vi.hoisted(() => ({ user: { uid: "u1" }, loading: false }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }) => children,
}));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => <div data-testid="map-embed" />,
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: q => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));

import InvitationPreview from "@/pages/InvitationPreview";

const SAVED = {
  weddingId: "w1", userId: "u1",
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", venueName: "The Adolphus", venueAddress: "1321 Commerce St",
  greetingMessage: "Hello friends",
  heroImage: {
    path: "weddings/w1/hero/a.webp", url: "https://cdn.example/hero.webp",
    width: 1200, height: 1600, bytes: 1000, contentType: "image/webp", adjust: { x: 30, y: 70, zoom: 1.6 },
  },
  colorPalette1: "#7a5c3e",
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
  partyMembers: [{ id: "m1", name: "Ana Ruiz", role: "maidOfHonor", side: "bride" }],
  registryMessage: "Thank you!",
  registries: [{ id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true }],
  qaShowOnInvitation: true,
  qaItems: [
    { id: "q1", question: "Where should I stay?", answerType: "section", section: "travel", isVisible: true },
    { id: "q2", question: "Is there a story?", answerType: "section", section: "story", isVisible: true },
  ],
};
const STORY_ENTRIES = [{ docId: "s1", data: { id: "s1", layout: "textOnly", title: "How we met", description: "At UNT.", images: [], order: 0 } }];

const renderPage = () => render(
  <MemoryRouter initialEntries={["/invitation/preview"]}>
    <Routes>
      <Route path="/invitation/preview" element={<InvitationPreview />} />
      <Route path="/create-invitation" element={<p>BUILDER PAGE</p>} />
      <Route path="/wedding-details" element={<p>WEDDING DETAILS PAGE</p>} />
    </Routes>
  </MemoryRouter>,
);
const page = () => screen.getByTestId("invitation-page");
const section = id => page().querySelector(`[data-section="${id}"]`);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { uid: "u1" };
  fs.getInvitationByUser.mockResolvedValue(SAVED);
  story.loadAllStoryEntries.mockResolvedValue(STORY_ENTRIES);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("owner preview — loading the saved invitation", () => {
  it("shows a loading state, then the couple's saved invitation", async () => {
    renderPage();
    expect(screen.getByText(/Loading your invitation preview/)).toBeTruthy();
    expect(await screen.findByTestId("invitation-page")).toBeTruthy();
    expect(fs.getInvitationByUser).toHaveBeenCalledWith("u1");
    expect(story.loadAllStoryEntries).toHaveBeenCalledWith("w1");
    expect(within(section("header")).getByRole("heading", { level: 1 })).toHaveTextContent("Chris & Taylor");
    expect(section("greetings")).toHaveTextContent("Hello friends");
    expect(page().querySelector("section.tg-story")).toHaveTextContent("How we met");
    expect(section("party")).toHaveTextContent("Ana Ruiz");
    expect(section("travel")).toHaveTextContent("Hyatt");
    expect(section("registry")).toHaveTextContent("Zola");
    expect(within(screen.getByTestId("invitation-hero-frame")).getByRole("img"))
      .toHaveAttribute("src", "https://cdn.example/hero.webp");
  });

  it("renders in page mode — no builder placeholders", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", userId: "u1", groomName: { first: "Chris" }, brideName: { first: "Taylor" } });
    story.loadAllStoryEntries.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId("invitation-page");
    const text = page().textContent;
    expect(text).not.toContain("Hero Photo");
    expect(text).not.toContain("Venue Name");
    expect(text).not.toContain("The stars aligned");
    expect(text).toContain("Together with their families");
    expect(text).toContain("We can't wait to celebrate with you");
  });

  it("asks the couple to set up their invitation when none is saved yet", async () => {
    fs.getInvitationByUser.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "No invitation yet" })).toBeTruthy();
    expect(story.loadAllStoryEntries).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Go to Wedding Details" }));
    expect(screen.getByText("WEDDING DETAILS PAGE")).toBeTruthy();
  });

  it("shows an error with Try again when the invitation can't be loaded", async () => {
    fs.getInvitationByUser.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByRole("heading", { name: /couldn't load your invitation/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("invitation-page")).toBeTruthy();
    expect(fs.getInvitationByUser).toHaveBeenCalledTimes(2);
  });

  it("still shows the rest of the invitation when Our Story fails to load", async () => {
    story.loadAllStoryEntries.mockRejectedValue(new Error("denied"));
    renderPage();
    await screen.findByTestId("invitation-page");
    expect(screen.getByRole("alert")).toHaveTextContent("Our Story couldn't be loaded");
    expect(page().querySelector("section.tg-story")).toBeNull();
    expect(section("party")).toHaveTextContent("Ana Ruiz");
  });
});

describe("owner preview — preview indicator and controls", () => {
  it("shows a clear Preview bar that is not part of the invitation", async () => {
    renderPage();
    await screen.findByTestId("invitation-page");
    const bar = screen.getByRole("region", { name: "Invitation preview" });
    expect(within(bar).getByText("Preview")).toBeTruthy();
    expect(bar).toHaveTextContent("last saved invitation");
    expect(page().contains(bar)).toBe(false);
    expect(document.title).toBe("Invitation Preview · ToGather");
  });

  it("turns RSVP off in the preview", async () => {
    renderPage();
    await screen.findByTestId("invitation-page");
    const rsvp = section("rsvp");
    expect(within(rsvp).getByRole("button", { name: "RSVP Now" })).toBeDisabled();
    expect(rsvp).toHaveTextContent("RSVP is turned off in this preview");
  });

  it("Refresh reloads the latest saved version without blanking the page", async () => {
    renderPage();
    await screen.findByTestId("invitation-page");
    fs.getInvitationByUser.mockResolvedValue({ ...SAVED, greetingMessage: "Updated hello" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
    expect(screen.getByTestId("invitation-page")).toBeTruthy(); // stays on screen
    await waitFor(() => expect(section("greetings")).toHaveTextContent("Updated hello"));
  });

  it("links back to the builder", async () => {
    renderPage();
    await screen.findByTestId("invitation-page");
    fireEvent.click(screen.getByRole("link", { name: /Builder/ }));
    expect(screen.getByText("BUILDER PAGE")).toBeTruthy();
  });
});

describe("owner preview — Q&A section links", () => {
  it("scroll the page to the linked section", async () => {
    const scrollIntoView = vi.fn();
    const original = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderPage();
      await screen.findByTestId("invitation-page");
      const qa = section("qa");
      fireEvent.click(within(qa).getByRole("button", { name: /Where should I stay/ }));
      fireEvent.click(within(qa).getByRole("button", { name: /View Travel/ }));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(scrollIntoView.mock.contexts[0]).toBe(section("travel"));

      // Our Story is found by its <section class="tg-story">, as in the builder
      fireEvent.click(within(qa).getByRole("button", { name: /Is there a story/ }));
      fireEvent.click(within(qa).getByRole("button", { name: /View Our Story/ }));
      expect(scrollIntoView.mock.contexts[1]).toBe(page().querySelector("section.tg-story"));
    } finally {
      window.HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it("only offers links to sections that are really on the page", async () => {
    story.loadAllStoryEntries.mockResolvedValue([]); // no story saved → no story link
    renderPage();
    await screen.findByTestId("invitation-page");
    const qa = section("qa");
    expect(within(qa).getByRole("button", { name: /Where should I stay/ })).toBeTruthy();
    expect(within(qa).queryByRole("button", { name: /Is there a story/ })).toBeNull();
  });
});
