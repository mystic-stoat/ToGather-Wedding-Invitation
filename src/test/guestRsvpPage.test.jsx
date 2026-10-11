// Guest invitation website — /rsvp/:inviteeId/:token (Phase 4).
//   - the complete saved invitation (shared <InvitationContent mode="page">)
//     with the RSVP form inside its RSVP section
//   - hero RSVP button scrolls to the RSVP section
//   - meals, dietary restrictions, plus-one limits and validation unchanged
//   - already answered → invitation still visible, no second response
//   - invalid links show no wedding information
//   - nothing private is rendered
// Firestore is mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const db = vi.hoisted(() => ({ docs: {}, reads: [] }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, collection, id) => ({ path: `${collection}/${id}`, id }),
  getDoc: vi.fn(async (ref) => {
    db.reads.push(ref.path);
    const data = db.docs[ref.path];
    return { id: ref.id, exists: () => Boolean(data), data: () => data };
  }),
}));
const fsHelpers = vi.hoisted(() => ({ submitRSVP: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/firestore", () => fsHelpers);
const story = vi.hoisted(() => ({ loadAllStoryEntries: vi.fn(async () => []) }));
vi.mock("@/lib/storyStore", () => story);
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: ({ title }) => <div data-testid="map-embed" title={title} />,
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: q => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));

import RSVP from "@/pages/RSVP";

const TOKEN = "secret-token-123";
const INVITEE = {
  token: TOKEN, tokenUsed: false, weddingId: "w1", guestName: "Jane Smith", email: "jane@example.com",
  plusOneLimit: 1, group: "Coworkers", emailStatus: "received", emailId: "smtp-77", rsvpStatus: "Pending",
};
const INVITATION = {
  userId: "owner-uid-999", isPublished: true,
  groomName: { first: "Sam", last: "Rivera" }, brideName: { first: "Alex", last: "Chen" },
  weddingDate: "2027-05-22", ceremonyTime: "16:30", inviteDeadline: "2027-04-01",
  venueName: "Rose Hall", venueAddress: "1 Garden Way, Dallas, TX",
  greetingMessage: "We'd love to celebrate with you.",
  heroImage: {
    path: "weddings/w1/hero/a.webp", url: "https://cdn.example/hero.webp",
    width: 1200, height: 1600, bytes: 1000, contentType: "image/webp", adjust: { x: 30, y: 70, zoom: 1.4 },
  },
  musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: true,
  dateShowCalendar: true,
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt Regency", mapUrl: "", description: "" }],
  partyMembers: [{ id: "p1", name: "Ana Ruiz", role: "maidOfHonor", side: "bride" }],
  mealOptions: [
    { id: "meal-chicken", name: "Chicken", description: "" },
    { id: "meal-veg", name: "Vegetarian", description: "" },
  ],
  registryMessage: "Thank you!",
  registries: [
    { id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true },
    { id: "r2", name: "Secret list", url: "https://secret.example", isVisible: false },
  ],
  qaShowOnInvitation: true,
  qaItems: [
    { id: "q1", question: "How do I RSVP?", answerType: "section", section: "rsvp", isVisible: true },
    { id: "q2", question: "Hidden question?", answerType: "text", text: "hidden answer", isVisible: false },
  ],
};
const STORY = [{ docId: "s1", data: { id: "s1", layout: "textOnly", title: "How we met", description: "At UNT.", images: [], order: 0 } }];

const renderGuestPage = (path = `/rsvp/i1/${TOKEN}`) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/rsvp/:inviteeId/:token" element={<RSVP />} /></Routes>
  </MemoryRouter>,
);
const page = () => screen.getByTestId("invitation-page");
const section = id => page().querySelector(`[data-section="${id}"]`);
const rsvp = () => section("rsvp");

beforeEach(() => {
  vi.clearAllMocks();
  db.docs = { "invitee/i1": { ...INVITEE }, "invitations/w1": { ...INVITATION } };
  db.reads = [];
  story.loadAllStoryEntries.mockResolvedValue(STORY);
  fsHelpers.submitRSVP.mockResolvedValue({ success: true });
});
afterEach(() => vi.restoreAllMocks());

