// Unit tests for the Wedding Party helpers (src/lib/weddingParty.js) and the
// Wedding Party part of the photo Save pipeline (src/lib/storySave.js).
// Firebase is faked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(), buildHeroPath: vi.fn(), buildStoryPath: vi.fn(), buildPartyPath: vi.fn(),
}));
vi.mock("@/lib/storyStore", () => ({ commitMediaChanges: vi.fn(), updateMediaBookkeeping: vi.fn() }));

import {
  createPartyMember, normalizePartyMembers, normalizePartySettings, updatePartyMember, setPointOfContact,
  validatePartyMembers, isPartyMemberBlank, cleanPartyMembersForSave, toStoredPartyMember,
  getRoleLabel, groupPartyMembers, shouldShowPartySection, getShownContact, phoneHref, memberInitials,
  toPrivateContacts, normalizePrivateContacts, mergePrivateContacts, sameContacts, partyPhotoBytes,
  isValidPartyPhone, isValidPartyEmail,
} from "@/lib/weddingParty";
import { saveStoryMedia } from "@/lib/storySave";

const member = (overrides = {}) => ({ ...createPartyMember(), name: "Jordan Lee", role: "bestMan", sideAuto: false, ...overrides });

let n = 0;
const pending = (bytes = 1000) => ({
  pending: true, localId: `local-${++n}`, blob: {}, previewUrl: "blob:x", width: 100, height: 100,
  bytes, contentType: "image/webp", fileName: "p.jpg",
});
const stored = (path, bytes = 1000) => ({ path, url: `https://cdn/${path}`, width: 100, height: 100, bytes, contentType: "image/webp" });

