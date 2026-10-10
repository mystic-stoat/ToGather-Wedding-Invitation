// Component tests for the Invitation Builder's Q&A tab, its phone preview,
// and the guest RSVP page. Firestore is replaced by an in-memory "server"
// invitation document so refresh/persistence behave like the real app.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const server = vi.hoisted(() => ({ doc: null }));
const clone = (v) => JSON.parse(JSON.stringify(v));

const fs = vi.hoisted(() => {
  const S = () => server.doc;
  const items = () => (Array.isArray(S().qaItems) ? S().qaItems : []);
  const copy = (v) => JSON.parse(JSON.stringify(v));
  return {
    getInvitationByUser: vi.fn(async () => (S() ? copy(S()) : null)),
    saveInvitation: vi.fn(async (uid, data, id) => { Object.assign(S(), copy(data)); return id || "w1"; }),
    addRegistry: vi.fn(), updateRegistry: vi.fn(), deleteRegistry: vi.fn(),
    submitRSVP: vi.fn(),
    initQaStarters: vi.fn(async (w, starters) => {
      if (S().qaStartersCreated === true) return { created: false, items: copy(items()) };
      S().qaItems = [...starters, ...items()];
      S().qaStartersCreated = true;
      return { created: true, items: copy(S().qaItems) };
    }),
    addQaItem: vi.fn(async (w, item) => { S().qaItems = [...items(), item]; return copy(S().qaItems); }),
    updateQaItem: vi.fn(async (w, id, u) => {
      S().qaItems = items().map(i => (i.id === id ? { ...i, ...u } : i));
      return copy(S().qaItems);
    }),
    deleteQaItem: vi.fn(async (w, id) => { S().qaItems = items().filter(i => i.id !== id); return copy(S().qaItems); }),
    moveQaItem: vi.fn(async (w, id, d) => {
      const list = [...items()];
      const from = list.findIndex(i => i.id === id);
      const to = from + d;
      if (from > -1 && to >= 0 && to < list.length) [list[from], list[to]] = [list[to], list[from]];
      S().qaItems = list;
      return copy(list);
    }),
  };
});
vi.mock("@/lib/firestore", () => fs);

vi.mock("firebase/firestore", () => ({ doc: vi.fn(() => ({})), getDoc: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ db: {}, storage: {} }));
vi.mock("@/lib/storyStore", () => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
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
import RSVP from "@/pages/RSVP";
import { getDoc } from "firebase/firestore";
import { createQaItem } from "@/lib/qa";

const WEDDING = {
  weddingId: "w1", userId: "u1",
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", ceremonyTime: "16:30",
  venueName: "The Adolphus", venueAddress: "1321 Commerce St",
};

const renderBuilder = (path = "/create-invitation?section=qa") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);

