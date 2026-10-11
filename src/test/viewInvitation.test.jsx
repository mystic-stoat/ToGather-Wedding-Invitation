// Invitation Builder — "View Invitation" (Phase 3; replaces Publish).
//   - opens /invitation/preview (last SAVED invitation) in ONE named tab
//   - unsaved changes → dialog: Save and View / View Last Saved / Cancel
//   - Save and View shows the preview only if EVERYTHING saved; a tab opened
//     for it is closed on any failure
//   - repeated clicks never save twice or open several tabs
//   - viewing/saving never writes isPublished, so the guest email trigger
//     (functions/index.js sendInvitesOnPublish: isPublished false → true)
//     can never fire from the builder
// Firestore / auth / storage are mocked — no emulator needed. window.open is
// replaced by a fake that records the tabs it "opens".
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(),
  publishInvitation: vi.fn(),
  addRegistry: vi.fn(), updateRegistry: vi.fn(), deleteRegistry: vi.fn(),
}));
vi.mock("@/lib/firestore", () => fs);
const story = vi.hoisted(() => ({
  loadAllStoryEntries: vi.fn(),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/storyStore", () => story);
vi.mock("@/lib/weddingPartyStore", () => ({
  loadPartyContacts: vi.fn(async () => ({})), savePartyContacts: vi.fn(async () => {}),
}));
vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn(), buildStoryPath: vi.fn(), buildPartyPath: vi.fn(),
}));
// One stable auth object (a new `user` each render would re-run the builder's load)
const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
}));

import CreateInvitation from "@/pages/CreateInvitation";
import { PREVIEW_PATH, PREVIEW_WINDOW_NAME } from "@/hooks/useViewInvitation";

const SAVED = {
  weddingId: "w1", userId: "u1", isPublished: false,
  groomName: { first: "Chris" }, brideName: { first: "Taylor" },
  weddingDate: "2027-05-22", greetingTitle: "Together with their families",
};

// ── Fake browser tabs ─────────────────────────────────────────────────────────
let tabs;
const makeTab = (url) => {
  const tab = {
    closed: false,
    location: { href: url || "about:blank", replace: vi.fn(u => { tab.location.href = u; }) },
    document: { title: "", body: { innerHTML: "" } },
    focus: vi.fn(),
    close: vi.fn(() => { tab.closed = true; }),
  };
  return tab;
};
const allowTabs = () => vi.spyOn(window, "open").mockImplementation((url) => {
  const tab = makeTab(url);
  tabs.push(tab);
  return tab;
});
const blockTabs = () => vi.spyOn(window, "open").mockReturnValue(null);

// ── Builder helpers ───────────────────────────────────────────────────────────
const renderBuilder = (path = "/create-invitation") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);
const ready = () => screen.findByText("Invitation Title");
const viewButton = () => screen.getByRole("button", { name: "View Invitation" });
const titleInput = () => screen.getByPlaceholderText("Together with their families...");
const editTitle = (value = "Join us") => fireEvent.change(titleInput(), { target: { value } });
const dialog = () => screen.queryByRole("alertdialog");
const openDialog = async () => {
  fireEvent.click(viewButton());
  return screen.findByRole("alertdialog");
};
const nav = () => screen.getByRole("navigation", { name: "Invitation sections" });
const openTab = (name) => fireEvent.click(within(nav()).getByRole("button", { name }));

// The guest email Cloud Function fires only on this transition (functions/index.js)
const wouldSendEmails = (before, written) =>
  !before.isPublished && Boolean({ ...before, ...written }.isPublished);

let alertSpy;
beforeEach(() => {
  vi.clearAllMocks();
  tabs = [];
  fs.getInvitationByUser.mockResolvedValue({ ...SAVED });
  fs.saveInvitation.mockResolvedValue("w1");
  story.loadAllStoryEntries.mockResolvedValue([]);
  alertSpy = vi.fn();
  vi.stubGlobal("alert", alertSpy); // same pattern as the other builder tests
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.name = "";
});

