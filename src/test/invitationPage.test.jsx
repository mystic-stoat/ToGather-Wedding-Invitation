// Standalone invitation page rendering — <InvitationContent mode="page">
// (Phase 2 of the responsive invitation website).
//   - no unfinished placeholders; default title + closing kept; greeting hidden
//     when never entered
//   - same sections/order/theme as the phone preview
//   - hero photo keeps the couple's position/zoom (same CSS as the editor) in a
//     frame with the editor's aspect ratio
//   - responsive hooks (container + section/column classes) and the CSS rules
//     behind them
//   - Q&A links and the hero RSVP button navigate within the page
// jsdom has no layout engine, so actual sizes at each breakpoint are checked
// by hand / in the browser (see the testing instructions); here we pin down
// the structure and the CSS contract that produce them.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/components/GoogleMapEmbed", () => ({
  default: ({ title, heightClass, interactive }) => (
    <div data-testid="map-embed" title={title} data-height={heightClass}
      data-interactive={String(interactive !== false)} />
  ),
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: q => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));

import InvitationContent, { InvitationPageSurface } from "@/components/invitation/InvitationContent";
import WeddingDaySection from "@/components/invitation/WeddingDaySection";
import { HERO_FRAME_ASPECT } from "@/components/invitation/HeroPhotoField";
import { resolveInvitationTheme } from "@/lib/invitationTheme";
import { photoImageStyle } from "@/lib/photoAdjust";
import { invitationToSettings, VIEW_MODES } from "@/lib/invitationView";
import { getGuestQaItems, normalizeQaItems } from "@/lib/qa";
import { normalizeStoryEntry } from "@/lib/storyBlocks";
import { normalizePartyMembers } from "@/lib/weddingParty";

const HERO = {
  path: "weddings/w1/hero/a.webp", url: "https://cdn.example/hero.webp",
  width: 1200, height: 1600, bytes: 1000, contentType: "image/webp",
  adjust: { x: 30, y: 70, zoom: 1.6 },
};

const INVITATION = {
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", ceremonyTime: "16:30",
  venueName: "The Adolphus", venueAddress: "1321 Commerce St",
};

// Everything switched on and filled in
const FULL_SETTINGS = invitationToSettings({
  greetingMessage: "Hello friends",
  musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: true,
  dateShowCalendar: true, dateShowCountdown: true,
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "https://maps.app.goo.gl/x", description: "Close by" }],
  inviteDeadline: "2027-04-01",
});
const STORY = [normalizeStoryEntry({ id: "s1", layout: "textOnly", title: "How we met", description: "At UNT.", images: [] }, "s1")];
const PARTY = normalizePartyMembers([{ id: "m1", name: "Ana Ruiz", role: "maidOfHonor", side: "bride" }]);
const REGISTRIES = [{ id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true }];

const renderPage = (props = {}) => render(
  <InvitationPageSurface settings={props.settings || FULL_SETTINGS}>
    <InvitationContent mode={VIEW_MODES.PAGE} invitation={INVITATION} settings={FULL_SETTINGS} {...props} />
  </InvitationPageSurface>,
);
const renderPreview = (props = {}) => render(
  <div data-testid="screen">
    <InvitationContent invitation={INVITATION} settings={FULL_SETTINGS} {...props} />
  </div>,
);

const pageRoot = () => screen.getByTestId("invitation-page");
const section = id => pageRoot().querySelector(`[data-section="${id}"]`);
const sectionIds = root => [...root.children]
  .filter(el => el.matches("[data-section], section.tg-story"))
  .map(el => (el.matches("section.tg-story") ? "story" : el.getAttribute("data-section")));

// A brand-new invitation: names only, every optional section switched on
// but nothing filled in yet.
const BARE_INVITATION = { groomName: { first: "Chris" }, brideName: { first: "Taylor" } };
const BARE_SETTINGS = invitationToSettings({ dateShowCalendar: true });
const EMPTY_STORY = [normalizeStoryEntry({ id: "s9", layout: "collage", title: "", description: "", images: [] }, "s9")];