const main = () => screen.getByRole("main");
const preview = () => screen.getByTestId("invitation-preview");
const previewQa = () => within(preview()).queryByTestId("qa-section");
const rows = () => screen.queryAllByTestId("qa-question-row");
const rowFor = (q) => rows().find(r => within(r).queryByText(q));
const openTab = async () => {
  await screen.findByRole("main");
  return screen.findByTestId("qa-immediate-save-notice");
};
const sectionSwitch = () => screen.getByRole("switch", { name: "Show Q&A on Invitation" });
const questionSwitch = (q) => screen.getByRole("switch", { name: `Show "${q}" to guests` });
const addQuestion = async ({ question, type = "Custom text", text, url, section }) => {
  fireEvent.click(within(main()).getByRole("button", { name: /add question/i }));
  const dialog = await screen.findByRole("dialog", { name: "Add Question" });
  fireEvent.change(within(dialog).getByLabelText(/^Question/), { target: { value: question } });
  fireEvent.click(within(dialog).getByRole("radio", { name: type }));
  if (text !== undefined) fireEvent.change(within(dialog).getByLabelText("Answer *"), { target: { value: text } });
  if (url !== undefined) fireEvent.change(within(dialog).getByLabelText(/^Website/), { target: { value: url } });
  if (section !== undefined) fireEvent.change(within(dialog).getByLabelText(/^Section/), { target: { value: section } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Question" }));
};
const expandInPreview = (q) => fireEvent.click(within(previewQa()).getByRole("button", { name: q }));

beforeEach(() => {
  vi.clearAllMocks();
  server.doc = clone(WEDDING);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Q&A tab — starter questions", () => {
  it("are not created until the Q&A tab is opened", async () => {
    renderBuilder("/create-invitation");
    await screen.findByText("Invitation Title");
    expect(fs.initQaStarters).not.toHaveBeenCalled();
    expect(server.doc.qaItems).toBeUndefined();
  });

  it("are created once, hidden, the first time the tab is opened", async () => {
    renderBuilder();
    await openTab();
    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(fs.initQaStarters).toHaveBeenCalledTimes(1);
    expect(fs.initQaStarters.mock.calls[0][1].every(i => i.isVisible === false)).toBe(true);
    expect(server.doc.qaStartersCreated).toBe(true);
    // All starters are "suggested", none shown to guests
    expect(within(rowFor("Where should I stay?")).getByTestId("qa-status").textContent)
      .not.toMatch(/Shown to guests/);
    expect(questionSwitch("When is the wedding?")).toHaveAttribute("aria-checked", "false");

    // Leaving and re-opening the tab doesn't create them again
    fireEvent.click(screen.getByRole("button", { name: /Greetings/ }));
    fireEvent.click(screen.getByRole("button", { name: /Q&A/ }));
    await openTab();
    expect(fs.initQaStarters).toHaveBeenCalledTimes(1);
  });

  it("deleted starters never come back after a refresh", async () => {
    const first = renderBuilder();
    await openTab();
    await waitFor(() => expect(rows()).toHaveLength(7));
    fireEvent.click(screen.getByRole("button", { name: 'Delete "Where should I stay?"' }));
    expect(screen.getByText(/won't be suggested again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(rows()).toHaveLength(6));
    first.unmount();

    renderBuilder(); // "refresh"
    await openTab();
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(rowFor("Where should I stay?")).toBeUndefined();
    expect(fs.initQaStarters).toHaveBeenCalledTimes(1); // the flag stops a second run
  });

  it("show auto-filled answers from Wedding Details, or 'Information needed'", async () => {
    server.doc = { weddingId: "w1", userId: "u1", weddingDate: "2027-05-22" }; // no time, no venue
    renderBuilder();
    await openTab();
    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(within(rowFor("When is the wedding?")).getByTestId("qa-answer-preview"))
      .toHaveTextContent("Saturday, May 22, 2027");
    expect(within(rowFor("What time does the ceremony start?")).getByTestId("qa-status"))
      .toHaveTextContent(/^Information needed/);
    expect(within(rowFor("Where is the wedding?")).getByTestId("qa-status"))
      .toHaveTextContent(/^Information needed/);
  });

  it("asks for wedding details first when there's no invitation yet", async () => {
    server.doc = null;
    renderBuilder();
    expect(await screen.findByText(/your suggested questions will appear here/)).toBeInTheDocument();
    expect(fs.initQaStarters).not.toHaveBeenCalled();
    expect(sectionSwitch()).toBeDisabled();
    expect(within(main()).getByRole("button", { name: /add question/i })).toBeDisabled();
  });
});

describe("Q&A — visibility", () => {
  it("'Show Q&A on Invitation' is OFF by default and hides everything", async () => {
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [createQaItem({ question: "Dress code?", text: "Cocktail", isVisible: true })];
    renderBuilder();
    await openTab();
    expect(sectionSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("qa-hidden-notice")).toHaveTextContent(/questions are kept/);
    expect(previewQa()).toBeNull();
  });

  it("turning it on saves immediately and shows ready questions", async () => {
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [createQaItem({ question: "Dress code?", text: "Cocktail", isVisible: true })];
    renderBuilder();
    await openTab();

    fireEvent.click(sectionSwitch());
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalledWith("u1", { qaShowOnInvitation: true }, "w1"));
    expect(within(previewQa()).getByText("Questions & Answers")).toBeInTheDocument();
    expect(within(previewQa()).getByRole("button", { name: "Dress code?" })).toBeInTheDocument();
    expect(server.doc.qaItems).toHaveLength(1); // nothing deleted or rewritten
  });

  it("individual switches publish a reviewed starter; hidden ones stay out of the preview", async () => {
    server.doc.qaShowOnInvitation = true;
    renderBuilder();
    await openTab();
    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(previewQa()).toBeNull(); // all starters hidden

    fireEvent.click(questionSwitch("When is the wedding?"));
    await waitFor(() => expect(fs.updateQaItem).toHaveBeenCalledWith("w1", expect.any(String), { isVisible: true }));
    const qa = await waitFor(() => { const s = previewQa(); expect(s).not.toBeNull(); return s; });
    expect(within(qa).getAllByTestId("qa-guest-item")).toHaveLength(1);
    expandInPreview("When is the wedding?");
    expect(within(previewQa()).getByText("Saturday, May 22, 2027")).toBeVisible();

    fireEvent.click(questionSwitch("When is the wedding?"));
    await waitFor(() => expect(previewQa()).toBeNull());
  });

  it("auto-filled answers follow live changes (Venue tab hides the address)", async () => {
    server.doc.qaShowOnInvitation = true;
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [createQaItem({ question: "Where is the wedding?", answerType: "auto", autoSource: "venue", isVisible: true })];
    renderBuilder();
    await openTab();
    expandInPreview("Where is the wedding?");
    expect(within(previewQa()).getByText("The Adolphus, 1321 Commerce St")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Venue$/ }));
    fireEvent.click(await screen.findByRole("switch", { name: "Show Address" }));
    expect(within(previewQa()).getByText("The Adolphus")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Show Venue Section" }));
    expect(previewQa()).toBeNull(); // the only question no longer has an answer to show
  });

  it("links to hidden or empty sections are not shown, and say why in the builder", async () => {
    server.doc.qaShowOnInvitation = true;
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [
      createQaItem({ question: "Where should I stay?", answerType: "section", section: "travel", isVisible: true }),
      createQaItem({ question: "How do I RSVP?", answerType: "section", section: "rsvp", isVisible: true }),
    ];
    renderBuilder();
    await openTab();
    expect(within(rowFor("Where should I stay?")).getByTestId("qa-status"))
      .toHaveTextContent(/Travel & Stay section is hidden or empty/);
    const items = within(previewQa()).getAllByTestId("qa-guest-item");
    expect(items.map(i => i.textContent)).toEqual([expect.stringContaining("How do I RSVP?")]);
  });
});

describe("Q&A — custom questions", () => {
  beforeEach(() => {
    server.doc.qaShowOnInvitation = true;
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [];
  });

  it("validates before saving", async () => {
    renderBuilder();
    await openTab();
    fireEvent.click(within(main()).getByRole("button", { name: /add question/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add Question" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Question" }));
    expect(await within(dialog).findByText("Enter a question.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter an answer.")).toBeInTheDocument();
    expect(fs.addQaItem).not.toHaveBeenCalled();
    // Custom questions can't pick auto-fill
    expect(within(dialog).queryByRole("radio", { name: "Auto-fill" })).toBeNull();
  });

  it("adds a text question that appears in the preview immediately", async () => {
    renderBuilder();
    await openTab();
    await addQuestion({ question: "What's the dress code?", text: "Cocktail attire." });
    await waitFor(() => expect(fs.addQaItem).toHaveBeenCalled());
    expect(fs.addQaItem.mock.calls[0][1]).toMatchObject({
      question: "What's the dress code?", answerType: "text", text: "Cocktail attire.", isVisible: true, starterKey: null,
    });
    expect(await screen.findByText("Cocktail attire.", { selector: '[data-testid="qa-answer-preview"]' })).toBeInTheDocument();
    expandInPreview("What's the dress code?");
    expect(within(previewQa()).getByText("Cocktail attire.")).toBeVisible();
  });

  it("edits a question and switches its answer type to an external link", async () => {
    server.doc.qaItems = [createQaItem({ question: "Is parking available?", text: "Yes.", isVisible: true })];
    renderBuilder();
    await openTab();
    fireEvent.click(screen.getByRole("button", { name: 'Edit "Is parking available?"' }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Question" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "External link" }));
    fireEvent.change(within(dialog).getByLabelText(/^Website/), { target: { value: "https://park.example.com/map" } });
    fireEvent.change(within(dialog).getByLabelText(/^Link text/), { target: { value: "Parking map" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(fs.updateQaItem).toHaveBeenCalled());
    expect(fs.updateQaItem.mock.calls[0][2]).toMatchObject({
      answerType: "url", url: "https://park.example.com/map", linkLabel: "Parking map", text: "Yes.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expandInPreview("Is parking available?");
    const link = within(previewQa()).getByRole("link", { name: /Parking map/ });
    expect(link).toHaveAttribute("href", "https://park.example.com/map");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("section links scroll the preview, never open the builder", async () => {
    const scrollTo = vi.fn();
    document.defaultView.Element.prototype.scrollTo = scrollTo;
    server.doc.qaItems = [createQaItem({ question: "How do I RSVP?", answerType: "section", section: "rsvp", note: "Use the form.", isVisible: true })];
    renderBuilder();
    await openTab();
    expandInPreview("How do I RSVP?");
    expect(within(previewQa()).getByText("Use the form.")).toBeInTheDocument();
    fireEvent.click(within(previewQa()).getByRole("button", { name: /View RSVP/ }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(screen.getByTestId("qa-immediate-save-notice")).toBeInTheDocument(); // still on the Q&A tab
    delete document.defaultView.Element.prototype.scrollTo;
  });

  it("reorders with Move Up / Move Down, in the list and the preview", async () => {
    server.doc.qaItems = [
      createQaItem({ question: "First?", text: "1" , isVisible: true }),
      createQaItem({ question: "Second?", text: "2", isVisible: true }),
    ];
    renderBuilder();
    await openTab();
    expect(screen.getByRole("button", { name: 'Move "First?" up' })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: 'Move "Second?" up' }));
    await waitFor(() => expect(fs.moveQaItem).toHaveBeenCalledWith("w1", expect.any(String), -1));
    await waitFor(() => {
      expect(within(previewQa()).getAllByTestId("qa-guest-item").map(i => i.textContent))
        .toEqual([expect.stringContaining("Second?"), expect.stringContaining("First?")]);
    });
    expect(rows().map(r => within(r).getAllByText(/\?$/)[0].textContent)).toEqual(["Second?", "First?"]);
  });

  it("deletes after confirmation", async () => {
    server.doc.qaItems = [createQaItem({ question: "Kids welcome?", text: "Yes", isVisible: true })];
    renderBuilder();
    await openTab();
    fireEvent.click(screen.getByRole("button", { name: 'Delete "Kids welcome?"' }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fs.deleteQaItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: 'Delete "Kids welcome?"' }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(rows()).toHaveLength(0));
    expect(previewQa()).toBeNull();
  });

  it("persists after a refresh", async () => {
    const first = renderBuilder();
    await openTab();
    await addQuestion({ question: "Can guests take pictures?", text: "Unplugged ceremony, please." });
    await waitFor(() => expect(rows()).toHaveLength(1));
    first.unmount();

    renderBuilder();
    await openTab();
    expect(await screen.findByText("Can guests take pictures?", { selector: "p" })).toBeInTheDocument();
    expect(sectionSwitch()).toHaveAttribute("aria-checked", "true");
  });
});

describe("Q&A — builder main Save compatibility", () => {
  it("Save and Publish never write Q&A fields", async () => {
    server.doc.qaShowOnInvitation = true;
    server.doc.qaStartersCreated = true;
    server.doc.qaItems = [createQaItem({ question: "Dress code?", text: "Cocktail", isVisible: true })];
    renderBuilder();
    await openTab();

    fireEvent.click(screen.getAllByText(/^Save$/)[0]);
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/^Publish$/));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalledTimes(2));
    for (const [, data] of fs.saveInvitation.mock.calls) {
      expect(data).not.toHaveProperty("qaItems");
      expect(data).not.toHaveProperty("qaShowOnInvitation");
      expect(data).not.toHaveProperty("qaStartersCreated");
    }
    expect(server.doc.qaItems).toHaveLength(1);
  });
});

// ── Guest RSVP page ──────────────────────────────────────────────────────────
describe("Q&A on the guest RSVP page", () => {
  const renderRSVP = (inv) => {
    getDoc
      .mockResolvedValueOnce({
        exists: () => true, id: "invitee-1",
        data: () => ({ token: "tok", tokenUsed: false, weddingId: "w1", plusOneLimit: 2 }),
      })
      .mockResolvedValueOnce({ exists: () => true, id: "w1", data: () => inv });
    return render(
      <MemoryRouter initialEntries={["/rsvp/invitee-1/tok"]}>
        <Routes><Route path="/rsvp/:inviteeId/:token" element={<RSVP />} /></Routes>
      </MemoryRouter>
    );
  };
  const guestInvitation = (extra = {}) => ({
    ...WEDDING,
    registryMessage: "Thank you!",
    registries: [{ id: "r1", name: "Zola", url: "https://zola.com/r/us", isVisible: true }],
    qaItems: [
      createQaItem({ question: "When is the wedding?", answerType: "auto", autoSource: "weddingDate", isVisible: true, starterKey: "when" }),
      createQaItem({ question: "Where should I stay?", answerType: "section", section: "travel", isVisible: true, starterKey: "stay" }),
      createQaItem({ question: "Do you have a wedding registry?", answerType: "section", section: "registry", isVisible: true }),
      createQaItem({ question: "How do I RSVP?", answerType: "section", section: "rsvp", isVisible: true }),
      createQaItem({ question: "Secret?", text: "hidden", isVisible: false }),
      createQaItem({ question: "Unanswered?", text: "", isVisible: true }),
    ],
    ...extra,
  });

  afterEach(() => { delete document.defaultView.Element.prototype.scrollIntoView; });

  it("shows nothing while Show Q&A is off (the default)", async () => {
    renderRSVP(guestInvitation());
    await screen.findByRole("button", { name: /joyfully accepts/i });
    expect(screen.queryByText("Questions & Answers")).toBeNull();
  });

  it("shows only visible, complete questions whose linked section is on this page", async () => {
    renderRSVP(guestInvitation({ qaShowOnInvitation: true }));
    const section = await screen.findByTestId("qa-section");
    const questions = within(section).getAllByTestId("qa-guest-item").map(i => i.querySelector("button").textContent);
    expect(questions).toEqual(["When is the wedding?", "Do you have a wedding registry?", "How do I RSVP?"]);
    // Travel & Stay isn't on the guest page yet → no broken link
    expect(within(section).queryByText("Where should I stay?")).toBeNull();
    expect(within(section).queryByText("Secret?")).toBeNull();
    expect(within(section).queryByText("Unanswered?")).toBeNull();
    // No plus-one or other guest-specific answers
    expect(section.textContent).not.toMatch(/plus|guest allowance/i);
  });

  it("hides the registry link when the Registry section is off", async () => {
    renderRSVP(guestInvitation({ qaShowOnInvitation: true, registryShowOnInvitation: false }));
    const section = await screen.findByTestId("qa-section");
    expect(within(section).queryByText("Do you have a wedding registry?")).toBeNull();
  });

  it("section links scroll to that section on the page", async () => {
    const scrollIntoView = vi.fn();
    document.defaultView.Element.prototype.scrollIntoView = scrollIntoView;
    renderRSVP(guestInvitation({ qaShowOnInvitation: true }));
    const section = await screen.findByTestId("qa-section");
    fireEvent.click(within(section).getByRole("button", { name: "How do I RSVP?" }));
    fireEvent.click(within(section).getByRole("button", { name: /View RSVP/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0].id).toBe("tg-section-rsvp");
  });

  it("answers expand and collapse", async () => {
    renderRSVP(guestInvitation({ qaShowOnInvitation: true }));
    const section = await screen.findByTestId("qa-section");
    const q = within(section).getByRole("button", { name: "When is the wedding?" });
    expect(q).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(q);
    expect(q).toHaveAttribute("aria-expanded", "true");
    expect(within(section).getByText("Saturday, May 22, 2027")).toBeVisible();
    fireEvent.click(q);
    expect(q).toHaveAttribute("aria-expanded", "false");
  });
});
