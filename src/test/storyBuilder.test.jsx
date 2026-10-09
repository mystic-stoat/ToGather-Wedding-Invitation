// Component tests for the Invitation Builder's Greetings (Hero Photo) and
// Our Story sections, plus Layout/Gallery removal.
// Firestore, Cloud Storage and photo processing are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
}));
vi.mock("@/lib/firestore", () => fs);

const story = vi.hoisted(() => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/storyStore", () => story);

const storage = vi.hoisted(() => {
  let n = 0;
  return {
    uploadPhoto: vi.fn(async (path, photo, onProgress) => {
      onProgress(100);
      return { path, url: `https://cdn.test/${path}`, width: photo.width, height: photo.height, bytes: photo.bytes, contentType: photo.contentType };
    }),
    deletePhoto: vi.fn(async () => true),
    buildHeroPath: vi.fn((w) => `weddings/${w}/hero/h${++n}.webp`),
    buildStoryPath: vi.fn((w, e) => `weddings/${w}/story/${e}/s${++n}.webp`),
  };
});
vi.mock("@/lib/mediaStorage", () => storage);

// Photo processing needs a real browser canvas; return a ready "pending photo".
const prep = vi.hoisted(() => ({ preparePhoto: vi.fn() }));
vi.mock("@/lib/imageProcessing", async (importOriginal) => ({
  ...(await importOriginal()),
  preparePhoto: prep.preparePhoto,
}));

const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
}));

import CreateInvitation from "@/pages/CreateInvitation";

let photoN = 0;
const pendingPhoto = (name = "photo.jpg", bytes = 1000) => ({
  pending: true, localId: `local-${++photoN}`, blob: new Blob(["x"]), previewUrl: `blob:preview-${photoN}`,
  width: 1600, height: 1200, bytes, contentType: "image/webp", fileName: name,
});
const savedPhoto = (path, bytes = 2000) => ({
  path, url: `https://cdn.test/${path}`, width: 800, height: 1000, bytes, contentType: "image/webp",
});

const renderBuilder = (path = "/create-invitation") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);

const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const pickFile = (label, name = "photo.jpg") =>
  fireEvent.change(screen.getByLabelText(`Choose ${label}`), {
    target: { files: [new File(["x"], name, { type: "image/jpeg" })] },
  });
const previewStory = () => document.querySelector("section.tg-story");
const editors = () => screen.queryAllByTestId("story-block-editor");

