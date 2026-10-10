// Component tests for "Adjust photo" (drag to reposition, zoom, reset) in the
// Invitation Builder — Hero Photo and Our Story — including live preview,
// saving to Firestore and reloading. Firebase + photo processing are mocked.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
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

const storage = vi.hoisted(() => ({
  uploadPhoto: vi.fn(async (path, photo, onProgress) => {
    onProgress(100);
    return { path, url: `https://cdn.test/${path}`, width: photo.width, height: photo.height, bytes: photo.bytes, contentType: photo.contentType };
  }),
  deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn((w) => `weddings/${w}/hero/new.webp`),
  buildStoryPath: vi.fn((w, e) => `weddings/${w}/story/${e}/new.webp`),
}));
vi.mock("@/lib/mediaStorage", () => storage);

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

// jsdom has no PointerEvent; a MouseEvent subclass carries clientX/Y + pointerId.
beforeAll(() => {
  for (const win of [window, document.defaultView]) {
    if (win && !win.PointerEvent) {
      win.PointerEvent = class PointerEvent extends win.MouseEvent {
        constructor(type, init = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
          this.pointerType = init.pointerType ?? "mouse";
        }
      };
    }
  }
});

// A wide 1600×900 photo: in the hero frame (268×192) it overflows sideways.
const heroSaved = (adjust) => ({
  path: "weddings/w1/hero/h.webp", url: "https://cdn.test/h.webp", width: 1600, height: 900,
  bytes: 2000, contentType: "image/webp", ...(adjust ? { adjust } : {}),
});
const storySaved = { path: "weddings/w1/story/e1/s.webp", url: "https://cdn.test/s.webp", width: 800, height: 1000, bytes: 1000, contentType: "image/webp" };

const renderBuilder = (path = "/create-invitation") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);
const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const previewHero = () => document.querySelector('img[alt="Hero"]');
const editorHero = () => document.querySelector('img[alt="Hero Photo"]');
const heroFrame = () => {
  const frame = screen.getByTestId("photo-frame-Hero Photo");
  frame.getBoundingClientRect = () => ({ width: 268, height: 192, top: 0, left: 0, right: 268, bottom: 192, x: 0, y: 0 });
  return frame;
};

