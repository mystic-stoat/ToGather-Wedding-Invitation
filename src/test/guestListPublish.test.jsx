// Tests for the Guest List "Publish Invitation" feature:
//   - countInviteEmailEligible() in src/lib/firestore.js (real code, with
//     firebase/firestore mocked) — the eligible-guest count query
//   - the Publish button, confirmation modal, Published status, loading,
//     error and duplicate-click handling on src/pages/GuestList.jsx
// No emulator, no network, no emails.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createRequire } from "node:module";
import path from "node:path";

// ── Mocks ────────────────────────────────────────────────────────────────────
// Page tests use this mocked @/lib/firestore.
const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  getInvitees: vi.fn(async () => []),
  addInvitee: vi.fn(async () => "g-new"),
  deleteInvitee: vi.fn(async () => {}),
  saveInvitation: vi.fn(async () => "w1"),
  publishInvitation: vi.fn(async () => {}),
  countInviteEmailEligible: vi.fn(async () => 0),
}));
vi.mock("@/lib/firestore", () => fs);

// The query tests load the REAL @/lib/firestore (vi.importActual), whose
// Firestore calls hit these mocks instead of a database.
const fb = vi.hoisted(() => ({
  collection: vi.fn((db, name) => ({ collection: name })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({ ...(await importOriginal()), ...fb }));
vi.mock("@/lib/firebase", () => ({ app: {}, firebaseAuth: {}, db: {}, storage: {}, functions: {} }));

const auth = vi.hoisted(() => ({
  user: { uid: "u1", emailVerified: true },
  userProfile: { name: "Host" },
  logout: vi.fn(async () => {}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import GuestList from "@/pages/GuestList";

// ── Fixtures / helpers ───────────────────────────────────────────────────────
const INVITATION = { weddingId: "w1", userId: "u1", isPublished: false, childrenPolicy: "allowed" };

const guest = (id, overrides = {}) => ({
  inviteeId: id, weddingId: "w1", guestName: `Guest ${id}`, email: `${id}@example.com`,
  group: "Friends", plusOneLimit: 0, rsvpStatus: "Pending", emailStatus: "pending",
  token: `tok-${id}`, plusOnes: [], ...overrides,
});

// Fake Firestore snapshot of invitee docs
const snapshotOf = (docs) => ({
  docs: docs.map(({ inviteeId, ...data }) => ({ id: inviteeId, data: () => data })),
});

// Simulates Firestore applying the query's two where() filters on the server
const serverFilter = (docs) => snapshotOf(
  docs.filter(d => d.weddingId === "w1" && d.emailStatus === "pending")
);

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let alertSpy; // bare alert() resolves to globalThis, not setup.js's JSDOM window

const renderPage = () => render(<MemoryRouter><GuestList /></MemoryRouter>);
const publishButton = () => screen.queryByRole("button", { name: /publish invitation/i });
const modal = () => screen.queryByRole("dialog");
const confirmButton = () => within(modal()).getByRole("button", { name: /publish now|publishing/i });
const cancelButton = () => within(modal()).getByRole("button", { name: /cancel/i });
const publishedStatus = () => screen.queryByText("Published", { selector: "span" });
const countText = () => within(modal()).getByTestId("publish-eligible").textContent;

const waitForPage = () => screen.findByRole("heading", { name: "Guest List" });

const openModal = async () => {
  await waitForPage();
  fireEvent.click(publishButton());
  await waitFor(() => expect(modal()).toBeInTheDocument());
  await waitFor(() => expect(countText()).not.toMatch(/checking your guest list/i));
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  fs.getInvitationByUser.mockReset().mockResolvedValue({ ...INVITATION });
  fs.getInvitees.mockReset().mockResolvedValue([guest("a"), guest("b")]);
  fs.publishInvitation.mockReset().mockResolvedValue(undefined);
  fs.countInviteEmailEligible.mockReset().mockResolvedValue(2);
  alertSpy = vi.fn();
  vi.stubGlobal("alert", alertSpy);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
describe("countInviteEmailEligible — matches sendInvitesOnPublish", () => {
  const real = () => vi.importActual("@/lib/firestore");

  it("queries invitee by weddingId + emailStatus 'pending', server-only, without orderBy", async () => {
    fb.getDocsFromServer.mockResolvedValue(snapshotOf([]));
    const { countInviteEmailEligible } = await real();
    await countInviteEmailEligible("w1");

    expect(fb.collection).toHaveBeenCalledWith(expect.anything(), "invitee");
    expect(fb.where).toHaveBeenCalledWith("weddingId", "==", "w1");
    expect(fb.where).toHaveBeenCalledWith("emailStatus", "==", "pending");
    expect(fb.where).toHaveBeenCalledTimes(2);
    expect(fb.orderBy).not.toHaveBeenCalled();      // guests without names aren't dropped
    expect(fb.getDocsFromServer).toHaveBeenCalledTimes(1);
    expect(fb.getDocs).not.toHaveBeenCalled();      // never a cached result
  });

  it("counts a pending guest with a valid email even when the name is missing", async () => {
    fb.getDocsFromServer.mockResolvedValue(serverFilter([
      guest("a", { guestName: undefined }),
      guest("b", { guestName: "" }),
    ]));
    const { countInviteEmailEligible } = await real();
    expect(await countInviteEmailEligible("w1")).toBe(2);
  });

  it("does not count pending guests without a usable email address", async () => {
    fb.getDocsFromServer.mockResolvedValue(serverFilter([
      guest("ok"),
      guest("empty", { email: "" }),
      guest("missing", { email: undefined }),
      guest("no-at", { email: "not-an-email" }),
    ]));
    const { countInviteEmailEligible } = await real();
    expect(await countInviteEmailEligible("w1")).toBe(1);
  });

  it("counts only pending invitations, not already-sent ones", async () => {
    fb.getDocsFromServer.mockResolvedValue(serverFilter([
      guest("p1"),
      guest("p2"),
      guest("sending",  { emailStatus: "sending" }),
      guest("received", { emailStatus: "received" }),
      guest("failed",   { emailStatus: "failed" }),
      guest("old-doc",  { emailStatus: undefined }),
    ]));
    const { countInviteEmailEligible } = await real();
    expect(await countInviteEmailEligible("w1")).toBe(2);
  });

  it("uses the same email rule as functions/email-utils.js hasUsableEmail", async () => {
    const require = createRequire(import.meta.url);
    const { hasUsableEmail } = require(path.resolve(process.cwd(), "functions/email-utils.js"));
    const { countInviteEmailEligible } = await real();
    const samples = ["a@b.com", "@", "x@", "plain", "", " ", "  a@b  ", null, undefined, 42, ["a@b"]];
    for (const email of samples) {
      fb.getDocsFromServer.mockResolvedValueOnce(snapshotOf([guest("s", { email })]));
      expect(await countInviteEmailEligible("w1")).toBe(hasUsableEmail({ email }) ? 1 : 0);
    }
  });

  it("throws when the server can't be reached (no guessed count)", async () => {
    fb.getDocsFromServer.mockRejectedValue(new Error("offline"));
    const { countInviteEmailEligible } = await real();
    await expect(countInviteEmailEligible("w1")).rejects.toThrow("offline");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List — Publish button and Published status", () => {
  it("shows the Publish Invitation button when the invitation is unpublished", async () => {
    renderPage();
    await waitForPage();
    expect(publishButton()).toBeInTheDocument();
    expect(publishedStatus()).toBeNull();
  });

  it("shows Published instead of the button when already published", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION, isPublished: true });
    renderPage();
    await waitForPage();
    expect(publishButton()).toBeNull();
    expect(publishedStatus()).toBeInTheDocument();
  });

  it("asks for wedding details first when there's no invitation", async () => {
    fs.getInvitationByUser.mockResolvedValue(null);
    renderPage();
    await waitForPage();
    fireEvent.click(publishButton());
    expect(alertSpy).toHaveBeenCalledWith("Please fill in your wedding details first.");
    expect(modal()).toBeNull();
    expect(fs.countInviteEmailEligible).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List — confirmation modal", () => {
  it("refreshes the invitation and count on open, without publishing", async () => {
    renderPage();
    await openModal();
    expect(fs.getInvitationByUser).toHaveBeenCalledTimes(2); // page load + open
    expect(fs.countInviteEmailEligible).toHaveBeenCalledWith("w1");
    expect(fs.getInvitees).toHaveBeenCalledTimes(1);          // page load only
    expect(fs.publishInvitation).not.toHaveBeenCalled();
  });

  it("shows the publishing warnings and the Invitation Builder reminder", async () => {
    renderPage();
    await openModal();
    const text = modal().textContent;
    expect(text).toMatch(/publishing starts sending invitation emails/i);
    expect(text).toMatch(/can't be undone/i);
    expect(text).toMatch(/complete in the Invitation Builder/i);
    expect(text).toMatch(/wedding details, invitation design, and guest list information/i);
    expect(text).toMatch(/guests you add after publishing will not automatically receive an invitation email/i);
  });

  it("labels the count as eligible guests, not guaranteed deliveries", async () => {
    renderPage();
    await openModal();
    expect(countText()).toMatch(/2 guests are eligible for an invitation email/);
    expect(countText()).toMatch(/doesn't guarantee every email will be delivered/i);
  });

  it("uses singular wording for one eligible guest", async () => {
    fs.countInviteEmailEligible.mockResolvedValue(1);
    renderPage();
    await openModal();
    expect(countText()).toMatch(/1 guest is eligible for an invitation email/);
  });

  it("counts guests the table can't show (no name) — the count comes from its own query", async () => {
    fs.getInvitees.mockResolvedValue([guest("a")]);      // table: 1 named guest
    fs.countInviteEmailEligible.mockResolvedValue(3);    // server: + 2 unnamed eligible
    renderPage();
    await openModal();
    expect(countText()).toMatch(/3 guests are eligible/);
  });

  it("warns that no emails will be sent at zero, and still allows publishing", async () => {
    fs.countInviteEmailEligible.mockResolvedValue(0);
    renderPage();
    await openModal();
    expect(countText()).toMatch(/0 guests are eligible/);
    expect(countText()).toMatch(/no invitation emails will be sent/i);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(fs.publishInvitation).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
  });

  it("shows general wording (no number) when the count can't be retrieved", async () => {
    fs.countInviteEmailEligible.mockRejectedValue(new Error("offline"));
    renderPage();
    await openModal();
    expect(countText()).toMatch(/couldn't check how many guests are eligible/i);
    expect(countText()).not.toMatch(/\d/);
    expect(confirmButton()).toBeEnabled();
  });

  it("disables Publish Now while the count is loading", async () => {
    const pending = deferred();
    fs.countInviteEmailEligible.mockReturnValue(pending.promise);
    renderPage();
    await waitForPage();
    fireEvent.click(publishButton());
    await waitFor(() => expect(countText()).toMatch(/checking your guest list/i));
    expect(confirmButton()).toBeDisabled();
    pending.resolve(2);
    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });

  it("shows Published without a write if the refresh finds it already published", async () => {
    renderPage();
    await waitForPage();
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION, isPublished: true });
    fireEvent.click(publishButton());
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(modal()).toBeNull();
    expect(fs.publishInvitation).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Your invitation has already been published.");
  });

  it("Cancel closes the modal without publishing", async () => {
    renderPage();
    await openModal();
    fireEvent.click(cancelButton());
    expect(modal()).toBeNull();
    expect(fs.publishInvitation).not.toHaveBeenCalled();
    expect(publishButton()).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List — invitation status check on open", () => {
  const openWithLatest = async (setup) => {
    renderPage();
    await waitForPage();
    setup();                                   // applies to the refresh on open
    fireEvent.click(publishButton());
    await waitFor(() => expect(modal()).toBeInTheDocument());
    await waitFor(() => expect(countText()).not.toMatch(/checking your guest list/i));
  };

  it("blocks publishing with a clear error when the status check fails", async () => {
    await openWithLatest(() => fs.getInvitationByUser.mockRejectedValue(new Error("network down")));
    expect(within(modal()).getByRole("alert").textContent)
      .toMatch(/couldn't check your invitation's current status/i);
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(fs.publishInvitation).not.toHaveBeenCalled();
    expect(publishedStatus()).toBeNull();
    expect(cancelButton()).toBeEnabled();     // can still close it
  });

  it.each([
    ["no invitation", null],
    ["an invitation without an id", { ...INVITATION, weddingId: undefined }],
    ["a different invitation", { ...INVITATION, weddingId: "other" }],
  ])("blocks publishing when the status check returns %s", async (_label, latest) => {
    await openWithLatest(() => fs.getInvitationByUser.mockResolvedValue(latest));
    expect(within(modal()).getByRole("alert").textContent)
      .toMatch(/couldn't find your invitation/i);
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(fs.publishInvitation).not.toHaveBeenCalled();
  });

  it("blocks publishing even when the count succeeded", async () => {
    await openWithLatest(() => {
      fs.getInvitationByUser.mockRejectedValue(new Error("network down"));
      fs.countInviteEmailEligible.mockResolvedValue(5);
    });
    expect(countText()).toMatch(/5 guests are eligible/);
    expect(confirmButton()).toBeDisabled();
  });

  it("blocks publishing when both the status check and the count fail", async () => {
    await openWithLatest(() => {
      fs.getInvitationByUser.mockRejectedValue(new Error("network down"));
      fs.countInviteEmailEligible.mockRejectedValue(new Error("offline"));
    });
    expect(within(modal()).getByRole("alert")).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("allows publishing when only the count fails, with the general email warning", async () => {
    await openWithLatest(() => fs.countInviteEmailEligible.mockRejectedValue(new Error("offline")));
    expect(within(modal()).queryByRole("alert")).toBeNull();
    expect(countText()).toMatch(/couldn't check how many guests are eligible/i);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(fs.publishInvitation).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
  });

  it("clears a previous status error when the modal is reopened and the check succeeds", async () => {
    await openWithLatest(() => fs.getInvitationByUser.mockRejectedValueOnce(new Error("network down")));
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(cancelButton());

    fireEvent.click(publishButton());          // getInvitationByUser now resolves normally
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(within(modal()).queryByRole("alert")).toBeNull();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(fs.publishInvitation).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List — publishing", () => {
  it("publishes once, then shows Published and the existing banner", async () => {
    renderPage();
    await openModal();
    const invitationReads = fs.getInvitationByUser.mock.calls.length;
    fireEvent.click(confirmButton());

    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(fs.publishInvitation).toHaveBeenCalledTimes(1);
    expect(fs.publishInvitation).toHaveBeenCalledWith("w1");
    expect(fs.getInvitationByUser).toHaveBeenCalledTimes(invitationReads); // no extra read on confirm
    expect(modal()).toBeNull();
    expect(publishButton()).toBeNull();
    expect(screen.getByText("Invitation Already Published")).toBeInTheDocument();
  });

  it("shows a loading state and ignores repeat clicks while publishing", async () => {
    const pending = deferred();
    fs.publishInvitation.mockReturnValue(pending.promise);
    renderPage();
    await openModal();

    const confirm = confirmButton();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(within(modal()).getByRole("button", { name: /publishing/i })).toBeDisabled());
    expect(cancelButton()).toBeDisabled();
    expect(fs.publishInvitation).toHaveBeenCalledTimes(1);

    pending.resolve();
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(fs.publishInvitation).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open with an error on failure, then succeeds on retry", async () => {
    fs.publishInvitation
      .mockRejectedValueOnce(new Error("permission-denied"))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await openModal();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(within(modal()).getByRole("alert").textContent)
      .toMatch(/couldn't publish your invitation\. permission-denied/i));
    expect(publishedStatus()).toBeNull();
    expect(confirmButton()).toBeEnabled();
    expect(cancelButton()).toBeEnabled();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(fs.publishInvitation).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List — existing behavior is preserved", () => {
  it("publishing never saves the invitation or changes guests", async () => {
    renderPage();
    await openModal();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(fs.addInvitee).not.toHaveBeenCalled();
    expect(fs.deleteInvitee).not.toHaveBeenCalled();
  });

  it("guest rows, search and Add Guest still work after publishing", async () => {
    renderPage();
    await openModal();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(publishedStatus()).toBeInTheDocument());

    expect(screen.getAllByText("Guest a").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Search guests..."), { target: { value: "Guest b" } });
    expect(screen.queryAllByText("Guest a")).toHaveLength(0);
    expect(screen.getAllByText("Guest b").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /add guest/i }));
    expect(screen.getByText("Add a Guest")).toBeInTheDocument();
  });
});