beforeEach(() => {
  vi.clearAllMocks();
  fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
  fs.saveInvitation.mockResolvedValue("w1");
  story.loadAllStoryEntries.mockResolvedValue([]);
  story.commitMediaChanges.mockResolvedValue();
  prep.preparePhoto.mockImplementation(async (file) => ({ ok: true, photo: pendingPhoto(file.name) }));
  vi.stubGlobal("alert", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
describe("navigation", () => {
  it("removes Layout and Gallery, opens Greetings by default, keeps the other tabs", async () => {
    renderBuilder();
    expect(await screen.findByText("Invitation Title")).toBeTruthy();
    const nav = screen.getAllByRole("button").map(b => b.textContent.trim());
    expect(nav).not.toContain("Layout");
    expect(nav).not.toContain("Gallery");
    // Color + Font were combined into one "Color Theme" tab
    expect(nav).not.toContain("Color");
    expect(nav).not.toContain("Font");
    for (const label of ["Privacy", "Color Theme", "Music", "Greetings", "Date", "Venue", "Travel & Stay", "Story", "RSVP", "Guestbook"]) {
      expect(nav).toContain(label);
    }
  });

  it("no longer writes layoutStyle, but leaves existing data alone", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", layoutStyle: "editorial", greetingTitle: "Hi" });
    renderBuilder();
    await screen.findByText("Invitation Title");
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls[0][1]).not.toHaveProperty("layoutStyle");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Hero Photo (Greetings)", () => {
  it("previews a picked photo and uploads it on Save", async () => {
    renderBuilder();
    await screen.findByText("Invitation Title");
    pickFile("Hero Photo", "us.jpg");
    await screen.findByText("Uploads on save");
    expect(document.querySelector('img[alt="Hero"]').getAttribute("src")).toMatch(/^blob:preview-/);
    expect(storage.uploadPhoto).not.toHaveBeenCalled(); // nothing uploads before Save

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(storage.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(storage.uploadPhoto.mock.calls[0][0]).toMatch(/^weddings\/w1\/hero\//);
    const fields = story.commitMediaChanges.mock.calls[0][2];
    expect(fields.heroImage.url).toMatch(/^https:\/\/cdn\.test\/weddings\/w1\/hero\//);
    expect(fields.mediaBytesUsed).toBe(1000);
    await screen.findByText("Saved ✓");
    expect(document.querySelector('img[alt="Hero"]').getAttribute("src")).toMatch(/^https:/);
  });

  it("loads a saved hero, and removing it deletes the old file after saving", async () => {
    const hero = savedPhoto("weddings/w1/hero/old.webp", 3000);
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", heroImage: hero, mediaBytesUsed: 3000 });
    renderBuilder();
    await screen.findByText("Invitation Title");
    expect(document.querySelector('img[alt="Hero"]').getAttribute("src")).toBe(hero.url);

    fireEvent.click(screen.getByLabelText("Remove Hero Photo"));
    expect(document.querySelector('img[alt="Hero"]')).toBeNull();

    clickSave();
    await waitFor(() => expect(storage.deletePhoto).toHaveBeenCalledWith("w1", hero.path));
    expect(story.commitMediaChanges.mock.calls[0][2].heroImage).toBeNull();
    expect(story.updateMediaBookkeeping).toHaveBeenCalledWith("w1", { mediaBytesUsed: 0, mediaPendingDeletes: [] });
  });

  it("shows validation errors from photo checks", async () => {
    prep.preparePhoto.mockResolvedValue({ ok: false, error: "Please choose a JPEG, PNG, or WebP photo." });
    renderBuilder();
    await screen.findByText("Invitation Title");
    pickFile("Hero Photo", "anim.gif");
    expect(await screen.findByText("Please choose a JPEG, PNG, or WebP photo.")).toBeTruthy();
  });

  it("keeps the unsaved photo and explains when an upload fails", async () => {
    storage.uploadPhoto.mockRejectedValueOnce(new Error("network"));
    renderBuilder();
    await screen.findByText("Invitation Title");
    pickFile("Hero Photo", "us.jpg");
    await screen.findByText("Uploads on save");
    clickSave();
    expect(await screen.findByText(/"us\.jpg" couldn't be uploaded/)).toBeTruthy();
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
    expect(screen.getByText("Uploads on save")).toBeTruthy(); // still here to retry
    expect(screen.queryByText("Saved ✓")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Our Story editor", () => {
  const openStory = async () => {
    renderBuilder("/create-invitation?section=story");
    await screen.findByText("Story Blocks");
  };

  it("adds, edits and deletes blocks, with a live preview", async () => {
    await openStory();
    expect(screen.getByText("No story blocks yet")).toBeTruthy();

    fireEvent.click(screen.getByText("Add Story Block"));
    expect(editors()).toHaveLength(1);
    expect(within(previewStory()).getByText("Our Story")).toBeTruthy();

    fireEvent.change(screen.getAllByLabelText(/^Title/)[0], { target: { value: "How we met" } });
    fireEvent.change(screen.getAllByLabelText(/^Description/)[0], { target: { value: "In Denton" } });
    expect(within(previewStory()).getByText("How we met")).toBeTruthy();
    expect(within(previewStory()).getByText("In Denton")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Delete block 1"));
    fireEvent.click(await screen.findByText("Delete block"));
    await waitFor(() => expect(editors()).toHaveLength(0));
    expect(previewStory()).toBeNull();
  });

  it("customizes the section title and Show/Hide toggle, and saves them", async () => {
    await openStory();
    fireEvent.click(screen.getByText("Add Story Block"));
    fireEvent.click(screen.getByText("How We Met"));
    expect(within(previewStory()).getByText("How We Met")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Show story on invitation" }));
    expect(previewStory()).toBeNull();

    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    expect(fs.saveInvitation.mock.calls[0][1]).toMatchObject({ storyTitle: "How We Met", storyShowOnInvitation: false });
  });

  it("supports all six layouts in the preview, showing text only where supported", async () => {
    await openStory();
    fireEvent.click(screen.getByText("Add Story Block"));
    fireEvent.change(screen.getAllByLabelText(/^Title/)[0], { target: { value: "Kept title" } });

    const choose = (label) => fireEvent.click(screen.getByRole("radio", { name: label }));
    const shown = () => previewStory().querySelector("[data-layout]")?.getAttribute("data-layout");

    for (const [label, id, showsText] of [
      ["Text Left + Photo Right", "photoRight", true],
      ["Two Photos Side by Side", "twoPhotos", false],
      ["Full-Width Photo", "fullWidth", false],
      ["Text Only", "textOnly", true],
      ["Three-Photo Collage", "collage", false],
      ["Photo Left + Text Right", "photoLeft", true],
    ]) {
      choose(label);
      expect(screen.getByRole("radio", { name: label }).getAttribute("aria-checked")).toBe("true");
      expect(shown()).toBe(id);
      expect(Boolean(within(previewStory()).queryByText("Kept title"))).toBe(showsText);
    }
  });

  it("preserves text across photo-only layouts and warns before hiding photos", async () => {
    await openStory();
    fireEvent.click(screen.getByText("Add Story Block"));
    fireEvent.change(screen.getAllByLabelText(/^Title/)[0], { target: { value: "Proposal" } });

    // Text is kept (but not shown) in a photo-only layout
    fireEvent.click(screen.getByRole("radio", { name: "Three-Photo Collage" }));
    expect(screen.getByText(/Your title and description are kept/)).toBeTruthy();

    pickFile("Block 1 large photo", "a.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 large photo")).toBeTruthy());
    pickFile("Block 1 top photo", "b.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 top photo")).toBeTruthy());
    pickFile("Block 1 bottom photo", "c.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 bottom photo")).toBeTruthy());

    // Switching to a 1-photo layout asks first
    fireEvent.click(screen.getByRole("radio", { name: "Photo Left + Text Right" }));
    expect(await screen.findByText(/2 photos don't fit this layout/)).toBeTruthy();
    fireEvent.click(screen.getByText("Keep current layout"));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Three-Photo Collage" }).getAttribute("aria-checked")).toBe("true"));

    fireEvent.click(screen.getByRole("radio", { name: "Photo Left + Text Right" }));
    fireEvent.click(await screen.findByText("Switch layout"));
    await screen.findByText(/will be removed when you save/);
    expect(within(previewStory()).getByText("Proposal")).toBeTruthy(); // text came back

    // Switching back restores the hidden photos (nothing lost before Save)
    fireEvent.click(screen.getByRole("radio", { name: "Three-Photo Collage" }));
    expect(screen.getByLabelText("Remove Block 1 bottom photo")).toBeTruthy();
  });

  it("reorders with Move Up / Move Down and saves the new order", async () => {
    const entries = ["A", "B", "C"].map((t, i) => ({
      docId: `e${i}`, data: { id: `e${i}`, layout: "textOnly", title: t, description: "", images: [], order: i },
    }));
    story.loadAllStoryEntries.mockResolvedValue(entries);
    await openStory();
    await waitFor(() => expect(editors()).toHaveLength(3));

    const order = () => Array.from(previewStory().querySelectorAll(".tg-story__title")).map(e => e.textContent);
    expect(order()).toEqual(["A", "B", "C"]);
    expect(screen.getByLabelText("Move block 1 up")).toBeDisabled();
    expect(screen.getByLabelText("Move block 3 down")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Move block 3 up"));
    expect(order()).toEqual(["A", "C", "B"]);
    fireEvent.click(screen.getByLabelText("Move block 1 down"));
    expect(order()).toEqual(["C", "A", "B"]);

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    const changes = story.commitMediaChanges.mock.calls[0][1];
    expect(changes.creates).toEqual([]);
    expect(Object.fromEntries(changes.updates.map(u => [u.title, u.order]))).toEqual({ C: 0, A: 1, B: 2 });
  });

  it("loads saved entries progressively and keeps unchanged ones untouched on save", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", mediaBytesUsed: 2000 });
    story.loadAllStoryEntries.mockImplementation(async (wid, { onPage }) => {
      const all = [{ docId: "e1", data: { id: "e1", layout: "photoLeft", title: "Saved", description: "", order: 0,
        images: [savedPhoto("weddings/w1/story/e1/p.webp")] } }];
      onPage(all);
      return all;
    });
    await openStory();
    await waitFor(() => expect(editors()).toHaveLength(1));
    expect(within(previewStory()).getByAltText("Saved — photo 1").getAttribute("src")).toMatch(/^https:/);

    clickSave();
    await screen.findByText("Saved ✓");
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
  });

  it("repairs a stale mediaBytesUsed counter on the next save", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", mediaBytesUsed: 999999 });
    story.loadAllStoryEntries.mockResolvedValue([{ docId: "e1", data: { id: "e1", layout: "fullWidth", title: "", description: "",
      order: 0, images: [savedPhoto("weddings/w1/story/e1/p.webp", 2000)] } }]);
    await openStory();
    await waitFor(() => expect(editors()).toHaveLength(1));
    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(story.commitMediaChanges.mock.calls[0][2].mediaBytesUsed).toBe(2000);
  });

  it("creates new blocks with photos on save and drops empty ones", async () => {
    await openStory();
    fireEvent.click(screen.getByText("Add Story Block"));
    fireEvent.click(screen.getByRole("radio", { name: "Full-Width Photo" }));
    pickFile("Block 1 photo", "wide.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 photo")).toBeTruthy());
    fireEvent.click(screen.getByText("Add Story Block")); // stays empty

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    const [wid, changes] = story.commitMediaChanges.mock.calls[0];
    expect(wid).toBe("w1");
    expect(changes.creates).toHaveLength(1);
    expect(changes.creates[0]).toMatchObject({ layout: "fullWidth", order: 0 });
    expect(changes.creates[0].images[0].path).toMatch(/^weddings\/w1\/story\//);
    await waitFor(() => expect(editors()).toHaveLength(1));
  });

  it("shows an error with retry when the story fails to load", async () => {
    story.loadAllStoryEntries.mockRejectedValueOnce(new Error("offline"));
    await openStory();
    expect(await screen.findByText(/couldn't be loaded/)).toBeTruthy();
    fireEvent.click(screen.getByText("Try again"));
    await screen.findByText("No story blocks yet");
  });

  it("blocks saves that would go over the photo quota, before uploading", async () => {
    prep.preparePhoto.mockImplementation(async (file) => ({ ok: true, photo: pendingPhoto(file.name, 60 * 1024 * 1024) }));
    await openStory();
    fireEvent.click(screen.getByText("Add Story Block"));
    fireEvent.click(screen.getByRole("radio", { name: "Two Photos Side by Side" }));
    pickFile("Block 1 photo 1", "a.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 photo 1")).toBeTruthy());
    pickFile("Block 1 photo 2", "b.jpg");
    await waitFor(() => expect(screen.getByLabelText("Remove Block 1 photo 2")).toBeTruthy());
    expect(screen.getByText(/over the photo limit/)).toBeTruthy();

    clickSave();
    expect(await screen.findByText(/over your 100 MB photo limit/)).toBeTruthy();
    expect(storage.uploadPhoto).not.toHaveBeenCalled();
  });
});
