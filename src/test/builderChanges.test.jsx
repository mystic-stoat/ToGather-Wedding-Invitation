// "Unsaved changes" rules behind the builder's View Invitation button
// (src/lib/builderChanges.js). Something is unsaved only if clicking Save
// would write something different — so edits that Save would drop anyway
// (a blank meal row, an empty story block, a blank party member…) don't count.
import { describe, it, expect } from "vitest";
import { settingsSaveSnapshot, hasUnsavedMediaChanges, stableStringify } from "@/lib/builderChanges";
import { invitationToSettings } from "@/lib/invitationView";
import { normalizeStoryEntry, toEntryData, normalizeSavedPhoto } from "@/lib/storyBlocks";
import { normalizePartyMembers, toStoredPartyMember, createPartyMember } from "@/lib/weddingParty";

const photo = (path, extra = {}) => ({
  path, url: `https://cdn.example/${path}`, width: 800, height: 600, bytes: 1000, contentType: "image/webp", ...extra,
});
const pending = { pending: true, localId: "local-1", previewUrl: "blob:x", bytes: 900, contentType: "image/webp" };

describe("stableStringify", () => {
  it("ignores object key order", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it("keeps array order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("settingsSaveSnapshot — settings changes", () => {
  const saved = invitationToSettings({ greetingTitle: "Join us", greetingMessage: "Hi" });
  const snap = settingsSaveSnapshot(saved);

  it("is unchanged for the same settings, and after an edit is undone", () => {
    expect(settingsSaveSnapshot({ ...saved })).toBe(snap);
    const edited = { ...saved, greetingTitle: "Join us!" };
    expect(settingsSaveSnapshot(edited)).not.toBe(snap);
    expect(settingsSaveSnapshot({ ...edited, greetingTitle: "Join us" })).toBe(snap);
  });

  it("detects text, switch, theme, deadline and travel changes", () => {
    for (const change of [
      { greetingMessage: "Hello" },
      { musicShowOnInvitation: false },
      { colorPalette1: "#123456" },
      { inviteDeadline: "2027-04-01" },
      { dateShowCalendar: true },
      { venueShowMap: false },
      { travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }] },
    ]) {
      expect(settingsSaveSnapshot({ ...saved, ...change })).not.toBe(snap);
    }
  });

  it("ignores edits Save would drop or normalize away", () => {
    // a meal / place with no name is removed on save
    expect(settingsSaveSnapshot({ ...saved, mealOptions: [{ id: "m1", name: "  ", description: "" }] })).toBe(snap);
    expect(settingsSaveSnapshot({
      ...saved, travelItems: [{ id: "t1", category: "hotel", name: "", mapUrl: "", description: "" }],
    })).toBe(snap);
    // surrounding spaces in the travel message are trimmed on save
    expect(settingsSaveSnapshot({ ...saved, travelMessage: "   " })).toBe(snap);
    // a blank story title falls back to "Our Story"
    expect(settingsSaveSnapshot({ ...saved, storyTitle: "  " })).toBe(snap);
  });

  it("never treats isPublished as something Save writes", () => {
    expect(settingsSaveSnapshot({ ...saved, isPublished: true })).toBe(snap);
    expect(snap).not.toContain("isPublished");
  });
});

describe("hasUnsavedMediaChanges — Hero Photo, Our Story, Wedding Party", () => {
  const hero = normalizeSavedPhoto(photo("weddings/w1/hero/a.webp"));
  const block = normalizeStoryEntry({
    id: "s1", layout: "photoLeft", title: "Met", description: "At UNT",
    images: [photo("weddings/w1/story/s1/a.webp")], order: 0,
  }, "s1");
  const savedEntriesById = { s1: toEntryData(block, 0) };
  const members = normalizePartyMembers([{ id: "m1", name: "Ana", role: "maidOfHonor", side: "bride" }]);
  const savedPartyMembers = members.map(m => toStoredPartyMember(m));
  const base = { hero, savedHero: hero, blocks: [block], savedEntriesById, partyMembers: members, savedPartyMembers };

  it("is false when everything matches what is saved", () => {
    expect(hasUnsavedMediaChanges(base)).toBe(false);
  });

  it("hero: a new photo waiting to upload, a removed photo, or a new position/zoom", () => {
    expect(hasUnsavedMediaChanges({ ...base, hero: pending })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, hero: null })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, hero: { ...hero, adjust: { x: 30, y: 70, zoom: 1.5 } } })).toBe(true);
  });

  it("story: edited text, a new or removed block, a new photo, a new order", () => {
    expect(hasUnsavedMediaChanges({ ...base, blocks: [{ ...block, title: "We met" }] })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, blocks: [] })).toBe(true);
    const added = normalizeStoryEntry({ id: "s2", layout: "textOnly", title: "Proposal", description: "", images: [] }, "s2");
    expect(hasUnsavedMediaChanges({ ...base, blocks: [block, added] })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, blocks: [{ ...block, images: [pending, null, null] }] })).toBe(true);
    const savedTwo = { s1: toEntryData(block, 0), s2: toEntryData(added, 1) };
    expect(hasUnsavedMediaChanges({ ...base, blocks: [added, block], savedEntriesById: savedTwo })).toBe(true);
  });

  it("story: an empty new block is not a change (Save drops it)", () => {
    const empty = normalizeStoryEntry({ id: "s9", layout: "collage", title: "", description: "", images: [] }, "s9");
    expect(hasUnsavedMediaChanges({ ...base, blocks: [block, empty] })).toBe(false);
  });

  it("story: not compared until Our Story has loaded", () => {
    expect(hasUnsavedMediaChanges({ ...base, blocks: [], storyReady: false })).toBe(false);
  });

  it("party: edited, added or removed members, or a new photo", () => {
    expect(hasUnsavedMediaChanges({ ...base, partyMembers: [{ ...members[0], name: "Ana R." }] })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, partyMembers: [] })).toBe(true);
    expect(hasUnsavedMediaChanges({
      ...base, partyMembers: [...members, ...normalizePartyMembers([{ id: "m2", name: "Sam", role: "bestMan", side: "groom" }])],
    })).toBe(true);
    expect(hasUnsavedMediaChanges({ ...base, partyMembers: [{ ...members[0], photo: pending }] })).toBe(true);
  });

  it("party: a blank new member is not a change, and nothing is compared before members load", () => {
    // exactly what "Add member" creates, before anything is filled in
    expect(hasUnsavedMediaChanges({ ...base, partyMembers: [...members, createPartyMember()] })).toBe(false);
    expect(hasUnsavedMediaChanges({ ...base, partyMembers: [], partyLoaded: false })).toBe(false);
  });
});
