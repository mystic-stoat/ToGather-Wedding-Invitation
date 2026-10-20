// Pure rules behind the standalone invitation (src/lib/invitationView.js):
//   - invitationToSettings / savedInvitationToView: a SAVED Firestore document
//     becomes the same data the builder works with (same defaults);
//   - getSectionVisibility / getInvitationSectionIds: which sections show in
//     the builder preview vs. the standalone page (no unfinished placeholders).
import { describe, it, expect } from "vitest";
import {
  VIEW_MODES, invitationToSettings, savedInvitationToView,
  getSectionVisibility, getInvitationSectionIds,
} from "@/lib/invitationView";
import { DEFAULT_THEME_SETTINGS } from "@/lib/invitationTheme";
import { normalizeStoryEntry } from "@/lib/storyBlocks";
import { normalizePartyMembers } from "@/lib/weddingParty";

const { PREVIEW, PAGE } = VIEW_MODES;

const photo = (path) => ({ path, url: `https://cdn.example/${path}`, width: 800, height: 1200, bytes: 1000, contentType: "image/webp" });
const textBlock = normalizeStoryEntry({ id: "s1", layout: "textOnly", title: "How we met", description: "", images: [] }, "s1");
const emptyPhotoBlock = normalizeStoryEntry({ id: "s2", layout: "collage", title: "", description: "", images: [] }, "s2");
const party = normalizePartyMembers([{ id: "m1", name: "Ana", role: "maidOfHonor", side: "bride" }]);

describe("invitationToSettings — saved document → builder settings", () => {
  it("gives an older/empty document the builder's defaults", () => {
    const s = invitationToSettings({ weddingId: "w1" });
    expect(s).toMatchObject({
      ...DEFAULT_THEME_SETTINGS,
      greetingTitle: "", greetingMessage: "", closureTitle: "",
      musicShowOnInvitation: true,          // shown by default
      travelShowOnInvitation: true, travelItems: [], travelMessage: "",
      storyTitle: "Our Story", storyShowOnInvitation: true,
      dateShowCalendar: false, dateShowCountdown: false, dateShowAddToCalendar: true,
      venueShowOnInvitation: true, venueShowMap: true, venueShowAddress: true, venueShowDirections: true,
      mealOptions: [],
    });
  });

  it("returns defaults for a missing document", () => {
    expect(invitationToSettings(null)).toMatchObject({
      musicShowOnInvitation: true, storyTitle: "Our Story", dateShowAddToCalendar: true,
    });
  });

  it("keeps a saved Add to Calendar choice (owner preview / published page)", () => {
    expect(invitationToSettings({ dateShowAddToCalendar: false }).dateShowAddToCalendar).toBe(false);
    expect(invitationToSettings({ dateShowAddToCalendar: true, isPublished: true }).dateShowAddToCalendar).toBe(true);
  });

  it("keeps the couple's saved choices, including switches that are off", () => {
    const s = invitationToSettings({
      greetingTitle: "Join us", greetingMessage: "Hi!", inviteDeadline: "2027-04-01",
      musicTrackId: "abc1234567", musicShowOnInvitation: false,
      storyTitle: "  ", storyShowOnInvitation: false,
      dateShowCountdown: true, venueShowMap: false, travelShowOnInvitation: false,
      partyShowOnInvitation: false, partyGroupBySide: true,
      colorPalette1: "#123456", font1: "Great Vibes",
    });
    expect(s).toMatchObject({
      greetingTitle: "Join us", greetingMessage: "Hi!", inviteDeadline: "2027-04-01",
      musicTrackId: "abc1234567", musicShowOnInvitation: false,
      storyTitle: "Our Story",              // blank title falls back, like the builder
      storyShowOnInvitation: false,
      dateShowCountdown: true, venueShowMap: false, travelShowOnInvitation: false,
      partyShowOnInvitation: false, partyGroupBySide: true,
      colorPalette1: "#123456", font1: "Great Vibes",
    });
  });
});