describe("guest invitation — the complete saved invitation", () => {
  it("shows every visible section in order, with the RSVP form in the RSVP section", async () => {
    renderGuestPage();
    expect(await screen.findByText("Sam & Alex")).toBeTruthy();
    const ids = [...page().children]
      .filter(el => el.matches("[data-section], section.tg-story"))
      .map(el => (el.matches("section.tg-story") ? "story" : el.getAttribute("data-section")));
    expect(ids).toEqual(["header", "greetings", "date", "music", "story", "party", "venue",
      "travel", "rsvp", "registry", "qa", "closure"]);
    expect(within(rsvp()).getByText("Will you be joining us?")).toBeTruthy();
    expect(rsvp()).toHaveTextContent("Kindly reply by April 1, 2027");
    expect(within(screen.getByTestId("invitation-hero-frame")).getByRole("img"))
      .toHaveAttribute("src", "https://cdn.example/hero.webp");
    expect(section("registry")).toHaveTextContent("Zola");
    expect(within(section("music")).getByTitle("Spotify song")).toBeTruthy();
  });

  it("the hero RSVP button scrolls to the RSVP section", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderGuestPage();
      await screen.findByText("Sam & Alex");
      fireEvent.click(within(screen.getByTestId("invitation-hero-frame")).getByRole("button", { name: "RSVP" }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(rsvp());
    } finally {
      delete window.HTMLElement.prototype.scrollIntoView;
    }
  });

  it("uses the couple's theme for the RSVP card", async () => {
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    const themed = screen.getByTestId("invitation-theme");
    expect(themed).toHaveClass("tg-invite-theme");
    expect(rsvp().contains(themed)).toBe(true);
    expect(themed.contains(screen.getByText("Will you be joining us?"))).toBe(true);
  });

  it("still shows the invitation when Our Story can't be read by guests", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    story.loadAllStoryEntries.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    expect(page().querySelector("section.tg-story")).toBeNull();
    expect(within(rsvp()).getByText("Will you be joining us?")).toBeTruthy();
  });
});

describe("guest RSVP — existing form, fields and validation", () => {
  const goToInfoStep = async () => {
    await screen.findByText("Sam & Alex");
    fireEvent.click(within(rsvp()).getByText("Joyfully accepts"));
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Continue/ }));
  };

  it("pre-fills the guest's own name and email", async () => {
    renderGuestPage();
    await goToInfoStep();
    expect(within(rsvp()).getByPlaceholderText("Jane")).toHaveValue("Jane");
    expect(within(rsvp()).getByPlaceholderText("Smith")).toHaveValue("Smith");
    expect(within(rsvp()).getByPlaceholderText("you@example.com")).toHaveValue("jane@example.com");
  });

  it("still requires a meal when the couple offers meals", async () => {
    renderGuestPage();
    await goToInfoStep();
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Continue/ }));
    expect(await within(rsvp()).findByText("Please select your meal.")).toBeTruthy();
    expect(fsHelpers.submitRSVP).not.toHaveBeenCalled();
  });

  it("offers no more plus-ones than the guest's limit, and submits meals, dietary needs and plus-ones as before", async () => {
    renderGuestPage();
    await goToInfoStep();
    fireEvent.click(within(rsvp()).getByRole("radio", { name: /Chicken/ }));
    fireEvent.change(within(rsvp()).getByPlaceholderText("e.g. Gluten-free, peanut allergy"), { target: { value: "No nuts" } });
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Continue/ }));

    // plusOneLimit 1 → only "None" and "+1"
    expect(await within(rsvp()).findByText("You may bring up to 1 additional guest.")).toBeTruthy();
    expect(within(rsvp()).queryByRole("button", { name: "+2" })).toBeNull();
    fireEvent.click(within(rsvp()).getByRole("button", { name: "+1" }));
    fireEvent.change(within(rsvp()).getByPlaceholderText("Guest name"), { target: { value: "Pat Smith" } });
    fireEvent.click(within(rsvp()).getAllByRole("radio", { name: /Vegetarian/ }).at(-1));
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Send my RSVP/ }));

    expect(await within(rsvp()).findByText("See you there!")).toBeTruthy();
    expect(fsHelpers.submitRSVP).toHaveBeenCalledTimes(1);
    expect(fsHelpers.submitRSVP).toHaveBeenCalledWith(TOKEN, {
      guestName: "Jane Smith", email: "jane@example.com",
      attending: true, dietaryRestrictions: "No nuts",
      mealId: "meal-chicken", meal: "Chicken",
      guestCount: 2,
      plusOnes: [{ name: "Pat Smith", mealId: "meal-veg", meal: "Vegetarian", dietaryRestrictions: "" }],
    });
  });

  it("declining sends no meal or plus-one details", async () => {
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    fireEvent.click(within(rsvp()).getByText("Regretfully declines"));
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Continue/ }));
    fireEvent.click(await within(rsvp()).findByRole("button", { name: /Continue/ }));
    fireEvent.click(await within(rsvp()).findByRole("button", { name: /Send response/ }));
    await within(rsvp()).findByText("We'll miss you!");
    expect(fsHelpers.submitRSVP.mock.calls[0][1]).toMatchObject({
      attending: false, mealId: "", meal: "", guestCount: 0, plusOnes: [], dietaryRestrictions: "",
    });
  });

  it("shows the server's message when the response is refused (e.g. already used)", async () => {
    fsHelpers.submitRSVP.mockResolvedValue({ success: false, error: "This RSVP has already been submitted." });
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    fireEvent.click(within(rsvp()).getByText("Regretfully declines"));
    fireEvent.click(within(rsvp()).getByRole("button", { name: /Continue/ }));
    fireEvent.click(await within(rsvp()).findByRole("button", { name: /Continue/ }));
    fireEvent.click(await within(rsvp()).findByRole("button", { name: /Send response/ }));
    expect(await within(rsvp()).findByText("This RSVP has already been submitted.")).toBeTruthy();
    expect(within(rsvp()).queryByText("We'll miss you!")).toBeNull();
  });

  it("KNOWN GAP (unchanged): the RSVP deadline is shown but not enforced", async () => {
    db.docs["invitations/w1"] = { ...INVITATION, inviteDeadline: "2020-01-01" };
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    expect(rsvp()).toHaveTextContent("Kindly reply by January 1, 2020");
    // The form is still offered after the deadline — documented for the team,
    // deliberately not changed in Phase 4 (see docs/INVITATION_WEBSITE.md).
    expect(within(rsvp()).getByText("Will you be joining us?")).toBeTruthy();
  });
});

