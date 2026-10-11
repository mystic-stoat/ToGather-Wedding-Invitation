// Shared invitation renderer (Phase 1 of the responsive invitation website).
// <InvitationContent> is the invitation markup that used to live inline in the
// builder's <PhonePreview>. These tests render it ON ITS OWN (no builder, no
// Firebase) to pin down the contract the owner preview and guest website will
// rely on later: section order, visibility rules, theme, and Q&A navigation.
// The builder-level tests (builderLayout, colorTheme, date, venue, qa,
// registry, wedding party…) keep covering it inside the phone preview.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

vi.mock("@/components/GoogleMapEmbed", () => ({
  default: ({ title }) => <div data-testid="map-embed" title={title} />,
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: q => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));

import InvitationContent from "@/components/invitation/InvitationContent";
import { resolveInvitationTheme } from "@/lib/invitationTheme";
import { getGuestQaItems, normalizeQaItems } from "@/lib/qa";
import { normalizeStoryEntry } from "@/lib/storyBlocks";
import { normalizePartyMembers } from "@/lib/weddingParty";

const INVITATION = {
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", venueName: "The Adolphus", venueAddress: "1321 Commerce St",
};

// Every optional section switched on
const FULL_SETTINGS = {
  greetingTitle: "Join us", greetingMessage: "Hello friends", closureTitle: "See you there",
  musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: true,
  dateShowCalendar: true,
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
  inviteDeadline: "2027-04-01",
};
// Same normalized shapes the builder passes in (useInvitationMedia)
const STORY = [normalizeStoryEntry({ id: "s1", layout: "textOnly", title: "How we met", description: "At UNT.", images: [] }, "s1")];
const PARTY = normalizePartyMembers([{ id: "m1", name: "Ana Ruiz", role: "maidOfHonor", side: "bride" }]);
const REGISTRIES = [{ id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true }];

const qaEntriesFor = (items, availableSections) =>
  getGuestQaItems(normalizeQaItems(items), { data: INVITATION, availableSections }, true);

// The component returns a fragment, so wrap it like the preview's scroll box.
const renderContent = (props = {}) => render(
  <div data-testid="screen">
    <InvitationContent invitation={INVITATION} settings={FULL_SETTINGS} {...props} />
  </div>,
);

const screenBox = () => screen.getByTestId("screen");
const sectionIds = () => [...screenBox().children]
  .filter(el => el.matches("[data-section], section.tg-story"))
  .map(el => (el.matches("section.tg-story") ? "story" : el.getAttribute("data-section")));
const section = id => screenBox().querySelector(`[data-section="${id}"]`);

describe("InvitationContent — structure", () => {
  it("renders every section in the builder's tab order when all are on", () => {
    renderContent({
      storyBlocks: STORY, partyMembers: PARTY,
      registries: REGISTRIES, registryMessage: "Thank you!",
      qaEntries: qaEntriesFor([{ id: "q1", question: "Dress code?", answerType: "text", text: "Formal", isVisible: true }], new Set()),
    });
    expect(sectionIds()).toEqual([
      "header", "greetings", "date", "music", "story", "party", "venue",
      "travel", "rsvp", "registry", "qa", "closure",
    ]);
  });

  it("returns sections as direct children (no wrapper element)", () => {
    renderContent();
    // header is the very first child, closing the very last
    expect(screenBox().firstElementChild).toHaveAttribute("data-section", "header");
    expect(screenBox().lastElementChild).toHaveAttribute("data-section", "closure");
  });

  it("shows the couple's names, title, greeting, date and closing", () => {
    renderContent();
    const header = section("header");
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent("Chris & Taylor");
    expect(header).toHaveTextContent("Join us");
    expect(header).toHaveTextContent("May 22, 2027 · The Adolphus");
    expect(section("greetings")).toHaveTextContent("Hello friends");
    expect(section("closure")).toHaveTextContent("See you there");
    expect(section("rsvp")).toHaveTextContent("Kindly reply by April 1");
  });
});

describe("InvitationContent — visibility rules", () => {
  it("omits optional sections the couple switched off or left empty", () => {
    renderContent({
      settings: {
        musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: false,
        venueShowOnInvitation: false,
        travelShowOnInvitation: false,
        travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
        storyShowOnInvitation: false,
        partyShowOnInvitation: false,
      },
      storyBlocks: STORY, partyMembers: PARTY,
      registries: REGISTRIES, registryMessage: "Thank you!", registryShown: false,
      qaEntries: [],
    });
    // Always-present sections remain; registry/qa wrappers stay but are empty
    expect(sectionIds()).toEqual(["header", "greetings", "rsvp", "registry", "qa", "closure"]);
    expect(section("registry")).toHaveTextContent("");
    expect(section("qa")).toHaveTextContent("");
    expect(screenBox()).not.toHaveTextContent("Hyatt");
    expect(screenBox()).not.toHaveTextContent("Ana Ruiz");
  });

  it("only shows registry links marked visible", () => {
    renderContent({
      registries: [...REGISTRIES, { id: "r2", name: "Secret list", url: "https://x.com", isVisible: false }],
      registryMessage: "Thank you!",
    });
    expect(section("registry")).toHaveTextContent("Zola");
    expect(section("registry")).not.toHaveTextContent("Secret list");
  });

  it("respects the Venue display switches", () => {
    renderContent({ settings: { ...FULL_SETTINGS, venueShowMap: false, venueShowAddress: false } });
    const venue = section("venue");
    expect(venue).toHaveTextContent("The Adolphus");
    expect(within(venue).queryByTestId("venue-map")).toBeNull();
    expect(within(venue).queryByTestId("venue-address")).toBeNull();
    expect(within(venue).getByRole("link", { name: "Get directions" }))
      .toHaveAttribute("href", expect.stringContaining("maps.example"));
  });
});

describe("InvitationContent — theme", () => {
  it("applies the couple's heading font and section background", () => {
    const settings = { ...FULL_SETTINGS, font1: "Lora" };
    renderContent({ settings });
    const theme = resolveInvitationTheme(settings);
    expect(within(section("header")).getByRole("heading", { level: 1 }).style.fontFamily)
      .toBe(theme.headingFont);
    // jsdom normalizes colors, so compare against an element styled the same way
    const probe = document.createElement("div");
    probe.style.backgroundColor = theme.sections.venue;
    expect(section("venue").style.backgroundColor).toBe(probe.style.backgroundColor);
  });
});

describe("InvitationContent — Q&A section links", () => {
  it("calls onNavigate with the linked section id", () => {
    const onNavigate = vi.fn();
    renderContent({
      onNavigate,
      qaEntries: qaEntriesFor(
        [{ id: "q1", question: "Where should I stay?", answerType: "section", section: "travel", isVisible: true }],
        new Set(["travel", "rsvp"]),
      ),
    });
    fireEvent.click(within(section("qa")).getByRole("button", { name: /Where should I stay/ }));
    fireEvent.click(within(section("qa")).getByRole("button", { name: /View Travel/ }));
    expect(onNavigate).toHaveBeenCalledWith("travel");
  });
});
