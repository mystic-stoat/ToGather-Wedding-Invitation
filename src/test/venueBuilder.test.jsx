// Component tests for the Invitation Builder's Venue tab, the RSVP-tab
// deadline (moved from the removed Privacy tab) and the phone preview.
// Firestore / auth / storage are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
}));
vi.mock("@/lib/firestore", () => fs);

const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
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

import CreateInvitation from "@/pages/CreateInvitation";
import { normalizeVenueSettings, getVenueDisplay } from "@/lib/venueDisplay";
import { getInviteDeadlineError } from "@/lib/rsvpDeadline";

const BASE = {
  weddingId: "w1",
  isPublished: true,
  groomName: { first: "Alex" },
  brideName: { first: "Sam" },
  weddingDate: "2026-06-20",
  ceremonyTime: "14:30",
  inviteDeadline: "2026-05-01",
  venueName: "Rose Hall",
  venueAddress: "1 Garden Way, Dallas, TX",
  venueURL: "https://maps.google.com/?cid=123",
};

const renderBuilder = (path = "/create-invitation?section=venue") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CreateInvitation />
    </MemoryRouter>
  );

const preview = () => screen.getByTestId("invitation-preview");
const venueSection = () => preview().querySelector('[data-section="venue"]');
const sw = (label) => screen.getByRole("switch", { name: `Show ${label}` });
const openVenueTab = () => screen.findByRole("switch", { name: "Show Venue Section" });
const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const saveAndGet = async () => {
  fs.saveInvitation.mockClear();
  clickSave();
  await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
  return fs.saveInvitation.mock.calls.at(-1)[1];
};

beforeEach(() => {
  cleanup();
  fs.getInvitationByUser.mockReset();
  fs.saveInvitation.mockClear();
  vi.stubGlobal("alert", vi.fn());
});

// ─────────────────────────────────────────────────────────────────────────────
describe("venueDisplay helpers", () => {
  it("defaults every option ON and only hides on an explicit false", () => {
    expect(normalizeVenueSettings({})).toEqual({
      venueShowOnInvitation: true, venueShowMap: true, venueShowAddress: true, venueShowDirections: true,
    });
    expect(normalizeVenueSettings({ venueShowMap: false, venueShowAddress: "no" }))
      .toMatchObject({ venueShowMap: false, venueShowAddress: true });
  });

  it("hiding the section hides every part", () => {
    expect(getVenueDisplay({ venueShowOnInvitation: false }))
      .toEqual({ section: false, map: false, address: false, directions: false });
  });
});

