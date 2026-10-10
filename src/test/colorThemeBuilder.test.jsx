// Integration tests for the builder's combined "Color Theme" tab: navigation,
// presets, individual overrides, section backgrounds, typography, contrast
// warnings, reset, and save/reload through the existing Firestore helpers.
// Firestore / auth / storage are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
}));
vi.mock("@/lib/firestore", () => fs);

const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
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
import StorySection from "@/components/invitation/StorySection";
import { THEME_FIELDS } from "@/lib/invitationTheme";

const renderBuilder = (path = "/create-invitation?section=theme") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CreateInvitation />
    </MemoryRouter>
  );

/** "#1e3a5f" → "rgb(30, 58, 95)" — how jsdom reports inline colors. */
const rgb = (hex) => {
  const h = hex.replace("#", "");
  return `rgb(${[0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
};

const preview = () => screen.getByTestId("invitation-preview");
const previewSection = (id) => preview().querySelector(`[data-section="${id}"]`);
const previewButton = (label) => within(preview()).getByText(label);
const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const lastSaved = () => fs.saveInvitation.mock.calls.at(-1)[1];
const typeHex = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const openTheme = async () => screen.findByText("Theme Presets");

describe("Color Theme tab", () => {
  beforeEach(() => {
    cleanup();
    fs.getInvitationByUser.mockReset();
    fs.saveInvitation.mockClear();
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    vi.stubGlobal("alert", vi.fn());
  });

  it("replaces the Color and Font tabs with one Color Theme tab", async () => {
    renderBuilder("/create-invitation");
    await screen.findByText("Invitation Title");
    const nav = screen.getAllByRole("button").map(b => b.textContent.trim());
    expect(nav).toContain("Color Theme");
    expect(nav).not.toContain("Color");
    expect(nav).not.toContain("Font");

    fireEvent.click(screen.getByRole("button", { name: "Color Theme" }));
    expect(await openTheme()).toBeTruthy();
    expect(screen.getByText("Font Pairings")).toBeTruthy();
  });

  it.each(["color", "font"])("old ?section=%s links open Color Theme", async (old) => {
    renderBuilder(`/create-invitation?section=${old}`);
    expect(await openTheme()).toBeTruthy();
  });

  it("shows all six presets and all five font pairings", async () => {
    renderBuilder();
    await openTheme();
    for (const name of ["Garden", "Rose", "Navy", "Blush", "Sage", "Burgundy"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    for (const name of ["Classic", "Editorial", "Modern", "Romantic", "Timeless"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
  });

  it("applying a preset updates every preview color immediately, including the background", async () => {
    // The Wedding Day section only renders when a Date option is on (both OFF by default)
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", weddingDate: "2026-06-20", dateShowCalendar: true });
    renderBuilder();
    await openTheme();
    fireEvent.click(screen.getByRole("button", { name: "Navy" }));

    expect(screen.getByRole("button", { name: "Navy" })).toHaveAttribute("aria-pressed", "true");
    expect(preview().style.backgroundColor).toBe(rgb("#f5f7fa"));
    for (const id of ["header", "greetings", "date", "venue", "rsvp", "closure"]) {
      expect(previewSection(id).style.backgroundColor).toBe(rgb("#f5f7fa"));
    }
    expect(previewButton("RSVP Now").style.backgroundColor).toBe(rgb("#1e3a5f"));
    expect(previewButton("Add to calendar").style.backgroundColor).toBe(rgb("#1e3a5f"));
  });

  it("lets single colors override the preset and flags the preset as customized", async () => {
    renderBuilder();
    await openTheme();
    fireEvent.click(screen.getByRole("button", { name: "Rose" }));
    expect(screen.queryByText("Customized")).toBeNull();

    typeHex("Button", "#123456");
    expect(previewButton("RSVP Now").style.backgroundColor).toBe(rgb("#123456"));
    // The rest of the preset is untouched
    expect(previewSection("greetings").style.backgroundColor).toBe(rgb("#fdf5f7"));
    expect(screen.getByText("Customized")).toBeTruthy();

    typeHex("Heading Text", "#222222");
    const h1 = within(preview()).getByRole("heading", { level: 1 });
    expect(h1.style.color).toBe(rgb("#222222"));
  });

  it("ignores invalid hex input until it is valid", async () => {
    renderBuilder();
    await openTheme();
    const user = userEvent.setup();
    const input = screen.getByLabelText("Main Background");
    await user.clear(input);
    await user.type(input, "#12");
    await user.tab(); // leave the field
    expect(await screen.findByText(/Enter a hex color/, {}, { timeout: 3000 })).toBeTruthy();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(preview().style.backgroundColor).toBe(rgb("#fafaf5"));
    fireEvent.change(input, { target: { value: "#abc" } });
    expect(preview().style.backgroundColor).toBe(rgb("#aabbcc"));
  });

  it("main background updates every section without its own background", async () => {
    renderBuilder();
    await openTheme();
    const rsvpRow = screen.getByTestId("section-bg-rsvp");
    fireEvent.change(within(rsvpRow).getByRole("combobox"), { target: { value: "custom" } });
    fireEvent.change(within(rsvpRow).getByLabelText("RSVP background"), { target: { value: "#ffffff" } });

    typeHex("Main Background", "#f0e6d2");
    expect(previewSection("greetings").style.backgroundColor).toBe(rgb("#f0e6d2"));
    expect(previewSection("closure").style.backgroundColor).toBe(rgb("#f0e6d2"));
    expect(previewSection("rsvp").style.backgroundColor).toBe(rgb("#ffffff"));

    // Back to "Use Main Background"
    fireEvent.change(within(rsvpRow).getByRole("combobox"), { target: { value: "main" } });
    expect(previewSection("rsvp").style.backgroundColor).toBe(rgb("#f0e6d2"));
  });

  it("offers Story its default tint, Use Main Background and a custom color", async () => {
    renderBuilder();
    await openTheme();
    const storyRow = screen.getByTestId("section-bg-story");
    const select = within(storyRow).getByRole("combobox");
    expect(select.value).toBe("tint");
    expect([...select.options].map(o => o.value)).toEqual(["tint", "main", "custom"]);
    // Other sections have no tint option
    expect([...within(screen.getByTestId("section-bg-venue")).getByRole("combobox").options].map(o => o.value))
      .toEqual(["main", "custom"]);

    fireEvent.change(select, { target: { value: "main" } });
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(lastSaved().sectionBackgrounds).toEqual({ story: "main" });
  });

  it("StorySection uses an explicit background and otherwise keeps its tint", () => {
    const blocks = [{ id: "b1", layout: "textOnly", title: "Hi", description: "", images: [] }];
    const { rerender, container } = render(<StorySection blocks={blocks} accentColor="#8a9a5b" />);
    expect(container.querySelector("section").style.backgroundColor).toBe("rgb(239, 241, 232)");
    rerender(<StorySection blocks={blocks} accentColor="#8a9a5b" backgroundColor="#123456" />);
    expect(container.querySelector("section").style.backgroundColor).toBe(rgb("#123456"));
  });

  it("changes invitation fonts without changing the builder's own font", async () => {
    const { container } = renderBuilder();
    await openTheme();
    const builderFont = container.firstChild.style.fontFamily;
    expect(builderFont).toMatch(/DM Sans/);

    fireEvent.click(screen.getByRole("button", { name: /^Romantic/ }));
    expect(within(preview()).getByRole("heading", { level: 1 }).style.fontFamily).toMatch(/Great Vibes/);
    expect(preview().style.fontFamily).toMatch(/Nunito/);

    fireEvent.change(screen.getByLabelText("Body Font"), { target: { value: "Lato" } });
    expect(preview().style.fontFamily).toMatch(/Lato/);
    expect(container.firstChild.style.fontFamily).toBe(builderFont);
  });

  it("shows an accessible contrast warning and clears it after reset", async () => {
    renderBuilder();
    await openTheme();
    const status = screen.getByTestId("contrast-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(within(status).getByText(/meets WCAG AA/)).toBeTruthy();

    typeHex("Body Text", "#eeeeee");
    // One warning per distinct background: the main one and Story's soft tint
    const bodyWarnings = within(status).getAllByText(/Body text on the background/);
    expect(bodyWarnings.map(w => w.textContent)).toEqual([
      expect.stringMatching(/Header, Greetings, Wedding Day, Music, Wedding Party, Venue, Travel & Stay, RSVP, Closing/),
      expect.stringMatching(/Our Story/),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Reset to defaults/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset theme" }));
    expect(within(status).getByText(/meets WCAG AA/)).toBeTruthy();
    expect(screen.getByLabelText("Body Text").value).toBe("#46483c");
  });

  it("saves every theme setting and loads it back after a refresh", async () => {
    const { unmount } = renderBuilder();
    await openTheme();
    fireEvent.click(screen.getByRole("button", { name: "Burgundy" }));
    fireEvent.click(screen.getByRole("button", { name: /^Editorial/ }));
    typeHex("Accent", "#c0a060");
    const venueRow = screen.getByTestId("section-bg-venue");
    fireEvent.change(within(venueRow).getByRole("combobox"), { target: { value: "custom" } });
    fireEvent.change(within(venueRow).getByLabelText("Venue background"), { target: { value: "#ffffff" } });

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const saved = lastSaved();
    expect(saved).toMatchObject({
      colorPalette1: "#6b2737", colorPalette2: "#9b5a65", colorBackground: "#faf5f6",
      colorButton: "#6b2737", colorAccent: "#c0a060", colorHeadingText: "#1a1c19",
      colorBodyText: "#46483c", sectionBackgrounds: { venue: "#ffffff" },
      font1: "Noto Serif", font2: "Manrope", themePreset: "Burgundy", fontPreset: "Editorial",
    });

    // "Refresh": the builder reloads what was saved
    unmount();
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", ...saved });
    renderBuilder();
    await openTheme();
    expect(previewSection("greetings").style.backgroundColor).toBe(rgb("#faf5f6"));
    expect(previewSection("venue").style.backgroundColor).toBe(rgb("#ffffff"));
    expect(preview().style.fontFamily).toMatch(/Manrope/);
    expect(screen.getByLabelText("Accent").value).toBe("#c0a060");
    expect(screen.getByRole("button", { name: "Burgundy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("loads an older invitation with only the original fields and saves sensible defaults", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1", colorPalette1: "#9b3a5a", colorPalette2: "#c97a95",
      font1: "Cormorant Garamond", font2: "Lato", greetingTitle: "Hello",
    });
    renderBuilder();
    await openTheme();
    expect(screen.getByRole("button", { name: "Rose" })).toHaveAttribute("aria-pressed", "true");
    expect(previewButton("RSVP Now").style.backgroundColor).toBe(rgb("#9b3a5a"));

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(lastSaved()).toMatchObject({
      colorPalette1: "#9b3a5a", colorPalette2: "#c97a95", colorBackground: "#fdf5f7",
      colorButton: "#9b3a5a", font1: "Cormorant Garamond", font2: "Lato",
      sectionBackgrounds: {}, themePreset: "Rose", fontPreset: "Modern", greetingTitle: "Hello",
    });
  });

  it("does not write theme fields when the saved invitation failed to load", async () => {
    fs.getInvitationByUser.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderBuilder();
    await openTheme();
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    for (const field of THEME_FIELDS) expect(lastSaved()).not.toHaveProperty(field);
  });

  it("keeps other features' settings in the same save", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1", musicTrackId: "abc123def456ghi789jkl0", musicShowOnInvitation: true,
      storyTitle: "How We Met", travelShowOnInvitation: false,
    });
    renderBuilder();
    await openTheme();
    fireEvent.click(screen.getByRole("button", { name: "Sage" }));
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(lastSaved()).toMatchObject({
      musicTrackId: "abc123def456ghi789jkl0", storyTitle: "How We Met",
      travelShowOnInvitation: false, themePreset: "Sage",
    });
  });
});
