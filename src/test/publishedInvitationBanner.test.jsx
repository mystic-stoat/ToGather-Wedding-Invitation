// Tests for the published-invitation disclaimer banner:
//   - the shared PublishedInvitationBanner component
//   - its integration on Wedding Details, Invitation Builder,
//     Wedding Assistant, and Guest List
// Firestore / auth / storage are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
  getInvitees: vi.fn(async () => []),
  addInvitee: vi.fn(async () => "g1"),
  deleteInvitee: vi.fn(async () => {}),
  subscribeToMessages: vi.fn((uid, onMessages) => { onMessages([]); return () => {}; }),
  subscribeToPendingProposals: vi.fn((uid, onProposals) => { onProposals([]); return () => { }; }),
  decideProposal: vi.fn(async () => { }),
  sendUserMessage: vi.fn(async () => "m1"),
  retryUserMessage: vi.fn(async () => {}),
  clearMessages: vi.fn(async () => {}),
  messageText: (m) => (m?.content || []).map((b) => b.text || "").join(""),
}));
vi.mock("@/lib/firestore", () => fs);

const auth = vi.hoisted(() => ({
  user: { uid: "u1", emailVerified: true },
  userProfile: { name: "Host" },
  logout: vi.fn(async () => {}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: ({ title }) => <div data-testid="map-embed">{title}</div>,
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: (q) => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));
vi.mock("@/lib/storyStore", () => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn(), buildStoryPath: vi.fn(),
}));

import PublishedInvitationBanner from "@/components/PublishedInvitationBanner";
import WeddingDetails from "@/pages/WeddingDetails";
import CreateInvitation from "@/pages/CreateInvitation";
import WeddingAssistant from "@/pages/WeddingAssistant";
import GuestList from "@/pages/GuestList";

const TITLE = "Invitation Already Published";
const banner = () => screen.queryByRole("alert");
const INVITATION_BASE = {
  weddingId: "w1",
  userId: "u1",
  groomName: { first: "Alex", middle: "", last: "Host" },
  brideName: { first: "Sam", middle: "", last: "Partner" },
  weddingDate: "2026-06-20",
  ceremonyTime: "14:30",
  inviteDeadline: "2026-05-01",
  venueName: "Rose Hall",
  venueAddress: "1 Garden Way, Dallas, TX",
  receptionName: "Rose Hall North",
};

const inRouter = (ui, path = "/") =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

beforeEach(() => {
  cleanup();
  fs.getInvitationByUser.mockReset();
  fs.getInvitees.mockReset().mockResolvedValue([]);
  fs.saveInvitation.mockClear();
  fs.subscribeToMessages.mockClear();
  vi.stubGlobal("alert", vi.fn());
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PublishedInvitationBanner component", () => {
  it.each([false, undefined, null])("renders nothing when isPublished is %s", (value) => {
    const { container } = render(<PublishedInvitationBanner isPublished={value} />);
    expect(container).toBeEmptyDOMElement();
    expect(banner()).toBeNull();
  });

  it.each(["true", 1, "yes", {}])("renders nothing for truthy non-boolean isPublished=%s", (value) => {
    const { container } = render(<PublishedInvitationBanner isPublished={value} />);
    expect(container).toBeEmptyDOMElement();
    expect(banner()).toBeNull();
  });

  it("renders the title and default message when published", () => {
    render(<PublishedInvitationBanner isPublished={true} />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(/guests may have received an email/i)).toBeInTheDocument();
    expect(screen.getByText(/will not update emails that have already been delivered/i))
      .toBeInTheDocument();
  });

  it("says 'may have received' — it never claims every email was delivered", () => {
    render(<PublishedInvitationBanner isPublished={true} />);
    expect(banner().textContent).toContain("may have received");
    expect(banner().textContent).not.toMatch(/all guests received/i);
  });

  it("supports a page-specific message override", () => {
    render(<PublishedInvitationBanner isPublished={true} message="Custom warning text." />);
    expect(screen.getByText("Custom warning text.")).toBeInTheDocument();
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it("exposes an alert region with a decorative icon", () => {
    const { container } = render(<PublishedInvitationBanner isPublished={true} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(container.querySelector("svg[aria-hidden='true']")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Wedding Details integration", () => {
  const renderDetails = () => inRouter(<WeddingDetails />, "/wedding-details");

  it("shows the banner above the form when the invitation is published", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    renderDetails();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    // banner sits before the editable fields
    const firstNameInput = screen.getAllByPlaceholderText("First")[0];
    expect(banner().compareDocumentPosition(firstNameInput) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("stays hidden for an unpublished invitation", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: false });
    renderDetails();
    await screen.findAllByPlaceholderText("First");
    expect(banner()).toBeNull();
  });

  it("stays hidden when no invitation exists yet", async () => {
    fs.getInvitationByUser.mockResolvedValue(null);
    renderDetails();
    await screen.findAllByPlaceholderText("First");
    expect(banner()).toBeNull();
  });

  it("handles a Firestore read failure without crashing — no banner, form still usable", async () => {
    fs.getInvitationByUser.mockRejectedValue(new Error("permission-denied"));
    renderDetails();
    await screen.findAllByPlaceholderText("First");
    expect(banner()).toBeNull();
    expect(screen.getByText(/couldn't load your saved details/i)).toBeInTheDocument();
  });

  it("keeps the banner after a remount (refresh) — status re-loads from Firestore", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    const first = renderDetails();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    first.unmount();
    renderDetails();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    expect(fs.getInvitationByUser).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Invitation Builder integration", () => {
  const renderBuilder = () => inRouter(<CreateInvitation />, "/create-invitation");

  it("shows the banner inside the edit workspace when published", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    renderBuilder();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    // it lives in the settings pane, not the phone preview
    expect(screen.getByTestId("invitation-preview")).not.toContainElement(banner());
  });

  it("stays hidden when unpublished", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: false });
    renderBuilder();
    await screen.findByTestId("invitation-preview");
    expect(banner()).toBeNull();
  });

  it("the banner never causes isPublished to be written by Save", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    renderBuilder();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(/^Save$/)[0]);
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls.at(-1)[1]).not.toHaveProperty("isPublished");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Wedding Assistant integration", () => {
  const renderAssistant = () => inRouter(<WeddingAssistant />, "/assistant");

  it("shows the banner in the chat card when published, without hiding the composer", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    renderAssistant();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/message your wedding assistant/i)).toBeInTheDocument();
  });

  it("stays hidden when unpublished", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: false });
    renderAssistant();
    await screen.findByPlaceholderText(/message your wedding assistant/i);
    expect(banner()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest List integration", () => {
  const renderGuests = () => inRouter(<GuestList />, "/guests");

  it("shows the banner with the guest-list message when published", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: true });
    renderGuests();
    await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
    // warns that newly added guests are not auto-emailed
    expect(banner().textContent).toContain("won't automatically receive an invitation email");
  });

  it("stays hidden when unpublished", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION_BASE, isPublished: false });
    renderGuests();
    await waitFor(() => expect(fs.getInvitationByUser).toHaveBeenCalled());
    await screen.findByRole("button", { name: /add guest/i });
    expect(banner()).toBeNull();
  });
});