describe("rsvpDeadline helper", () => {
  it("matches Wedding Details' rules", () => {
    expect(getInviteDeadlineError("", "2026-06-20")).toBe("RSVP deadline is required.");
    expect(getInviteDeadlineError("", "2026-06-20", { required: false })).toBe("");
    expect(getInviteDeadlineError("2026-06-21", "2026-06-20"))
      .toBe("RSVP deadline must be on or before the wedding date.");
    expect(getInviteDeadlineError("2026-06-20", "2026-06-20")).toBe("");
    expect(getInviteDeadlineError("2026-06-21", "")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Privacy tab removal", () => {
  it("has no Privacy tab or visibility controls, and an old ?section=privacy link opens RSVP", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, privacy: "public" });
    renderBuilder("/create-invitation?section=privacy");
    expect(await screen.findByLabelText("RSVP deadline")).toBeTruthy();
    const nav = screen.getAllByRole("button").map(b => b.textContent.trim());
    expect(nav).not.toContain("Privacy");
    expect(screen.queryByText("Anyone with the link can view")).toBeNull();
    expect(screen.queryByText("Only invited guests can view")).toBeNull();
  });

  it("no longer writes `privacy` and keeps isPublished unchanged on Save", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, privacy: "public" });
    renderBuilder();
    await openVenueTab();
    const saved = await saveAndGet();
    expect(saved).not.toHaveProperty("privacy");
    expect(saved.isPublished).toBe(true);
  });

  it("Publish still sets isPublished", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, isPublished: false });
    renderBuilder();
    await openVenueTab();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls.at(-1)[1].isPublished).toBe(true);
    expect(await screen.findByRole("button", { name: "Published ✓" })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Venue tab", () => {
  it("shows the Wedding Details venue read-only, with no venue inputs", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    const { container } = renderBuilder();
    await openVenueTab();

    const details = screen.getByTestId("venue-details");
    expect(within(details).getByText("Rose Hall")).toBeTruthy();
    expect(within(details).getByText("1 Garden Way, Dallas, TX")).toBeTruthy();
    expect(within(details).getByRole("link", { name: /Open in Google Maps/ }))
      .toHaveAttribute("href", BASE.venueURL);
    expect(screen.getByRole("link", { name: "Wedding Details" })).toHaveAttribute("href", "/wedding-details");
    expect(container.querySelector("main input, main textarea")).toBeNull();
  });

  it("an older invitation without venue settings shows everything, as before, and saves true", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openVenueTab();

    for (const label of ["Venue Section", "Map", "Address", "Get Directions"]) {
      expect(sw(label)).toHaveAttribute("aria-checked", "true");
    }
    const venue = venueSection();
    expect(within(venue).getByTestId("venue-map")).toBeTruthy();
    expect(within(venue).getByText("Rose Hall")).toBeTruthy();
    expect(within(venue).getByTestId("venue-address")).toHaveTextContent("1 Garden Way, Dallas, TX");
    expect(within(venue).getByRole("link", { name: "Get directions" })).toHaveAttribute("href", BASE.venueURL);
    expect(preview().querySelector('[data-section="header"]').textContent).toMatch(/Rose Hall/);

    const saved = await saveAndGet();
    expect(saved).toMatchObject({
      venueShowOnInvitation: true, venueShowMap: true, venueShowAddress: true, venueShowDirections: true,
    });
    // Wedding Details stays the source of truth for the venue itself
    expect(saved.venueName).toBe("Rose Hall");
    expect(saved.venueAddress).toBe("1 Garden Way, Dallas, TX");
  });

  it("map, address and directions switches update the preview immediately and save", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openVenueTab();

    fireEvent.click(sw("Map"));
    expect(within(venueSection()).queryByTestId("venue-map")).toBeNull();
    fireEvent.click(sw("Address"));
    expect(within(venueSection()).queryByTestId("venue-address")).toBeNull();
    fireEvent.click(sw("Get Directions"));
    expect(within(venueSection()).queryByText("Get directions")).toBeNull();
    // Venue name is still shown
    expect(within(venueSection()).getByText("Rose Hall")).toBeTruthy();

    const saved = await saveAndGet();
    expect(saved).toMatchObject({
      venueShowOnInvitation: true, venueShowMap: false, venueShowAddress: false, venueShowDirections: false,
    });
  });

  it("hiding the venue section removes it (and the header venue name) from the preview", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openVenueTab();

    fireEvent.click(sw("Venue Section"));
    expect(venueSection()).toBeNull();
    expect(preview().querySelector('[data-section="header"]').textContent).not.toMatch(/Rose Hall/);
    expect(sw("Map")).toBeDisabled();

    const saved = await saveAndGet();
    expect(saved.venueShowOnInvitation).toBe(false);
    expect(saved.venueShowMap).toBe(true); // sub-options keep their own value
  });

  it("loads saved venue settings", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, venueShowMap: false, venueShowDirections: false });
    renderBuilder();
    await openVenueTab();
    expect(sw("Map")).toHaveAttribute("aria-checked", "false");
    expect(sw("Address")).toHaveAttribute("aria-checked", "true");
    expect(sw("Get Directions")).toHaveAttribute("aria-checked", "false");
    expect(within(venueSection()).queryByTestId("venue-map")).toBeNull();
    expect(within(venueSection()).queryByText("Get directions")).toBeNull();
  });

  it("does not write venue settings when the invitation failed to load", async () => {
    fs.getInvitationByUser.mockRejectedValue(new Error("offline"));
    renderBuilder();
    await openVenueTab();
    const saved = await saveAndGet();
    for (const f of ["venueShowOnInvitation", "venueShowMap", "venueShowAddress", "venueShowDirections"]) {
      expect(saved).not.toHaveProperty(f);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("RSVP tab — deadline", () => {
  const openRsvp = () => {
    renderBuilder("/create-invitation?section=rsvp");
    return screen.findByLabelText("RSVP deadline");
  };

  it("shows the Wedding Details deadline and updates the preview immediately", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    const input = await openRsvp();
    expect(input).toHaveValue("2026-05-01");
    expect(input).toHaveAttribute("max", "2026-06-20");
    const rsvp = () => preview().querySelector('[data-section="rsvp"]');
    expect(rsvp().textContent).toMatch(/Kindly reply by May 1/);

    fireEvent.change(input, { target: { value: "2026-05-15" } });
    expect(rsvp().textContent).toMatch(/Kindly reply by May 15/);

    const saved = await saveAndGet();
    expect(saved.inviteDeadline).toBe("2026-05-15");
  });

  it("blocks saving a deadline after the wedding date, like Wedding Details", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    const input = await openRsvp();
    fireEvent.change(input, { target: { value: "2026-07-01" } });
    clickSave();
    expect(await screen.findByText("RSVP deadline must be on or before the wedding date.")).toBeTruthy();
    expect(fs.saveInvitation).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "2026-06-20" } });
    expect(screen.queryByText("RSVP deadline must be on or before the wedding date.")).toBeNull();
    const saved = await saveAndGet();
    expect(saved.inviteDeadline).toBe("2026-06-20");
  });

  it("can't clear a saved deadline", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    const input = await openRsvp();
    fireEvent.change(input, { target: { value: "" } });
    clickSave();
    expect(await screen.findByText("RSVP deadline is required.")).toBeTruthy();
    expect(fs.saveInvitation).not.toHaveBeenCalled();
  });

  it("an invitation that never had a deadline still saves", async () => {
    const { inviteDeadline, ...noDeadline } = BASE;
    fs.getInvitationByUser.mockResolvedValue(noDeadline);
    await openRsvp();
    const saved = await saveAndGet();
    expect(saved.inviteDeadline).toBe("");
    expect(preview().querySelector('[data-section="rsvp"]').textContent)
      .toMatch(/Kindly reply at your earliest convenience/);
  });

  it("a save error on another tab jumps to the RSVP tab", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, inviteDeadline: "2026-07-01" });
    renderBuilder();
    await openVenueTab();
    clickSave();
    expect(await screen.findByLabelText("RSVP deadline")).toBeTruthy();
    expect(screen.getByText("RSVP deadline must be on or before the wedding date.")).toBeTruthy();
  });
});