beforeEach(() => {
  vi.clearAllMocks();
  fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", heroImage: heroSaved(), mediaBytesUsed: 2000 });
  story.loadAllStoryEntries.mockResolvedValue([]);
  prep.preparePhoto.mockImplementation(async (file) => ({
    ok: true,
    photo: { pending: true, localId: "local-1", blob: new Blob(["x"]), previewUrl: "blob:preview-1",
      width: 1600, height: 1200, bytes: 1000, contentType: "image/webp", fileName: file.name },
  }));
  vi.stubGlobal("alert", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Adjust Hero Photo", () => {
  it("zooms with the slider, updates the invitation preview live, and resets", async () => {
    renderBuilder();
    await screen.findByLabelText("Adjust Hero Photo");
    expect(previewHero().style.objectPosition).toBe("50% 50%");
    expect(previewHero().style.transform).toBe("");

    fireEvent.click(screen.getByLabelText("Adjust Hero Photo"));
    const slider = screen.getByLabelText("Zoom Hero Photo");
    fireEvent.change(slider, { target: { value: "1.5" } });

    expect(editorHero().style.transform).toBe("scale(1.5)");
    expect(previewHero().style.transform).toBe("scale(1.5)"); // same style in the invitation
    expect(screen.getByText("150%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Reset Hero Photo position and zoom"));
    expect(previewHero().style.transform).toBe("");
    expect(previewHero().style.objectPosition).toBe("50% 50%");

    fireEvent.click(screen.getByLabelText("Done adjusting Hero Photo"));
    expect(screen.queryByLabelText("Zoom Hero Photo")).toBeNull();
  });

  it("drags to reposition (pointer events cover mouse and touch)", async () => {
    renderBuilder();
    await screen.findByLabelText("Adjust Hero Photo");
    // Not in adjust mode → dragging does nothing (the page can scroll normally)
    const frame = heroFrame();
    fireEvent.pointerDown(frame, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(frame, { clientX: 40, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(frame, { pointerId: 1 });
    expect(previewHero().style.objectPosition).toBe("50% 50%");

    fireEvent.click(screen.getByLabelText("Adjust Hero Photo"));
    expect(frame.style.touchAction).toBe("none");

    // Touch drag to the left → shows more of the right side → x grows
    fireEvent.pointerDown(frame, { clientX: 100, clientY: 100, pointerId: 7, pointerType: "touch", button: 0 });
    fireEvent.pointerMove(frame, { clientX: 40, clientY: 130, pointerId: 7, pointerType: "touch" });
    const [x, y] = previewHero().style.objectPosition.split(" ").map(parseFloat);
    expect(x).toBeGreaterThan(50);
    expect(y).toBe(50); // a wide photo at 100% has no vertical room to move
    expect(editorHero().style.objectPosition).toBe(previewHero().style.objectPosition);

    // After release, moving the pointer changes nothing
    fireEvent.pointerUp(frame, { pointerId: 7 });
    const after = previewHero().style.objectPosition;
    fireEvent.pointerMove(frame, { clientX: 0, clientY: 0, pointerId: 7 });
    expect(previewHero().style.objectPosition).toBe(after);
  });

  it("supports the keyboard while adjusting", async () => {
    renderBuilder();
    fireEvent.click(await screen.findByLabelText("Adjust Hero Photo"));
    const frame = heroFrame();
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    expect(previewHero().style.objectPosition).toBe("48% 50%");
    fireEvent.keyDown(frame, { key: "ArrowUp", shiftKey: true });
    expect(previewHero().style.objectPosition).toBe("48% 60%");
    fireEvent.keyDown(frame, { key: "+" });
    expect(previewHero().style.transform).toBe("scale(1.1)");
    fireEvent.keyDown(frame, { key: "0" });
    expect(previewHero().style.objectPosition).toBe("50% 50%");
    fireEvent.keyDown(frame, { key: "Escape" });
    expect(screen.queryByLabelText("Zoom Hero Photo")).toBeNull();
  });

  it("saves position/zoom to Firestore without re-uploading the photo", async () => {
    renderBuilder();
    fireEvent.click(await screen.findByLabelText("Adjust Hero Photo"));
    fireEvent.change(screen.getByLabelText("Zoom Hero Photo"), { target: { value: "2" } });
    fireEvent.keyDown(heroFrame(), { key: "ArrowLeft", shiftKey: true });

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(storage.uploadPhoto).not.toHaveBeenCalled();
    expect(storage.deletePhoto).not.toHaveBeenCalled();
    expect(story.commitMediaChanges.mock.calls[0][2].heroImage).toEqual({ ...heroSaved(), adjust: { x: 60, y: 50, zoom: 2 } });
  });

  it("restores a saved position after refresh", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", heroImage: heroSaved({ x: 20, y: 30, zoom: 2 }), mediaBytesUsed: 2000 });
    renderBuilder();
    await screen.findByLabelText("Adjust Hero Photo");
    expect(previewHero().style.objectPosition).toBe("20% 30%");
    expect(previewHero().style.transform).toBe("scale(2)");
    expect(editorHero().style.transform).toBe("scale(2)");

    // Resetting and saving removes the stored adjustment
    fireEvent.click(screen.getByLabelText("Adjust Hero Photo"));
    fireEvent.click(screen.getByLabelText("Reset Hero Photo position and zoom"));
    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(story.commitMediaChanges.mock.calls[0][2].heroImage).toEqual(heroSaved());
  });

  it("keeps the adjustment of a new photo through upload, without freeing its preview", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
    // jsdom has no URL.revokeObjectURL — install a spy to prove nothing is released.
    const revoke = vi.fn();
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = revoke;
    renderBuilder();
    await screen.findByText("Invitation Title");
    fireEvent.change(screen.getByLabelText("Choose Hero Photo"), { target: { files: [new File(["x"], "us.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(await screen.findByLabelText("Adjust Hero Photo"));
    fireEvent.change(screen.getByLabelText("Zoom Hero Photo"), { target: { value: "1.25" } });

    expect(previewHero().getAttribute("src")).toBe("blob:preview-1");
    expect(revoke).not.toHaveBeenCalled(); // adjusting is not replacing

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(storage.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(story.commitMediaChanges.mock.calls[0][2].heroImage).toMatchObject({
      path: "weddings/w1/hero/new.webp", adjust: { x: 50, y: 50, zoom: 1.25 },
    });
    URL.revokeObjectURL = original;
  });

  it("a replaced photo starts centered again", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", heroImage: heroSaved({ x: 10, y: 10, zoom: 3 }), mediaBytesUsed: 2000 });
    renderBuilder();
    await screen.findByLabelText("Adjust Hero Photo");
    fireEvent.change(screen.getByLabelText("Choose Hero Photo"), { target: { files: [new File(["x"], "new.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(previewHero().getAttribute("src")).toBe("blob:preview-1"));
    expect(previewHero().style.objectPosition).toBe("50% 50%");
    expect(previewHero().style.transform).toBe("");
  });
});

describe("Adjust Our Story photos", () => {
  beforeEach(() => {
    story.loadAllStoryEntries.mockResolvedValue([{ docId: "e1", data: {
      id: "e1", layout: "photoLeft", title: "Met", description: "", order: 0, images: [storySaved],
    } }]);
  });

  it("adjusts a block photo with a live preview and saves it on the entry", async () => {
    renderBuilder("/create-invitation?section=story");
    fireEvent.click(await screen.findByLabelText("Adjust Block 1 photo"));
    fireEvent.change(screen.getByLabelText("Zoom Block 1 photo"), { target: { value: "1.8" } });
    const frame = screen.getByTestId("photo-frame-Block 1 photo");
    frame.getBoundingClientRect = () => ({ width: 200, height: 250 });
    fireEvent.pointerDown(frame, { clientX: 50, clientY: 50, pointerId: 1, button: 0 });
    fireEvent.pointerMove(frame, { clientX: 50, clientY: 90, pointerId: 1 }); // drag down → shows more of the top
    fireEvent.pointerUp(frame, { pointerId: 1 });

    const preview = within(document.querySelector("section.tg-story")).getByAltText("Met — photo 1");
    expect(preview.style.transform).toBe("scale(1.8)");
    const [, y] = preview.style.objectPosition.split(" ").map(parseFloat);
    expect(y).toBeLessThan(50);
    expect(preview.style.objectPosition).toBe(document.querySelector('img[alt="Block 1 photo"]').style.objectPosition);

    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    const [, changes] = story.commitMediaChanges.mock.calls[0];
    expect(changes.updates).toHaveLength(1);
    expect(changes.updates[0].images[0].adjust).toMatchObject({ x: 50, zoom: 1.8 });
    expect(changes.updates[0].images[0].adjust.y).toBeLessThan(50);
    expect(storage.uploadPhoto).not.toHaveBeenCalled();
  });

  it("renders a saved Story adjustment after refresh", async () => {
    story.loadAllStoryEntries.mockResolvedValue([{ docId: "e1", data: {
      id: "e1", layout: "fullWidth", title: "", description: "", order: 0,
      images: [{ ...storySaved, adjust: { x: 70, y: 20, zoom: 1.4 } }],
    } }]);
    renderBuilder("/create-invitation?section=story");
    await screen.findByLabelText("Adjust Block 1 photo");
    const preview = document.querySelector("section.tg-story img");
    expect(preview.style.objectPosition).toBe("70% 20%");
    expect(preview.style.transform).toBe("scale(1.4)");
  });

  it("disables adjusting while saving", async () => {
    let finish;
    story.commitMediaChanges.mockImplementation(() => new Promise(r => { finish = r; }));
    renderBuilder("/create-invitation?section=story");
    fireEvent.click(await screen.findByLabelText("Adjust Block 1 photo"));
    fireEvent.change(screen.getByLabelText("Zoom Block 1 photo"), { target: { value: "1.2" } });
    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(screen.queryByLabelText("Zoom Block 1 photo")).toBeNull();
    expect(screen.getByLabelText("Adjust Block 1 photo")).toBeDisabled();
    finish();
    await screen.findByText("Saved ✓");
  });
});