// ─────────────────────────────────────────────────────────────────────────────
describe("roles, sides and settings", () => {
  it("labels standard and custom roles", () => {
    expect(getRoleLabel({ role: "maidOfHonor" })).toBe("Maid of Honor");
    expect(getRoleLabel({ role: "matronOfHonor" })).toBe("Matron of Honor");
    expect(getRoleLabel({ role: "other", customRole: " Flower Girl " })).toBe("Flower Girl");
    expect(getRoleLabel({ role: "" })).toBe("");
  });

  it("suggests a side from the role until the couple picks one", () => {
    let m = createPartyMember();
    expect(m.side).toBe("other");
    m = updatePartyMember(m, "role", "groomsman");
    expect(m.side).toBe("groom");
    m = updatePartyMember(m, "role", "bridesmaid");
    expect(m.side).toBe("bride");
    m = updatePartyMember(m, "side", "other");
    m = updatePartyMember(m, "role", "bestMan");
    expect(m.side).toBe("other"); // manual choice is kept
  });

  it("defaults: shown, one combined group; older invitations get the defaults", () => {
    expect(normalizePartySettings({})).toEqual({ partyShowOnInvitation: true, partyGroupBySide: false });
    expect(normalizePartySettings({ partyShowOnInvitation: false, partyGroupBySide: true }))
      .toEqual({ partyShowOnInvitation: false, partyGroupBySide: true });
    expect(normalizePartySettings({ partyGroupBySide: "yes" }).partyGroupBySide).toBe(false);
  });

  it("allows only one wedding-day point of contact", () => {
    const a = member({ id: "a" });
    const b = member({ id: "b", isPointOfContact: true });
    const next = setPointOfContact([a, b], "a", true);
    expect(next.map(m => m.isPointOfContact)).toEqual([true, false]);
    expect(setPointOfContact(next, "a", false).map(m => m.isPointOfContact)).toEqual([false, false]);
    // stored data with two points of contact is repaired on load
    const loaded = normalizePartyMembers([
      { id: "a", name: "A", role: "bestMan", isPointOfContact: true },
      { id: "b", name: "B", role: "bridesmaid", isPointOfContact: true },
    ]);
    expect(loaded.map(m => m.isPointOfContact)).toEqual([true, false]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("validation", () => {
  it("requires a name and a role for every member with details; blank members are skipped", () => {
    const blank = createPartyMember();
    const noRole = member({ id: "x", role: "" });
    const noName = member({ id: "y", name: "  " });
    const otherNoText = member({ id: "z", role: "other", customRole: "" });
    const ok = member({ id: "ok" });
    expect(isPartyMemberBlank(blank)).toBe(true);
    const errors = validatePartyMembers([blank, noRole, noName, otherNoText, ok]);
    expect(Object.keys(errors).sort()).toEqual(["x", "y", "z"]);
    expect(errors.x.role).toBeTruthy();
    expect(errors.y.name).toBeTruthy();
    expect(errors.z.customRole).toBeTruthy();
  });

  it("checks phone and email only when given", () => {
    expect(isValidPartyPhone("(214) 555-0123")).toBe(true);
    expect(isValidPartyPhone("+44 20 7946 0958")).toBe(true);
    expect(isValidPartyPhone("call me")).toBe(false);
    expect(isValidPartyPhone("123")).toBe(false);
    expect(isValidPartyEmail("jordan@example.com")).toBe(true);
    expect(isValidPartyEmail("jordan@")).toBe(false);
    const errors = validatePartyMembers([member({ id: "a", phone: "abc", email: "nope" }), member({ id: "b" })]);
    expect(errors.a.phone).toBeTruthy();
    expect(errors.a.email).toBeTruthy();
    expect(errors.b).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("privacy of contact details", () => {
  it("never writes hidden phone numbers or emails to the public member", () => {
    const hidden = toStoredPartyMember(member({ phone: "214-555-0123", email: "j@example.com", showContact: false }));
    expect(hidden.publicPhone).toBe("");
    expect(hidden.publicEmail).toBe("");
    expect(JSON.stringify(hidden)).not.toMatch(/555|example\.com/);
    expect(hidden).not.toHaveProperty("phone");
    expect(hidden).not.toHaveProperty("email");

    const shown = toStoredPartyMember(member({ phone: " 214-555-0123 ", email: "j@example.com", showContact: true }));
    expect(shown.publicPhone).toBe("214-555-0123");
    expect(shown.publicEmail).toBe("j@example.com");
  });

  it("shows contact details only when enabled", () => {
    expect(getShownContact(member({ phone: "2145550123", showContact: false }))).toBeNull();
    expect(getShownContact(member({ phone: "2145550123", showContact: true }))).toEqual({ phone: "2145550123", email: "" });
    expect(getShownContact(member({ showContact: true }))).toBeNull();
    expect(phoneHref("+1 (214) 555-0123")).toBe("tel:+12145550123");
  });

  it("round-trips private contacts and merges them into loaded members", () => {
    const members = [member({ id: "a", phone: "2145550123" }), member({ id: "b" })];
    const contacts = toPrivateContacts(members);
    expect(contacts).toEqual({ a: { phone: "2145550123", email: "" } });
    expect(normalizePrivateContacts({ contacts })).toEqual(contacts);
    expect(normalizePrivateContacts({ contacts: "bad" })).toEqual({});
    const loaded = normalizePartyMembers([{ id: "a", name: "A", role: "bestMan", showContact: false }]);
    expect(loaded[0].phone).toBe("");
    expect(mergePrivateContacts(loaded, contacts)[0].phone).toBe("2145550123");
    expect(sameContacts({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("loads public contact details back only when shown", () => {
    const [m] = normalizePartyMembers([{ id: "a", name: "A", role: "bestMan", showContact: true, publicPhone: "2145550123" }]);
    expect(m.phone).toBe("2145550123");
    const [h] = normalizePartyMembers([{ id: "b", name: "B", role: "bestMan", showContact: false, publicPhone: "leak" }]);
    expect(h.phone).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("display helpers", () => {
  it("groups into one combined section by default, or by side", () => {
    const members = [
      member({ id: "1", side: "groom" }), member({ id: "2", side: "bride" }),
      member({ id: "3", side: "other" }), member({ id: "4", side: "bride" }), createPartyMember(),
    ];
    const combined = groupPartyMembers(members, false);
    expect(combined).toHaveLength(1);
    expect(combined[0].members.map(m => m.id)).toEqual(["1", "2", "3", "4"]); // blank member hidden, order kept
    const bySide = groupPartyMembers(members, true);
    expect(bySide.map(g => g.label)).toEqual(["Bride's Party", "Groom's Party", "Other"]);
    expect(bySide[0].members.map(m => m.id)).toEqual(["2", "4"]);
    expect(groupPartyMembers([member({ side: "groom" })], true).map(g => g.id)).toEqual(["groom"]);
  });

  it("shows the section only when switched on and someone has a name", () => {
    expect(shouldShowPartySection({}, [])).toBe(false);
    expect(shouldShowPartySection({}, [createPartyMember()])).toBe(false);
    expect(shouldShowPartySection({}, [member()])).toBe(true);
    expect(shouldShowPartySection({ partyShowOnInvitation: false }, [member()])).toBe(false);
  });

  it("makes initials for the placeholder avatar", () => {
    expect(memberInitials("jordan lee smith")).toBe("JL");
    expect(memberInitials("  ")).toBe("");
  });

  it("tolerates garbage stored data", () => {
    const [m] = normalizePartyMembers([{ id: "../evil", name: 5, role: "king", side: "left", photo: { path: 1 } }]);
    expect(m.id).not.toBe("../evil");
    expect(m.name).toBe("");
    expect(m.role).toBe("");
    expect(m.side).toBe("other");
    expect(m.photo).toBeNull();
    expect(normalizePartyMembers("nope")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("saveStoryMedia — Wedding Party", () => {
  const makeDeps = (overrides = {}) => ({
    buildHeroPath: vi.fn((w) => `weddings/${w}/hero/new-${++n}.webp`),
    buildStoryPath: vi.fn((w, e) => `weddings/${w}/story/${e}/new-${++n}.webp`),
    buildPartyPath: vi.fn((w, m) => `weddings/${w}/party/${m}/new-${++n}.webp`),
    uploadPhoto: vi.fn(async (path, photo, onProgress) => { onProgress(100); return stored(path, photo.bytes); }),
    deletePhoto: vi.fn(async () => true),
    commitMediaChanges: vi.fn(async () => {}),
    updateMediaBookkeeping: vi.fn(async () => {}),
    ...overrides,
  });
  const base = { weddingId: "w1", hero: null, savedHero: null, blocks: [], savedEntriesById: {}, pendingDeletes: [], savedMediaBytesUsed: 0 };

  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("uploads member photos, drops blank members and writes partyMembers in the same commit", async () => {
    const deps = makeDeps();
    const a = member({ id: "a", photo: pending(700), phone: "2145550123", showContact: false });
    const res = await saveStoryMedia({ ...base, partyMembers: [a, createPartyMember()], savedPartyMembers: [], deps });

    expect(deps.buildPartyPath).toHaveBeenCalledWith("w1", "a", "image/webp");
    expect(deps.commitMediaChanges).toHaveBeenCalledTimes(1);
    const fields = deps.commitMediaChanges.mock.calls[0][2];
    expect(fields.partyMembers).toHaveLength(1);
    expect(fields.partyMembers[0].photo.path).toMatch(/^weddings\/w1\/party\/a\//);
    expect(fields.partyMembers[0].publicPhone).toBe(""); // hidden contact never written
    expect(fields.mediaBytesUsed).toBe(700);
    expect(res.partyMembers).toEqual(fields.partyMembers);
  });

  it("deletes a replaced member photo after the commit", async () => {
    const deps = makeDeps();
    const old = stored("weddings/w1/party/a/old.webp", 500);
    const saved = [toStoredPartyMember(member({ id: "a", photo: old }))];
    const res = await saveStoryMedia({
      ...base, savedMediaBytesUsed: 500, savedPartyMembers: saved,
      partyMembers: [member({ id: "a", photo: pending(300) })], deps,
    });
    expect(deps.deletePhoto).toHaveBeenCalledWith("w1", old.path);
    expect(res.mediaBytesUsed).toBe(300);
  });

  it("leaves stored members alone (but counts their photos) when partyMembers is null", async () => {
    const deps = makeDeps();
    const saved = [toStoredPartyMember(member({ id: "a", photo: stored("weddings/w1/party/a/p.webp", 900) }))];
    await saveStoryMedia({ ...base, hero: pending(100), savedPartyMembers: saved, partyMembers: null, deps });
    const fields = deps.commitMediaChanges.mock.calls[0][2];
    expect(fields).not.toHaveProperty("partyMembers");
    expect(fields.mediaBytesUsed).toBe(1000);
    expect(deps.deletePhoto).not.toHaveBeenCalled();
  });

  it("skips Firestore when the wedding party did not change", async () => {
    const deps = makeDeps();
    const m = member({ id: "a" });
    const res = await saveStoryMedia({ ...base, savedPartyMembers: [toStoredPartyMember(m)], partyMembers: [m], deps });
    expect(deps.commitMediaChanges).not.toHaveBeenCalled();
    expect(res.wrote).toBe(false);
  });

  it("counts member photos toward the quota before uploading", async () => {
    const deps = makeDeps();
    await expect(saveStoryMedia({
      ...base, quotaBytes: 1000, partyMembers: [member({ photo: pending(1500) })], savedPartyMembers: [], deps,
    })).rejects.toThrow(/photo limit/);
    expect(deps.uploadPhoto).not.toHaveBeenCalled();
  });

  it("keeps trimmed text and member order", () => {
    const cleaned = cleanPartyMembersForSave([member({ id: "1", name: "  Ana  " }), createPartyMember(), member({ id: "2" })]);
    expect(cleaned.map(m => m.id)).toEqual(["1", "2"]);
    expect(cleaned[0].name).toBe("Ana");
    expect(partyPhotoBytes([member({ photo: pending(10) }), createPartyMember()])).toBe(10);
  });
});
