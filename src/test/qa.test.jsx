// Unit tests for Q&A: the pure rules in src/lib/qa.js and the transaction
// helpers in src/lib/firestore.js (run against a fake Firestore transaction —
// no emulator, no real Firebase).
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fake Firestore: one invitation document held in memory ───────────────────
const store = vi.hoisted(() => ({ doc: null, writes: [] }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((db, ...path) => ({ path: path.join("/") })),
  runTransaction: vi.fn(async (db, fn) => fn({
    get: async () => ({ exists: () => store.doc !== null, data: () => store.doc }),
    update: (ref, fields) => { store.writes.push(fields); store.doc = { ...store.doc, ...fields }; },
  })),
  getDoc: vi.fn(), setDoc: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), getDocs: vi.fn(),
  updateDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
}));

import {
  initQaStarters, addQaItem, updateQaItem, deleteQaItem, moveQaItem,
} from "@/lib/firestore";
import {
  STARTER_QUESTIONS, buildStarterItems, createQaItem, normalizeQaItems, cleanQaInput,
  validateQaInput, getAutoAnswer, resolveQaAnswer, getGuestQaItems, isQaSectionShown,
  describeQaStatus, moveQaItemInList, QA_MAX_ITEMS, QA_QUESTION_MAX, QA_TEXT_MAX,
} from "@/lib/qa";

beforeEach(() => {
  store.doc = { userId: "u1", registries: [{ id: "r1" }], greetingTitle: "Hi" };
  store.writes = [];
});

const WEDDING = {
  weddingDate: "2027-05-22", ceremonyTime: "16:30",
  venueName: "The Adolphus", venueAddress: "1321 Commerce St",
};
const ALL = new Set(["date", "venue", "travel", "story", "party", "rsvp", "registry"]);
const ctx = (data = WEDDING, sections = ALL) => ({ data, availableSections: sections });

// ─────────────────────────────────────────────────────────────────────────────
describe("starter questions", () => {
  it("are the 7 approved questions — no plus-one, children or unsupported details", () => {
    expect(STARTER_QUESTIONS.map(s => s.question)).toEqual([
      "When is the wedding?",
      "What time does the ceremony start?",
      "Where is the wedding?",
      "Where should I stay?",
      "How do I RSVP?",
      "Do you have a wedding registry?",
      "Who is in the wedding party?",
    ]);
    const text = JSON.stringify(STARTER_QUESTIONS).toLowerCase();
    for (const word of ["plus", "child", "parking", "dress"]) expect(text).not.toContain(word);
  });

  it("start hidden until reviewed, with the right answer types", () => {
    const items = buildStarterItems();
    expect(items.every(i => i.isVisible === false)).toBe(true);
    expect(new Set(items.map(i => i.id)).size).toBe(7);
    expect(items.slice(0, 3).map(i => [i.answerType, i.autoSource]))
      .toEqual([["auto", "weddingDate"], ["auto", "ceremonyTime"], ["auto", "venue"]]);
    expect(items.slice(3).map(i => i.section)).toEqual(["travel", "rsvp", "registry", "party"]);
  });
});