describe("page mode — same invitation as the phone preview", () => {
  it("renders every section in the builder's tab order, inside the responsive surface", () => {
    renderPage({
      hero: HERO, storyBlocks: STORY, partyMembers: PARTY, registries: REGISTRIES, registryMessage: "Thanks!",
      qaEntries: getGuestQaItems(normalizeQaItems([{ id: "q1", question: "Dress?", answerType: "text", text: "Formal", isVisible: true }]),
        { data: INVITATION, availableSections: new Set() }, true),
    });
    expect(pageRoot()).toHaveClass("tg-invitation-page");
    expect(sectionIds(pageRoot())).toEqual([
      "header", "greetings", "date", "music", "story", "party", "venue",
      "travel", "rsvp", "registry", "qa", "closure",
    ]);
    // Hero photo sits between the header and greetings, like the preview
    expect(section("header").nextElementSibling).toHaveAttribute("data-testid", "invitation-hero");
  });

  it("uses the couple's colors and fonts", () => {
    const settings = { ...FULL_SETTINGS, font1: "Great Vibes" };
    renderPage({ settings });
    const theme = resolveInvitationTheme(settings);
    expect(within(section("header")).getByRole("heading", { level: 1 }).style.fontFamily).toBe(theme.headingFont);
    expect(pageRoot().style.fontFamily).toBe(theme.bodyFont);
    const probe = document.createElement("div");
    probe.style.backgroundColor = theme.background;
    expect(pageRoot().style.backgroundColor).toBe(probe.style.backgroundColor);
  });

  it("shows the real names, date, venue and greeting", () => {
    renderPage();
    expect(within(section("header")).getByRole("heading", { level: 1 })).toHaveTextContent("Chris & Taylor");
    expect(section("header")).toHaveTextContent("May 22, 2027 · The Adolphus");
    expect(section("greetings")).toHaveTextContent("Hello friends");
    expect(section("date")).toHaveTextContent("May 22, 2027 · 4:30 PM");
  });
});

describe("page mode — no unfinished placeholders", () => {
  it("a brand-new invitation shows only the header, RSVP and closing", () => {
    renderPage({ invitation: BARE_INVITATION, settings: BARE_SETTINGS, storyBlocks: EMPTY_STORY });
    expect(sectionIds(pageRoot())).toEqual(["header", "rsvp", "closure"]);
    const text = pageRoot().textContent;
    for (const placeholder of [
      "Groom", "Bride", "Wedding Date", "Venue Name", "Venue Address", "Hero Photo",
      "The stars aligned", "Add to calendar", "hasn't been set",
    ]) {
      expect(text).not.toContain(placeholder);
    }
    expect(screen.queryByTestId("invitation-hero")).toBeNull();
    expect(pageRoot().querySelector(".tg-story__placeholder")).toBeNull();
  });

  it("the same data still shows its placeholders in the builder preview", () => {
    renderPreview({ invitation: {}, settings: BARE_SETTINGS, storyBlocks: EMPTY_STORY });
    const text = screen.getByTestId("screen").textContent;
    expect(text).toContain("Groom & Bride");
    expect(text).toContain("Hero Photo");
    expect(text).toContain("The stars aligned");
    expect(text).toContain("Add to calendar");
  });

  it("keeps the default invitation title and closing line", () => {
    renderPage({ invitation: BARE_INVITATION, settings: BARE_SETTINGS });
    expect(section("header")).toHaveTextContent("Together with their families");
    expect(section("closure")).toHaveTextContent("We can't wait to celebrate with you");
  });

  it("hides the greeting paragraph (and its heading) when none was entered", () => {
    renderPage({ settings: { ...FULL_SETTINGS, greetingMessage: "   " } });
    expect(section("greetings")).toBeNull();
    expect(pageRoot().textContent).not.toContain("Greetings");
  });

  it("shows only one name when the other is missing, and no empty date line", () => {
    renderPage({ invitation: { brideName: { first: "Taylor" } }, settings: BARE_SETTINGS });
    expect(within(section("header")).getByRole("heading", { level: 1 }).textContent).toBe("Taylor");
    // Title only: no date/venue line at all
    expect(section("header").querySelectorAll("p")).toHaveLength(1);
  });

  it("venue: no map or directions without a real address, only real parts", () => {
    renderPage({ invitation: { ...INVITATION, venueAddress: "" } });
    const venue = section("venue");
    expect(venue).toHaveTextContent("The Adolphus");
    expect(within(venue).queryByTestId("venue-address")).toBeNull();
    // the name alone is still a real place to map / get directions to
    expect(within(venue).getByTestId("map-embed")).toHaveAttribute("data-interactive", "true");
    expect(within(venue).getByRole("link", { name: "Get directions" })).toBeTruthy();
  });

  it("venue switches still apply on the page", () => {
    renderPage({ settings: { ...FULL_SETTINGS, venueShowMap: false, venueShowDirections: false } });
    const venue = section("venue");
    expect(within(venue).queryByTestId("map-embed")).toBeNull();
    expect(within(venue).queryByRole("link", { name: "Get directions" })).toBeNull();
    expect(within(venue).getByTestId("venue-address")).toHaveTextContent("1321 Commerce St");
  });

  it("does not leave empty bands for a hidden Registry or Q&A", () => {
    renderPage({ registries: REGISTRIES, registryMessage: "Thanks!", registryShown: false, qaEntries: [] });
    expect(section("registry")).toBeNull();
    expect(section("qa")).toBeNull();
  });

  it("only shows registry links marked visible", () => {
    renderPage({
      registries: [...REGISTRIES, { id: "r2", name: "Secret list", url: "https://x.com", isVisible: false }],
      registryMessage: "Thanks!",
    });
    expect(section("registry")).toHaveTextContent("Zola");
    expect(section("registry")).not.toHaveTextContent("Secret list");
  });
});