describe("View Invitation button", () => {
  it("replaces the Publish button, in the same builder button style", async () => {
    renderBuilder();
    await ready();
    expect(screen.queryByRole("button", { name: /Publish/ })).toBeNull();
    // Same classes as the former Publish button (jsdom can't read gradients)
    expect(viewButton()).toHaveClass("rounded-lg", "text-white", "shadow-sm", "font-semibold");
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeTruthy();
  });

  it("with nothing unsaved, opens /invitation/preview in a new tab and saves nothing", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    fireEvent.click(viewButton());
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(PREVIEW_PATH, PREVIEW_WINDOW_NAME);
    expect(PREVIEW_PATH).toBe("/invitation/preview");
    expect(dialog()).toBeNull();
    expect(fs.saveInvitation).not.toHaveBeenCalled();
  });

  it("repeated clicks reuse the same preview tab (one named window, no saves)", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    fireEvent.click(viewButton());
    fireEvent.click(viewButton());
    fireEvent.click(viewButton());
    const names = window.open.mock.calls.map(c => c[1]);
    expect(new Set(names)).toEqual(new Set([PREVIEW_WINDOW_NAME]));
    expect(fs.saveInvitation).not.toHaveBeenCalled();
  });

  it("is disabled until there is a saved invitation or something to save", async () => {
    fs.getInvitationByUser.mockResolvedValue(null);
    allowTabs();
    renderBuilder();
    await ready();
    expect(viewButton()).toBeDisabled();
    editTitle();
    expect(viewButton()).toBeEnabled();
    const d = await openDialog();
    // nothing saved yet → no "last saved" version to view
    expect(within(d).queryByRole("button", { name: "View Last Saved" })).toBeNull();
    expect(within(d).getByRole("button", { name: "Save and View" })).toBeTruthy();
  });

  it("shows a link when the browser blocks the new tab", async () => {
    blockTabs();
    renderBuilder();
    await ready();
    fireEvent.click(viewButton());
    const link = await screen.findByRole("link", { name: "Open your invitation preview" });
    expect(link).toHaveAttribute("href", PREVIEW_PATH);
    expect(link).toHaveAttribute("target", PREVIEW_WINDOW_NAME);
  });
});

describe("unsaved-change detection", () => {
  it("asks first when a setting was changed", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle();
    const d = await openDialog();
    expect(within(d).getByText("You have unsaved changes")).toBeTruthy();
    for (const name of ["Save and View", "View Last Saved", "Cancel"]) {
      expect(within(d).getByRole("button", { name })).toBeTruthy();
    }
    expect(window.open).not.toHaveBeenCalled();
  });

  it("an edit that was undone is not an unsaved change", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle("Join us");
    editTitle("Together with their families");
    fireEvent.click(viewButton());
    expect(dialog()).toBeNull();
    expect(window.open).toHaveBeenCalledWith(PREVIEW_PATH, PREVIEW_WINDOW_NAME);
  });

  it("a blank meal option (dropped by Save) is not an unsaved change", async () => {
    allowTabs();
    renderBuilder("/create-invitation?section=rsvp");
    await screen.findByLabelText("RSVP deadline");
    fireEvent.click(screen.getByRole("button", { name: /Add meal option/ }));
    fireEvent.click(viewButton());
    expect(dialog()).toBeNull();
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it("an unsaved Registry message counts, and the dialog says Save and View saves it", async () => {
    allowTabs();
    renderBuilder("/create-invitation?section=registry");
    fireEvent.change(await screen.findByLabelText("Registry message"), { target: { value: "Thank you!" } });
    const d = await openDialog();
    expect(d).toHaveTextContent("Save and View also saves your Registry message");
  });

  it("after a successful Save there is nothing unsaved again", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalledTimes(1));
    await screen.findAllByText(/Saved ✓/);
    fireEvent.click(viewButton());
    expect(dialog()).toBeNull();
    expect(window.open).toHaveBeenCalledWith(PREVIEW_PATH, PREVIEW_WINDOW_NAME);
  });
});

describe("dialog choices", () => {
  it("Cancel closes the dialog: nothing saved, nothing opened, edits kept", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle();
    const d = await openDialog();
    fireEvent.click(within(d).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(window.open).not.toHaveBeenCalled();
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(titleInput()).toHaveValue("Join us");
  });

  it("View Last Saved opens the preview without saving; edits stay unsaved", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle();
    const d = await openDialog();
    fireEvent.click(within(d).getByRole("button", { name: "View Last Saved" }));
    expect(window.open).toHaveBeenCalledWith(PREVIEW_PATH, PREVIEW_WINDOW_NAME);
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(titleInput()).toHaveValue("Join us");
    // still unsaved → asks again next time
    expect(await openDialog()).toBeTruthy();
  });
});

