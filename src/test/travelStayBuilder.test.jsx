// Component tests for the Invitation Builder's Travel & Stay section.
// Firestore / auth are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
}));
vi.mock("@/lib/firestore", () => fs);

// Stable object so the page's [user] effect doesn't re-run every render
const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
}));
// Hero Photo / Our Story talk to Firestore + Cloud Storage — keep them offline here.
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

const renderBuilder = (path = "/create-invitation?section=travel") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CreateInvitation />
    </MemoryRouter>
  );

const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);

// The phone preview's headings carry the invitation font inline; the builder's
// own "Travel & Stay" panel heading does not — that's how we tell them apart.
const previewTravelHeading = () =>
  screen.queryAllByText("Travel & Stay")
    .find(el => el.tagName === "H2" && el.style.fontFamily);

describe("Invitation Builder — Travel & Stay", () => {
  beforeEach(() => {
    fs.getInvitationByUser.mockReset();
    fs.saveInvitation.mockClear();
    vi.stubGlobal("alert", vi.fn());
  });

  it("opens directly on Travel & Stay from ?section=travel and lists it after Venue", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    renderBuilder();
    expect(await screen.findByText("Show Travel & Stay on invitation")).toBeTruthy();
    expect(screen.getByText("No places yet")).toBeTruthy();

    const navLabels = within(screen.getByRole("navigation", { name: "Invitation sections" }))
      .getAllByRole("button")
      .map(b => b.textContent.trim())
      .filter(t => ["Our Story", "Venue", "Travel & Stay", "RSVP"].includes(t));
    // Fixed tab order: … Our Story, Wedding Party, Venue, Travel & Stay, RSVP …
    expect(navLabels).toEqual(["Our Story", "Venue", "Travel & Stay", "RSVP"]);
  });

  it("falls back to the default section for an unknown ?section value", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    renderBuilder("/create-invitation?section=nope");
    // Greetings is the default section now that the Layout tab was removed
    expect(await screen.findByText("Invitation Title")).toBeTruthy();
    expect(screen.queryByText("Show Travel & Stay on invitation")).toBeNull();
  });

  it("loads an older invitation without travel fields and saves defaults", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", greetingTitle: "Hello" });
    renderBuilder();
    await screen.findByText("No places yet");
    expect(previewTravelHeading()).toBeUndefined();

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const saved = fs.saveInvitation.mock.calls[0][1];
    expect(saved.travelItems).toEqual([]);
    expect(saved.travelMessage).toBe("");
    expect(saved.travelShowOnInvitation).toBe(true);
  });

  it("adds multiple places, previews them, and saves cleaned data", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    renderBuilder();
    await screen.findByText("No places yet");

    fireEvent.change(screen.getByPlaceholderText("Here are a few places we recommend for out-of-town guests."),
      { target: { value: " Welcome to Dallas! " } });

    fireEvent.click(screen.getByText(/Add Place/));
    fireEvent.change(screen.getByPlaceholderText("Hyatt Regency Dallas"), { target: { value: " Hyatt Regency Dallas " } });
    fireEvent.change(screen.getByPlaceholderText("https://maps.app.goo.gl/..."), { target: { value: "https://maps.app.goo.gl/hyatt" } });
    fireEvent.change(screen.getByPlaceholderText(/closest hotel/), {
      target: { value: "This is the closest hotel to our wedding venue and where we recommend staying." },
    });

    fireEvent.click(screen.getByText(/Add Place/));
    const place2 = screen.getByText("Place 2").closest("div").parentElement;
    fireEvent.click(within(place2).getByRole("radio", { name: "Airport" }));
    fireEvent.change(within(place2).getByPlaceholderText("Hyatt Regency Dallas"), { target: { value: "Dallas Love Field" } });

    fireEvent.click(screen.getByText(/Add Place/)); // left empty — dropped on save

    // Preview shows the section with category, name, description and link
    expect(previewTravelHeading()).toBeTruthy();
    const mapLink = screen.getByText("View on Google Maps").closest("a");
    expect(mapLink.getAttribute("href")).toBe("https://maps.app.goo.gl/hyatt");
    expect(mapLink.getAttribute("target")).toBe("_blank");
    const preview = previewTravelHeading().parentElement;
    expect(within(preview).getByText("Airport")).toBeTruthy();
    expect(within(preview).getByText("Hotel")).toBeTruthy();
    expect(within(preview).getByText("Welcome to Dallas!")).toBeTruthy();
    expect(within(preview).getByText(/closest hotel to our wedding venue/)).toBeTruthy();
    // The empty third place is not shown in the preview
    expect(within(preview).getAllByText(/^(Hotel|Airport|Restaurant|Other)$/)).toHaveLength(2);

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const saved = fs.saveInvitation.mock.calls[0][1];
    expect(saved.travelMessage).toBe("Welcome to Dallas!");
    expect(saved.travelShowOnInvitation).toBe(true);
    expect(saved.travelItems).toHaveLength(2);
    expect(saved.travelItems[0]).toMatchObject({
      category: "hotel",
      name: "Hyatt Regency Dallas",
      mapUrl: "https://maps.app.goo.gl/hyatt",
      description: "This is the closest hotel to our wedding venue and where we recommend staying.",
    });
    expect(saved.travelItems[1]).toMatchObject({ category: "airport", name: "Dallas Love Field", mapUrl: "" });
  });

  it("removes a place", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1",
      travelItems: [
        { id: "a", category: "hotel", name: "Hyatt", mapUrl: "", description: "" },
        { id: "b", category: "restaurant", name: "Pecan Lodge", mapUrl: "", description: "" },
      ],
    });
    renderBuilder();
    expect(await screen.findByDisplayValue("Pecan Lodge")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove place 1"));
    expect(screen.queryByDisplayValue("Hyatt")).toBeNull();

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls[0][1].travelItems.map(i => i.id)).toEqual(["b"]);
  });

  it("blocks saving an unsafe link and a place without a name", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    renderBuilder();
    await screen.findByText("No places yet");

    fireEvent.click(screen.getByText(/Add Place/));
    const link = screen.getByPlaceholderText("https://maps.app.goo.gl/...");
    fireEvent.change(link, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(link);
    expect(screen.getByText("Enter a valid http:// or https:// link.")).toBeTruthy();

    clickSave();
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(globalThis.alert).toHaveBeenCalled();
    expect(screen.getByText("Place name is required.")).toBeTruthy();

    // Unsafe link never reaches the preview as a clickable link
    expect(screen.queryByText("View on Google Maps")).toBeNull();
  });

  it("hides the preview section when the toggle is off and saves false", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1",
      travelItems: [{ id: "a", category: "hotel", name: "Hyatt", mapUrl: "", description: "" }],
    });
    renderBuilder();
    await screen.findByDisplayValue("Hyatt");
    expect(previewTravelHeading()).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Show Travel & Stay on invitation" }));
    expect(previewTravelHeading()).toBeUndefined();

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls[0][1].travelShowOnInvitation).toBe(false);
  });

  it("does not write travel fields when the invitation failed to load", async () => {
    fs.getInvitationByUser.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderBuilder();
    await screen.findByText("No places yet");

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const saved = fs.saveInvitation.mock.calls[0][1];
    expect("travelItems" in saved).toBe(false);
    expect("travelMessage" in saved).toBe(false);
    expect("travelShowOnInvitation" in saved).toBe(false);
  });
});