describe("guests who already replied", () => {
  it("still see the invitation, with their reply and no way to answer again", async () => {
    db.docs["invitee/i1"] = {
      ...INVITEE, tokenUsed: true, rsvpStatus: "Accepted",
      respondedAt: { toDate: () => new Date("2026-10-01T15:00:00") },
    };
    renderGuestPage();
    expect(await screen.findByText("Sam & Alex")).toBeTruthy();
    expect(section("venue")).toHaveTextContent("Rose Hall");
    const replied = within(rsvp()).getByTestId("rsvp-already-responded");
    expect(replied).toHaveTextContent("you've already replied");
    expect(replied).toHaveTextContent("You let Sam & Alex know you'll be there on October 1, 2026.");
    expect(within(rsvp()).queryByText("Will you be joining us?")).toBeNull();
    expect(within(rsvp()).queryByRole("button")).toBeNull();
    expect(fsHelpers.submitRSVP).not.toHaveBeenCalled();
  });

  it("a decline is described as a decline", async () => {
    db.docs["invitee/i1"] = { ...INVITEE, tokenUsed: true, rsvpStatus: "Declined" };
    renderGuestPage();
    await screen.findByText("Sam & Alex");
    expect(within(rsvp()).getByTestId("rsvp-already-responded")).toHaveTextContent("know you can't make it");
  });
});

describe("invalid links show no wedding information", () => {
  it.each([
    ["a wrong token", "/rsvp/i1/wrong-token"],
    ["an unknown guest", `/rsvp/nobody/${TOKEN}`],
  ])("%s → Invitation Not Found, and the invitation is never read", async (_label, path) => {
    renderGuestPage(path);
    expect(await screen.findByText("Invitation Not Found")).toBeTruthy();
    expect(screen.getByText("This invitation link is invalid or has expired.")).toBeTruthy();
    expect(screen.queryByTestId("invitation-page")).toBeNull();
    expect(screen.queryByText(/Sam|Alex|Rose Hall/)).toBeNull();
    expect(db.reads).not.toContain("invitations/w1");
  });

  it("a guest whose wedding no longer exists sees the same screen", async () => {
    delete db.docs["invitations/w1"];
    renderGuestPage();
    expect(await screen.findByText("Invitation Not Found")).toBeTruthy();
    expect(screen.queryByTestId("invitation-page")).toBeNull();
  });

  it("a loading error shows a retry message, not wedding details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getDoc } = await import("firebase/firestore");
    getDoc.mockRejectedValueOnce(new Error("offline"));
    renderGuestPage();
    expect(await screen.findByText(/Something went wrong loading your invitation/)).toBeTruthy();
    expect(screen.queryByTestId("invitation-page")).toBeNull();
  });
});

describe("privacy of the personal link", () => {
  it("never renders the token, host-only guest fields, the owner id or hidden items", async () => {
    const { container } = renderGuestPage();
    await screen.findByText("Sam & Alex");
    const html = container.innerHTML;
    for (const secret of [TOKEN, "owner-uid-999", "smtp-77", "Coworkers", "Secret list",
      "Hidden question?", "hidden answer", "Rivera", "Chen"]) {
      expect(html).not.toContain(secret);
    }
  });

  it("asks search engines not to index the page and sends no Referer to other sites", async () => {
    const { unmount } = renderGuestPage();
    await screen.findByText("Sam & Alex");
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(document.head.querySelector('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    unmount();
    expect(document.head.querySelector("meta[data-guest-invitation]")).toBeNull();
  });
});