describe("Save and View", () => {
  it("saves, then shows the preview in the tab it opened during the click", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    editTitle();
    const d = await openDialog();
    fireEvent.click(within(d).getByRole("button", { name: "Save and View" }));

    // The tab is reserved immediately (popup blockers) and says it's saving
    expect(window.open).toHaveBeenCalledWith("", PREVIEW_WINDOW_NAME);
    expect(tabs[0].document.body.innerHTML).toContain("Saving your invitation");

    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalledWith(PREVIEW_PATH));
    expect(fs.saveInvitation).toHaveBeenCalledTimes(1);
    expect(fs.saveInvitation.mock.calls[0][1]).toMatchObject({ greetingTitle: "Join us" });
    expect(tabs[0].close).not.toHaveBeenCalled();
    // Everything is saved now
    await waitFor(() => expect(viewButton()).toBeEnabled());
    fireEvent.click(viewButton());
    expect(dialog()).toBeNull();
  });

  it("when the save fails, closes its tab and never shows the preview", async () => {
    allowTabs();
    fs.saveInvitation.mockRejectedValueOnce(new Error("offline"));
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    await waitFor(() => expect(tabs[0].close).toHaveBeenCalled());
    expect(tabs[0].location.replace).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Save failed"));
    // Edits are kept and still unsaved
    expect(titleInput()).toHaveValue("Join us");
    await waitFor(() => expect(viewButton()).toBeEnabled());
    expect(await openDialog()).toBeTruthy();
  });

  it("when validation stops the save, closes its tab and jumps to the problem", async () => {
    allowTabs();
    renderBuilder("/create-invitation?section=rsvp");
    // A deadline after the wedding date is rejected by Save's validation
    fireEvent.change(await screen.findByLabelText("RSVP deadline"), { target: { value: "2027-06-30" } });
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    await waitFor(() => expect(tabs[0].close).toHaveBeenCalled());
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(tabs[0].location.replace).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Please fix the RSVP deadline before saving.");
  });

  it("when photos/Story can't be saved yet, closes its tab (settings alone aren't enough)", async () => {
    allowTabs();
    story.loadAllStoryEntries.mockReturnValue(new Promise(() => {})); // Our Story still loading
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    await waitFor(() => expect(tabs[0].close).toHaveBeenCalled());
    expect(fs.saveInvitation).toHaveBeenCalledTimes(1); // settings were saved…
    expect(tabs[0].location.replace).not.toHaveBeenCalled(); // …but no preview
    expect(await screen.findByRole("alert")).toHaveTextContent("Your story is still loading");
  });

  it("when the Registry message can't be saved, closes its tab and explains", async () => {
    allowTabs();
    fs.saveInvitation
      .mockResolvedValueOnce("w1")                          // main Save
      .mockRejectedValueOnce(new Error("offline"));         // Registry message
    renderBuilder("/create-invitation?section=registry");
    fireEvent.change(await screen.findByLabelText("Registry message"), { target: { value: "Thank you!" } });
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    await waitFor(() => expect(tabs[0].close).toHaveBeenCalled());
    expect(fs.saveInvitation).toHaveBeenCalledTimes(2);
    expect(fs.saveInvitation.mock.calls[1][1]).toEqual({ registryMessage: "Thank you!" });
    expect(tabs[0].location.replace).not.toHaveBeenCalled();
    expect(await screen.findByText(/your Registry message couldn't be saved/)).toBeTruthy();
  });

  it("saves the Registry message too, then shows the preview", async () => {
    allowTabs();
    renderBuilder("/create-invitation?section=registry");
    fireEvent.change(await screen.findByLabelText("Registry message"), { target: { value: "Thank you!" } });
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalledWith(PREVIEW_PATH));
    expect(fs.saveInvitation.mock.calls.map(c => c[1])).toContainEqual({ registryMessage: "Thank you!" });
  });

  it("reuses an already-open preview tab and refreshes it after saving", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    fireEvent.click(viewButton()); // opens the preview tab
    expect(tabs).toHaveLength(1);
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalledWith(PREVIEW_PATH));
    expect(window.open).toHaveBeenCalledTimes(1); // no second tab
  });

  it("a failed save leaves an already-open preview tab alone (it shows the last SAVED version)", async () => {
    allowTabs();
    fs.saveInvitation.mockRejectedValueOnce(new Error("offline"));
    renderBuilder();
    await ready();
    fireEvent.click(viewButton());
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(tabs[0].close).not.toHaveBeenCalled();
    expect(tabs[0].location.replace).not.toHaveBeenCalled();
  });

  it("ignores repeated clicks while saving: one save, one tab", async () => {
    allowTabs();
    let finishSave;
    fs.saveInvitation.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    // While saving, the button says so and does nothing
    const busy = await screen.findByRole("button", { name: /Saving…/ });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    fireEvent.click(busy);
    expect(dialog()).toBeNull();
    expect(window.open).toHaveBeenCalledTimes(1);

    finishSave("w1");
    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalledTimes(1));
    expect(fs.saveInvitation).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it("still saves when the browser blocks the tab, then offers a link", async () => {
    blockTabs();
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("link", { name: "Open your invitation preview" })).toHaveAttribute("href", PREVIEW_PATH);
  });
});

