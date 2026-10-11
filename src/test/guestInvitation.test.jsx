// Guest invitation data (src/lib/guestInvitation.js, Phase 4).
//   - toGuestInvitation: only what the invitation displays — no owner/private
//     fields, no hidden items, nothing from sections the couple switched off
//   - toGuestDetails: the guest's own details, never the token
//   - fetchGuestInvitation: invalid links get nothing; Our Story is optional
// NOTE: in Phase 4 the token check runs in the browser and is NOT a security
// boundary (see docs/INVITATION_WEBSITE.md — Phase 5).
import { describe, it, expect, vi, beforeEach } from "vitest";

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

import {
  toGuestInvitation, toGuestDetails, fetchGuestInvitation, submitGuestRsvp,
} from "@/lib/guestInvitation";

const INVITATION = {
  userId: "owner-uid", isPublished: true, createdAt: "2026-01-01",
  mediaBytesUsed: 12345, mediaPendingDeletes: [{ path: "weddings/w1/hero/old.webp", bytes: 1 }],
  qaStartersCreated: true, musicSpotifyUrl: "https://open.spotify.com/track/x?si=private",
  groomName: { first: "Chris", middle: "M", last: "Lee" }, brideName: { first: "Taylor", last: "Kim" },
  weddingDate: "2027-05-22", ceremonyTime: "16:30", venueName: "Rose Hall", venueAddress: "1 Garden Way",
  inviteDeadline: "2027-04-01", mealOptions: [{ id: "m1", name: "Chicken", description: "" }],
  greetingMessage: "Hello", colorPalette1: "#123456",
  musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", musicShowOnInvitation: true,
  travelItems: [{ id: "t1", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
  partyMembers: [{
    id: "p1", name: "Ana", role: "maidOfHonor", side: "bride",
    showContact: false, publicPhone: "", publicEmail: "", phone: "555-0100", email: "ana@private.example",
  }],
  registryMessage: "Thanks!",
  registries: [
    { id: "r1", name: "Zola", url: "https://zola.com", isVisible: true, internalNote: "x" },
    { id: "r2", name: "Secret list", url: "https://secret.example", isVisible: false },
  ],
  qaShowOnInvitation: true,
  qaItems: [
    { id: "q1", question: "Dress?", answerType: "text", text: "Formal", isVisible: true },
    { id: "q2", question: "Hidden?", answerType: "text", text: "secret answer", isVisible: false },
  ],
};

const INVITEE = {
  token: "secret-token-123", tokenUsed: false, weddingId: "w1",
  guestName: "Jane Q Smith", email: "jane@example.com", plusOneLimit: 2,
  dietaryRestrictions: "", group: "Family", emailStatus: "received", emailId: "smtp-1",
  childrenPolicyOverride: "inherit", rsvpStatus: "Pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.docs = { "invitee/i1": { ...INVITEE }, "invitations/w1": { ...INVITATION } };
  db.reads = [];
  story.loadAllStoryEntries.mockResolvedValue([]);
});

describe("toGuestInvitation — only what the invitation displays", () => {
  const guestInv = toGuestInvitation(INVITATION);

  it("drops owner and bookkeeping fields", () => {
    for (const key of ["userId", "isPublished", "createdAt", "mediaBytesUsed", "mediaPendingDeletes",
      "qaStartersCreated", "musicSpotifyUrl"]) {
      expect(guestInv).not.toHaveProperty(key);
    }
  });

  it("keeps first names only", () => {
    expect(guestInv.groomName).toEqual({ first: "Chris" });
    expect(guestInv.brideName).toEqual({ first: "Taylor" });
  });

  it("keeps what the invitation shows", () => {
    expect(guestInv).toMatchObject({
      weddingDate: "2027-05-22", ceremonyTime: "16:30", venueName: "Rose Hall",
      inviteDeadline: "2027-04-01", greetingMessage: "Hello", colorPalette1: "#123456",
      musicTrackId: "4uLU6hMCjMI75M1A2tKUQC", registryMessage: "Thanks!",
    });
    expect(guestInv.mealOptions).toHaveLength(1);
    expect(guestInv.travelItems).toHaveLength(1);
  });

  it("only visible registry links (public fields) and visible Q&A", () => {
    expect(guestInv.registries).toEqual([{ id: "r1", name: "Zola", url: "https://zola.com", isVisible: true }]);
    expect(guestInv.qaItems.map(q => q.id)).toEqual(["q1"]);
    expect(JSON.stringify(guestInv)).not.toContain("secret answer");
  });

  it("wedding party: public fields only — private phone/email never included", () => {
    const json = JSON.stringify(guestInv.partyMembers);
    expect(json).toContain("Ana");
    expect(json).not.toContain("555-0100");
    expect(json).not.toContain("ana@private.example");
  });

  it("sections the couple switched off are not sent at all", () => {
    const off = toGuestInvitation({
      ...INVITATION, musicShowOnInvitation: false, travelShowOnInvitation: false,
      partyShowOnInvitation: false, registryShowOnInvitation: false, qaShowOnInvitation: false,
    });
    expect(off.musicTrackId).toBe("");
    expect(off.travelItems).toEqual([]);
    expect(off.partyMembers).toEqual([]);
    expect(off.registries).toEqual([]);
    expect(off.registryMessage).toBe("");
    expect(off.qaItems).toEqual([]);
  });
});

describe("toGuestDetails — the guest's own details", () => {
  it("never includes the token or host-only fields", () => {
    const g = toGuestDetails(INVITEE);
    expect(g).toEqual({
      firstName: "Jane", lastName: "Q Smith", email: "jane@example.com", plusOneLimit: 2,
      responded: false, rsvpStatus: "", respondedAt: "",
    });
    expect(JSON.stringify(g)).not.toContain("secret-token-123");
  });

  it("reports a previous response", () => {
    const g = toGuestDetails({
      ...INVITEE, tokenUsed: true, rsvpStatus: "Accepted",
      respondedAt: { toDate: () => new Date("2026-10-01T15:00:00Z") },
    });
    expect(g).toMatchObject({ responded: true, rsvpStatus: "Accepted", respondedAt: "2026-10-01T15:00:00.000Z" });
  });
});

describe("fetchGuestInvitation", () => {
  it("returns the guest-safe invitation for a valid link", async () => {
    const result = await fetchGuestInvitation("i1", "secret-token-123");
    expect(result.status).toBe("ok");
    expect(result.guest.firstName).toBe("Jane");
    expect(result.view.invitation.groomName).toEqual({ first: "Chris" });
    expect(result.view.registries).toHaveLength(1);
    // nothing private anywhere in what the page receives
    const json = JSON.stringify(result);
    for (const secret of ["secret-token-123", "owner-uid", "Secret list", "secret answer", "555-0100", "smtp-1"]) {
      expect(json).not.toContain(secret);
    }
  });

  it.each([
    ["an unknown guest", "nobody", "secret-token-123"],
    ["a wrong token", "i1", "wrong-token"],
    ["a missing token", "i1", ""],
  ])("returns nothing for %s — and never reads the invitation", async (_label, id, token) => {
    expect(await fetchGuestInvitation(id, token)).toEqual({ status: "invalid" });
    expect(db.reads).not.toContain("invitations/w1");
    expect(story.loadAllStoryEntries).not.toHaveBeenCalled();
  });

  it("returns nothing when the wedding no longer exists", async () => {
    delete db.docs["invitations/w1"];
    expect(await fetchGuestInvitation("i1", "secret-token-123")).toEqual({ status: "invalid" });
  });

  it("loads Our Story only when the couple shows it", async () => {
    db.docs["invitations/w1"] = { ...INVITATION, storyShowOnInvitation: false };
    await fetchGuestInvitation("i1", "secret-token-123");
    expect(story.loadAllStoryEntries).not.toHaveBeenCalled();
  });

  it("still shows the invitation when guests can't read Our Story (e.g. unpublished)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    story.loadAllStoryEntries.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const result = await fetchGuestInvitation("i1", "secret-token-123");
    expect(result.status).toBe("ok");
    expect(result.view.storyBlocks).toEqual([]);
  });
});

describe("submitGuestRsvp", () => {
  it("uses the existing single-use submitRSVP (token behavior unchanged)", async () => {
    const response = { attending: false, guestName: "Jane Smith", email: "jane@example.com" };
    await submitGuestRsvp({ inviteeId: "i1", token: "secret-token-123", response });
    expect(fsHelpers.submitRSVP).toHaveBeenCalledWith("secret-token-123", response);
  });
});