describe("savedInvitationToView — everything the page renders", () => {
  it("normalizes hero, story, party, registry and Q&A from the saved data", () => {
    const view = savedInvitationToView({
      weddingId: "w1",
      heroImage: { ...photo("weddings/w1/hero/a.webp"), adjust: { x: 30, y: 70, zoom: 1.5 } },
      partyMembers: [{ id: "m1", name: "Ana", role: "maidOfHonor", side: "bride" }],
      registries: [{ id: "r1", name: "Zola", url: "https://zola.com", isVisible: true }],
      registryMessage: "Thanks!", registryShowOnInvitation: false,
      qaShowOnInvitation: true, qaItems: [{ id: "q1", question: "Dress?", answerType: "text", text: "Formal", isVisible: true }],
    }, [{ docId: "s1", data: { id: "s1", layout: "textOnly", title: "Met", description: "UNT", images: [], order: 0 } }]);

    expect(view.hero).toMatchObject({ url: "https://cdn.example/weddings/w1/hero/a.webp", adjust: { x: 30, y: 70, zoom: 1.5 } });
    expect(view.storyBlocks).toHaveLength(1);
    expect(view.storyBlocks[0]).toMatchObject({ id: "s1", title: "Met" });
    expect(view.partyMembers[0]).toMatchObject({ id: "m1", name: "Ana" });
    expect(view.registries).toHaveLength(1);
    expect(view.registryMessage).toBe("Thanks!");
    expect(view.registryShown).toBe(false);
    expect(view.qaShown).toBe(true);
    expect(view.qaItems[0]).toMatchObject({ id: "q1", question: "Dress?" });
  });

  it("copes with an invitation that has none of the optional data", () => {
    const view = savedInvitationToView({ weddingId: "w1" });
    expect(view).toMatchObject({
      hero: null, storyBlocks: [], partyMembers: [], registries: [], registryMessage: "",
      registryShown: true, qaItems: [], qaShown: false,
    });
  });
});

describe("getSectionVisibility — preview vs. standalone page", () => {
  const bare = { invitation: {}, settings: invitationToSettings({}) };

  it("preview keeps placeholder sections; the page leaves them out", () => {
    const ctx = {
      ...bare,
      settings: { ...bare.settings, dateShowCalendar: true },   // on, but no date
      storyBlocks: [emptyPhotoBlock],                            // a block with no content yet
    };
    expect(getSectionVisibility(ctx, PREVIEW)).toMatchObject({
      heroPhoto: true, greetings: true, date: true, story: true, venue: true,
    });
    expect(getSectionVisibility(ctx, PAGE)).toMatchObject({
      heroPhoto: false, greetings: false, date: false, story: false, venue: false,
    });
  });

  it("the page shows sections that have real content", () => {
    const ctx = {
      invitation: { weddingDate: "2027-05-22", venueName: "The Adolphus" },
      settings: { ...bare.settings, greetingMessage: "Hello", dateShowCountdown: true },
      hero: photo("weddings/w1/hero/a.webp"),
      storyBlocks: [emptyPhotoBlock, textBlock],
      partyMembers: party,
      registries: [{ id: "r1", name: "Zola", url: "https://zola.com", isVisible: true }],
    };
    expect(getSectionVisibility(ctx, PAGE)).toMatchObject({
      header: true, heroPhoto: true, greetings: true, date: true, story: true,
      party: true, venue: true, rsvp: true, registry: true, closure: true,
    });
  });

  it("a greeting of only spaces counts as never entered on the page", () => {
    const ctx = { ...bare, settings: { ...bare.settings, greetingMessage: "   " } };
    expect(getSectionVisibility(ctx, PAGE).greetings).toBe(false);
  });

  it("switches the couple turned off stay off in both modes", () => {
    const ctx = {
      invitation: { weddingDate: "2027-05-22", venueName: "Hall" },
      settings: {
        ...bare.settings, venueShowOnInvitation: false, storyShowOnInvitation: false,
        partyShowOnInvitation: false, musicTrackId: "abc1234567", musicShowOnInvitation: false,
        travelShowOnInvitation: false, travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
      },
      storyBlocks: [textBlock], partyMembers: party,
      registries: [{ id: "r1", name: "Zola", url: "https://zola.com", isVisible: true }], registryShown: false,
    };
    for (const mode of [PREVIEW, PAGE]) {
      expect(getSectionVisibility(ctx, mode)).toMatchObject({
        venue: false, story: false, party: false, music: false, travel: false, registry: false,
      });
    }
  });
});

describe("getInvitationSectionIds — where Q&A links may point", () => {
  it("preview mode matches the builder's former rules (placeholders count)", () => {
    const ids = getInvitationSectionIds({
      invitation: {}, settings: { ...invitationToSettings({}), dateShowCalendar: true },
      storyBlocks: [emptyPhotoBlock],
    }, PREVIEW);
    expect([...ids].sort()).toEqual(["date", "rsvp", "story", "venue"]);
  });

  it("page mode only lists sections that are really on the page", () => {
    const ids = getInvitationSectionIds({
      invitation: {}, settings: { ...invitationToSettings({}), dateShowCalendar: true },
      storyBlocks: [emptyPhotoBlock],
    }, PAGE);
    expect([...ids]).toEqual(["rsvp"]);
  });
});