describe("Firestore helpers", () => {
  it("initQaStarters creates the starters once and flags the invitation", async () => {
    const first = await initQaStarters("w1", buildStarterItems());
    expect(first.created).toBe(true);
    expect(store.doc.qaItems).toHaveLength(7);
    expect(store.doc.qaStartersCreated).toBe(true);

    const second = await initQaStarters("w1", buildStarterItems());
    expect(second.created).toBe(false);
    expect(store.doc.qaItems).toHaveLength(7);
    expect(store.writes).toHaveLength(1); // the second call wrote nothing
  });

  it("never restores deleted starters or overwrites edits", async () => {
    const { items } = await initQaStarters("w1", buildStarterItems());
    await deleteQaItem("w1", items[0].id);
    await updateQaItem("w1", items[1].id, { question: "Ceremony time?" });

    const again = await initQaStarters("w1", buildStarterItems());
    expect(again.created).toBe(false);
    expect(store.doc.qaItems).toHaveLength(6);
    expect(store.doc.qaItems[0].question).toBe("Ceremony time?");
  });

  it("only ever writes Q&A fields and leaves other invitation data alone", async () => {
    await initQaStarters("w1", buildStarterItems());
    await addQaItem("w1", createQaItem({ question: "Dress code?", text: "Cocktail" }));
    for (const w of store.writes) {
      expect(Object.keys(w).every(k => k === "qaItems" || k === "qaStartersCreated")).toBe(true);
    }
    expect(store.doc.registries).toEqual([{ id: "r1" }]);
    expect(store.doc.greetingTitle).toBe("Hi");
  });

  it("adds, updates (allowed fields only), moves and deletes", async () => {
    const a = createQaItem({ question: "A?", text: "a" });
    const b = createQaItem({ question: "B?", text: "b" });
    await addQaItem("w1", a);
    await addQaItem("w1", b);
    let items = await updateQaItem("w1", a.id, { text: "a2", starterKey: "hack", id: "x" });
    expect(items[0]).toMatchObject({ id: a.id, text: "a2", starterKey: null });

    items = await moveQaItem("w1", b.id, -1);
    expect(items.map(i => i.id)).toEqual([b.id, a.id]);
    items = await moveQaItem("w1", b.id, -1); // already first → unchanged
    expect(items.map(i => i.id)).toEqual([b.id, a.id]);

    items = await deleteQaItem("w1", b.id);
    expect(items.map(i => i.id)).toEqual([a.id]);
  });

  it(`refuses more than ${QA_MAX_ITEMS} questions`, async () => {
    store.doc.qaItems = Array.from({ length: QA_MAX_ITEMS }, (_, i) => createQaItem({ question: `Q${i}?` }));
    await expect(addQaItem("w1", createQaItem({ question: "One more?" }))).rejects.toThrow(/up to 50/);
  });

  it("fails cleanly when the invitation doesn't exist", async () => {
    store.doc = null;
    await expect(initQaStarters("nope", buildStarterItems())).rejects.toThrow(/not found/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("auto-filled answers", () => {
  it("derive from current invitation data (never stored)", () => {
    expect(getAutoAnswer("weddingDate", WEDDING)).toEqual({ status: "ready", text: "Saturday, May 22, 2027" });
    expect(getAutoAnswer("ceremonyTime", WEDDING)).toEqual({ status: "ready", text: "The ceremony starts at 4:30 PM." });
    expect(getAutoAnswer("venue", WEDDING)).toEqual({ status: "ready", text: "The Adolphus, 1321 Commerce St" });
    // Change the data → the answer changes
    expect(getAutoAnswer("weddingDate", { ...WEDDING, weddingDate: "2027-06-05" }).text).toBe("Saturday, June 5, 2027");
  });

  it("report missing information", () => {
    expect(getAutoAnswer("weddingDate", {}).status).toBe("missing");
    expect(getAutoAnswer("weddingDate", { weddingDate: "2027-02-30" }).status).toBe("missing");
    expect(getAutoAnswer("ceremonyTime", { ceremonyTime: "" }).status).toBe("missing");
    expect(getAutoAnswer("venue", {}).status).toBe("missing");
  });

  it("respect the Venue tab's hidden settings", () => {
    expect(getAutoAnswer("venue", { ...WEDDING, venueShowOnInvitation: false }).status).toBe("hidden");
    expect(getAutoAnswer("venue", { ...WEDDING, venueShowAddress: false }))
      .toEqual({ status: "ready", text: "The Adolphus" });
    expect(getAutoAnswer("venue", { venueAddress: "1321 Commerce St", venueShowAddress: false }).status).toBe("hidden");
  });

  it("show 'Information needed' in the builder", () => {
    const item = buildStarterItems()[0];
    const answer = resolveQaAnswer(item, ctx({}));
    expect(describeQaStatus(item, answer)).toMatch(/^Information needed/);
  });
});

describe("answers and guest visibility", () => {
  const text = createQaItem({ question: "Dress code?", text: "Cocktail attire", isVisible: true });
  const link = createQaItem({ question: "Where to stay?", answerType: "section", section: "travel", isVisible: true });
  const url = createQaItem({ question: "Parking?", answerType: "url", url: "https://www.example.com/park", isVisible: true });

  it("resolves each answer type", () => {
    expect(resolveQaAnswer(text, ctx())).toMatchObject({ status: "ready", kind: "text", text: "Cocktail attire" });
    expect(resolveQaAnswer(link, ctx())).toMatchObject({ status: "ready", kind: "section", section: "travel", sectionLabel: "Travel & Stay" });
    expect(resolveQaAnswer(url, ctx())).toMatchObject({ status: "ready", kind: "url", label: "example.com" });
  });

  it("treats incomplete answers and unsafe links as not ready", () => {
    expect(resolveQaAnswer({ ...text, text: "  " }, ctx()).status).toBe("incomplete");
    expect(resolveQaAnswer({ ...text, question: "" }, ctx()).status).toBe("incomplete");
    expect(resolveQaAnswer({ ...url, url: "javascript:alert(1)" }, ctx()).status).toBe("incomplete");
    expect(resolveQaAnswer({ ...link, section: null }, ctx()).status).toBe("incomplete");
  });

  it("hides links to sections that aren't shown (and shows them once they are)", () => {
    expect(resolveQaAnswer(link, ctx(WEDDING, new Set(["rsvp"]))).status).toBe("sectionUnavailable");
    expect(getGuestQaItems([link], ctx(WEDDING, new Set(["rsvp"])), true)).toEqual([]);
    // When that section becomes available, the same stored question shows — nothing recreated
    expect(getGuestQaItems([link], ctx(WEDDING, new Set(["rsvp", "travel"])), true)).toHaveLength(1);
  });

  it("only shows switched-on, ready questions — and nothing when the section is off", () => {
    const hidden = { ...text, id: "h", isVisible: false };
    const incomplete = createQaItem({ question: "Kids?", text: "", isVisible: true });
    const out = getGuestQaItems([text, hidden, incomplete, url], ctx(), true);
    expect(out.map(x => x.item.question)).toEqual(["Dress code?", "Parking?"]);
    expect(getGuestQaItems([text, url], ctx(), false)).toEqual([]);
  });

  it("Show Q&A defaults to OFF for new and existing invitations", () => {
    expect(isQaSectionShown({})).toBe(false);
    expect(isQaSectionShown(null)).toBe(false);
    expect(isQaSectionShown({ qaShowOnInvitation: false })).toBe(false);
    expect(isQaSectionShown({ qaShowOnInvitation: true })).toBe(true);
  });
});

describe("editing rules", () => {
  it("validates per answer type", () => {
    expect(validateQaInput({ question: "", answerType: "text", text: "x" })).toHaveProperty("question");
    expect(validateQaInput({ question: "Q?", answerType: "text", text: "" })).toHaveProperty("text");
    expect(validateQaInput({ question: "Q?", answerType: "section", section: "" })).toHaveProperty("section");
    expect(validateQaInput({ question: "Q?", answerType: "url", url: "ftp://x" })).toHaveProperty("url");
    expect(validateQaInput({ question: "Q?", answerType: "auto" })).toEqual({});
  });

  it("trims, enforces limits, and keeps other types' fields when switching", () => {
    const clean = cleanQaInput({
      question: ` ${"q".repeat(QA_QUESTION_MAX + 20)} `, answerType: "section", section: "rsvp",
      text: "x".repeat(QA_TEXT_MAX + 5), url: "https://a.com", isVisible: true,
    });
    expect(clean.question).toHaveLength(QA_QUESTION_MAX);
    expect(clean.text).toHaveLength(QA_TEXT_MAX);
    expect(clean).toMatchObject({ answerType: "section", section: "rsvp", url: "https://a.com", isVisible: true });
  });

  it("only allows auto-fill for questions with a data source", () => {
    expect(cleanQaInput({ question: "Q?", answerType: "auto" }).answerType).toBe("text");
    expect(cleanQaInput({ question: "Q?", answerType: "auto" }, { autoSource: "venue" }).answerType).toBe("auto");
    expect(normalizeQaItems([{ id: "a", question: "Q?", answerType: "auto" }])[0].answerType).toBe("text");
  });

  it("moves items locally the same way as the Firestore helper", () => {
    const [a, b, c] = ["a", "b", "c"].map(id => ({ id }));
    expect(moveQaItemInList([a, b, c], "c", -1).map(i => i.id)).toEqual(["a", "c", "b"]);
    expect(moveQaItemInList([a, b, c], "a", -1)).toEqual([a, b, c]);
  });

  it("normalizes stored garbage safely", () => {
    const [x] = normalizeQaItems([{ id: "../evil", question: 5, answerType: "nope", section: "x", isVisible: "yes" }]);
    expect(x.id).not.toBe("../evil");
    expect(x).toMatchObject({ question: "", answerType: "text", section: null, isVisible: false });
    expect(normalizeQaItems("nope")).toEqual([]);
  });
});