describe("page mode — hero photo keeps the couple's position and zoom", () => {
  it("uses the same image style as the editor and phone preview", () => {
    renderPage({ hero: HERO });
    const img = within(screen.getByTestId("invitation-hero-frame")).getByRole("img");
    expect(img).toHaveAttribute("src", HERO.url);
    expect(img).toHaveAttribute("alt", "Chris & Taylor");
    const expected = photoImageStyle(HERO);
    expect(img.style.objectPosition).toBe(expected.objectPosition);
    expect(img.style.transform).toBe(expected.transform);
    expect(img.style.transformOrigin).toBe(expected.transformOrigin);
  });

  it("the page's hero frame CSS uses the editor's aspect ratio (HERO_FRAME_ASPECT)", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/invitation/invitationContent.css"), "utf8");
    const frameRule = css.match(/\.tg-inv-hero__frame\s*\{([^}]*)\}/)[1];
    const ratio = frameRule.match(/aspect-ratio:\s*([^;]+);/)[1].trim();
    expect(ratio.replace(/\s/g, "")).toBe(HERO_FRAME_ASPECT.replace(/\s/g, ""));
    // width is capped by the window height using the same ratio (shape never changes)
    expect(frameRule.replace(/\s/g, "")).toContain(`calc(82vh*${HERO_FRAME_ASPECT.replace(/\s/g, "")})`);
  });

  it("the hero RSVP button scrolls to the RSVP section", () => {
    const onNavigate = vi.fn();
    renderPage({ hero: HERO, onNavigate });
    fireEvent.click(within(screen.getByTestId("invitation-hero-frame")).getByRole("button", { name: "RSVP" }));
    expect(onNavigate).toHaveBeenCalledWith("rsvp");
  });
});