describe("viewing never publishes or sends invitation emails", () => {
  it.each([false, true])("Save and View never writes isPublished (stored value: %s)", async (stored) => {
    allowTabs();
    fs.getInvitationByUser.mockResolvedValue({ ...SAVED, isPublished: stored });
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalled());

    for (const [, written] of fs.saveInvitation.mock.calls) {
      expect(written).not.toHaveProperty("isPublished");
      expect(wouldSendEmails({ ...SAVED, isPublished: stored }, written)).toBe(false);
    }
    expect(fs.publishInvitation).not.toHaveBeenCalled();
  });

  it("the plain Save button doesn't write isPublished either", async () => {
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const written = fs.saveInvitation.mock.calls[0][1];
    expect(written).not.toHaveProperty("isPublished");
    expect(wouldSendEmails(SAVED, written)).toBe(false);
  });

  it("viewing without changes writes nothing at all", async () => {
    allowTabs();
    renderBuilder();
    await ready();
    fireEvent.click(viewButton());
    const d = dialog();
    expect(d).toBeNull();
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(fs.publishInvitation).not.toHaveBeenCalled();
  });
});

// ── Regression: "Leave site?" warning on Save and View (Phase 3 bug) ─────────
// A tab keeps its window.name when it navigates within the site. If the
// builder runs in a tab that was opened as the preview (the preview's
// "Builder" button), window.open(…, PREVIEW_WINDOW_NAME) returns the BUILDER
// itself — Save and View then navigated the builder away, and the browser
// showed "Leave site?" because a save was in progress (beforeunload guard).
describe("the builder's own tab is never used as the preview tab", () => {
  // Like a real browser: a matching window name means "that window" — here,
  // the builder's own window.
  // jsdom can't navigate; it reports "Not implemented: navigation" through
  // console.error instead — so that report means "the builder navigated itself".
  const builderNavigated = () => console.error.mock.calls
    .some(args => args.some(a => String(a?.message ?? a).includes("Not implemented: navigation")));

  const browserLikeOpen = () => vi.spyOn(window, "open").mockImplementation((url, name) => {
    if (name && name === window.name) return window;
    const tab = makeTab(url);
    tabs.push(tab);
    return tab;
  });

  it("a builder opened in a former preview tab gives up that tab's name", async () => {
    window.name = PREVIEW_WINDOW_NAME;
    renderBuilder();
    await ready();
    expect(window.name).toBe("");
  });

  it("Save and View opens a separate preview tab instead of navigating the builder", async () => {
    browserLikeOpen();
    renderBuilder();
    await ready();
    window.name = PREVIEW_WINDOW_NAME; // even if the name comes back later
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));

    await waitFor(() => expect(tabs).toHaveLength(1));
    await waitFor(() => expect(tabs[0].location.replace).toHaveBeenCalledWith(PREVIEW_PATH));
    expect(builderNavigated()).toBe(false); // the builder stayed where it is
    expect(window.name).toBe("");
    expect(fs.saveInvitation).toHaveBeenCalledTimes(1);
  });

  it("View Invitation (nothing unsaved) also opens a separate tab", async () => {
    browserLikeOpen();
    renderBuilder();
    await ready();
    window.name = PREVIEW_WINDOW_NAME;
    fireEvent.click(viewButton());
    expect(tabs).toHaveLength(1);
    expect(tabs[0].location.href).toBe(PREVIEW_PATH);
  });

  it("if the browser still hands back the builder's own window, it is not used", async () => {
    vi.spyOn(window, "open").mockReturnValue(window);
    renderBuilder();
    await ready();
    editTitle();
    fireEvent.click(within(await openDialog()).getByRole("button", { name: "Save and View" }));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalledTimes(1));
    // Saved, builder untouched, and a normal link is offered instead
    expect(await screen.findByRole("link", { name: "Open your invitation preview" })).toBeTruthy();
    expect(builderNavigated()).toBe(false);
    expect(titleInput()).toHaveValue("Join us");
  });
});