describe("page mode — responsive structure", () => {
  it("every section uses the fluid spacing and a centered content column", () => {
    renderPage({ hero: HERO, storyBlocks: STORY, partyMembers: PARTY, registries: REGISTRIES });
    for (const id of ["header", "greetings", "date", "music", "venue", "travel", "rsvp", "registry", "closure"]) {
      expect(section(id)).toHaveClass("tg-inv-section");
      expect(section(id).querySelector(":scope > .tg-inv-inner")).toBeTruthy();
    }
    // Card-style lists get the wider column
    expect(section("travel").querySelector(":scope > .tg-inv-inner")).toHaveClass("tg-inv-inner--wide");
    expect(section("travel").querySelector(".tg-inv-travel__list")).toBeTruthy();
  });

  it("uses scalable type classes instead of the phone's fixed pixel sizes", () => {
    renderPage();
    expect(within(section("header")).getByRole("heading", { level: 1 })).toHaveClass("tg-inv-h1");
    expect(within(section("rsvp")).getByRole("heading", { level: 2 })).toHaveClass("tg-inv-h2");
    expect(pageRoot().innerHTML).not.toMatch(/text-\[\d+px\]/);
  });

  it("gives the music player and map full-size versions", () => {
    renderPage();
    expect(within(section("music")).getByTitle("Spotify song")).toHaveAttribute("height", "152");
    expect(within(section("venue")).getByTestId("map-embed").getAttribute("data-height")).toMatch(/lg:h-80/);
  });

  it("passes the sticky-bar height to the CSS so section links land below it", () => {
    render(<InvitationPageSurface settings={FULL_SETTINGS} scrollOffset={64}><span /></InvitationPageSurface>);
    expect(pageRoot().style.getPropertyValue("--inv-scroll-offset")).toBe("64px");
  });

  it("the stylesheet scales with the invitation's width (container queries)", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/invitation/invitationContent.css"), "utf8");
    expect(css).toMatch(/\.tg-invitation-page\s*\{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/--inv-h1:\s*clamp\(/);
    expect(css).toMatch(/@container tg-invitation \(min-width: 640px\)\s*\{\s*\.tg-inv-travel__list\s*\{\s*grid-template-columns: repeat\(2/);
    expect(css).toMatch(/scroll-margin-top:\s*var\(--inv-scroll-offset/);
    // buttons stay comfortably tappable on phones
    expect(css).toMatch(/\.tg-inv-button\s*\{[^}]*min-height:\s*44px/);
  });
});

describe("page mode — RSVP area and Q&A links", () => {
  it("renders the page's RSVP slot under the deadline", () => {
    renderPage({ rsvpSlot: <p data-testid="slot">RSVP is turned off in this preview.</p> });
    expect(section("rsvp")).toHaveTextContent("Kindly reply by April 1");
    expect(within(section("rsvp")).getByTestId("slot")).toBeTruthy();
    // no sample "RSVP Now" button from the phone preview
    expect(within(section("rsvp")).queryByRole("button")).toBeNull();
  });

  it("Q&A section links call onNavigate with the linked section", () => {
    const onNavigate = vi.fn();
    renderPage({
      onNavigate,
      qaEntries: getGuestQaItems(
        normalizeQaItems([{ id: "q1", question: "Where should I stay?", answerType: "section", section: "travel", isVisible: true }]),
        { data: INVITATION, availableSections: new Set(["travel", "rsvp"]) }, true,
      ),
    });
    fireEvent.click(within(section("qa")).getByRole("button", { name: /Where should I stay/ }));
    fireEvent.click(within(section("qa")).getByRole("button", { name: /View Travel/ }));
    expect(onNavigate).toHaveBeenCalledWith("travel");
  });
});

describe("WeddingDaySection variants", () => {
  const theme = resolveInvitationTheme(FULL_SETTINGS);

  it("compact (builder) keeps its phone classes and the Add to calendar placeholder at the bottom", () => {
    const { container } = render(
      <WeddingDaySection invitation={INVITATION} settings={FULL_SETTINGS} theme={theme} backgroundColor="#fff" />,
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass("p-6", "text-center");
    expect(root.querySelector(".tg-inv-inner")).toBeNull();
    expect(screen.getByTestId("preview-add-to-calendar")).toHaveTextContent("Add to calendar");
    expect(root.lastElementChild).toBe(screen.getByTestId("preview-add-to-calendar"));
  });

  it("page uses the working Save the Date button (no placeholder) and page sizing", () => {
    const { container } = render(
      <WeddingDaySection invitation={INVITATION} settings={FULL_SETTINGS} theme={theme} backgroundColor="#fff" variant="page" />,
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass("tg-inv-section");
    expect(root.querySelector(":scope > .tg-inv-inner")).toBeTruthy();
    expect(screen.queryByTestId("preview-add-to-calendar")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to Calendar" })).toHaveClass("tg-inv-button");
    expect(screen.getByTestId("wedding-calendar")).toHaveClass("tg-inv-date__calendar");
    expect(screen.getByTestId("wedding-countdown")).toHaveClass("tg-inv-date__countdown");
  });
});
