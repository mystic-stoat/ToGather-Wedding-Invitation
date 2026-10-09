// Component tests for the Invitation Builder's Wedding Party tab (Phase 1):
// builder controls, live preview, privacy of contact details, and Save/Load.
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

const contacts = vi.hoisted(() => ({
  loadPartyContacts: vi.fn(async () => ({})),
  savePartyContacts: vi.fn(async () => {}),
}));
vi.mock("@/lib/weddingPartyStore", () => contacts);

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
    buildPartyPath: vi.fn((w, m) => `weddings/${w}/party/${m}/p${++n}.webp`),
  };
});
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

let photoN = 0;
const pendingPhoto = (name = "photo.jpg", bytes = 1000) => ({
  pending: true, localId: `local-${++photoN}`, blob: new Blob(["x"]), previewUrl: `blob:preview-${photoN}`,
  width: 800, height: 800, bytes, contentType: "image/webp", fileName: name,
});

const storedMember = (overrides = {}) => ({
  id: "m1", name: "Jordan Lee", role: "bestMan", customRole: "", side: "groom", description: "",
  photo: null, isPointOfContact: false, showContact: false, publicPhone: "", publicEmail: "",
  ...overrides,
});

const renderBuilder = (path = "/create-invitation") =>
  render(<MemoryRouter initialEntries={[path]}><CreateInvitation /></MemoryRouter>);

const openParty = async () => {
  await screen.findByText("Invitation Title");
  fireEvent.click(screen.getByRole("button", { name: "Wedding Party" }));
  await screen.findByText("Show Wedding Party on invitation");
};
const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const preview = () => screen.getByTestId("invitation-preview");
const partySection = () => preview().querySelector("section.tg-party");
const editors = () => screen.queryAllByTestId("party-member-editor");
const addMember = () => fireEvent.click(screen.getByRole("button", { name: "Add Member" }));
const fillMember = (index, { name, role, phone, email } = {}) => {
  const card = editors()[index];
  if (name !== undefined) fireEvent.change(within(card).getByLabelText(/^Name/), { target: { value: name } });
  if (role) fireEvent.click(within(within(card).getByRole("radiogroup", { name: /role$/ })).getByRole("radio", { name: role }));
  if (phone !== undefined) fireEvent.change(within(card).getByLabelText("Phone"), { target: { value: phone } });
  if (email !== undefined) fireEvent.change(within(card).getByLabelText("Email"), { target: { value: email } });
};

beforeEach(() => {
  vi.clearAllMocks();
  fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1" });
  fs.saveInvitation.mockResolvedValue("w1");
  story.loadAllStoryEntries.mockResolvedValue([]);
  story.commitMediaChanges.mockResolvedValue();
  contacts.loadPartyContacts.mockResolvedValue({});
  contacts.savePartyContacts.mockResolvedValue();
  prep.preparePhoto.mockImplementation(async (file) => ({ ok: true, photo: pendingPhoto(file.name) }));
  vi.stubGlobal("alert", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Wedding Party tab", () => {
  it("replaces Guestbook, and old ?section=guestbook links open it", async () => {
    renderBuilder("/create-invitation?section=guestbook");
    expect(await screen.findByText("Show Wedding Party on invitation")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guestbook" })).toBeNull();
  });

  it("is optional: saving and publishing with no members works and writes no members", async () => {
    renderBuilder();
    await openParty();
    expect(screen.getByText("No wedding party members yet")).toBeTruthy();
    expect(partySection()).toBeNull();

    fireEvent.click(screen.getByText("Publish"));
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    const data = fs.saveInvitation.mock.calls[0][1];
    expect(data.isPublished).toBe(true);
    expect(data).toMatchObject({ partyShowOnInvitation: true, partyGroupBySide: false });
    expect(data).not.toHaveProperty("partyMembers");
    await screen.findByText("Published ✓");
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
    expect(contacts.savePartyContacts).not.toHaveBeenCalled();
  });

  it("adds a member with a live preview card and a placeholder avatar", async () => {
    renderBuilder();
    await openParty();
    addMember();
    expect(editors()).toHaveLength(1);
    expect(partySection()).toBeNull(); // nothing to show until there is a name

    fillMember(0, { name: "Jordan Lee", role: "Best Man" });
    const section = partySection();
    expect(section).toBeTruthy();
    expect(within(section).getByRole("heading", { name: "Wedding Party" })).toBeTruthy();
    expect(within(section).getByText("Jordan Lee")).toBeTruthy();
    expect(within(section).getByText("Best Man")).toBeTruthy();
    expect(within(section).getByTestId("party-avatar-placeholder").textContent).toBe("JL");
  });

  it("supports a custom role via Other", async () => {
    renderBuilder();
    await openParty();
    addMember();
    fillMember(0, { name: "Mia", role: "Other" });
    fireEvent.change(screen.getByLabelText("Custom Role"), { target: { value: "Flower Girl" } });
    expect(within(partySection()).getByText("Flower Girl")).toBeTruthy();
  });

  it("requires a name and a role before saving", async () => {
    renderBuilder();
    await openParty();
    addMember();
    fillMember(0, { name: "Jordan" }); // no role
    addMember();
    fillMember(1, { role: "Bridesmaid" }); // no name
    addMember(); // completely empty → simply dropped
    clickSave();
    expect(globalThis.alert).toHaveBeenCalledWith(expect.stringMatching(/Wedding Party/));
    expect(fs.saveInvitation).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a role.")).toBeTruthy();
    expect(screen.getByText("Enter a name.")).toBeTruthy();

    // Fixing a field clears its error
    fillMember(0, { role: "Groomsman" });
    expect(screen.queryByText("Choose a role.")).toBeNull();
  });

  it("keeps contact details private by default and shows them only when enabled", async () => {
    renderBuilder();
    await openParty();
    addMember();
    fillMember(0, { name: "Jordan Lee", role: "Best Man", phone: "(214) 555-0123", email: "jordan@example.com" });
    expect(screen.getByTestId("party-permission-reminder").textContent).toMatch(/permission/);

    const toggle = screen.getByRole("switch", { name: /Show Jordan Lee's contact details to guests/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(within(partySection()).queryByText(/555-0123/)).toBeNull();
    expect(within(partySection()).queryByText(/jordan@example.com/)).toBeNull();

    fireEvent.click(toggle);
    const shown = within(partySection()).getByTestId("party-member-contact");
    expect(within(shown).getByText(/555-0123/).closest("a").getAttribute("href")).toBe("tel:2145550123");
    expect(within(shown).getByText("jordan@example.com").closest("a").getAttribute("href")).toBe("mailto:jordan@example.com");
  });

  it("allows only one wedding-day point of contact", async () => {
    renderBuilder();
    await openParty();
    addMember(); fillMember(0, { name: "Ana", role: "Maid of Honor" });
    addMember(); fillMember(1, { name: "Ben", role: "Best Man" });
    fireEvent.click(screen.getByRole("switch", { name: /Make Ana the wedding-day point of contact/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Make Ben the wedding-day point of contact/ }));
    expect(screen.getByRole("switch", { name: /Make Ana/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /Make Ben/ })).toHaveAttribute("aria-checked", "true");
    const badges = within(partySection()).getAllByTestId("party-point-of-contact");
    expect(badges).toHaveLength(1);
    expect(badges[0].closest("li").textContent).toMatch(/Ben/);
  });

  it("reorders, groups by side, hides the section and deletes members", async () => {
    renderBuilder();
    await openParty();
    addMember(); fillMember(0, { name: "Ana", role: "Maid of Honor" });
    addMember(); fillMember(1, { name: "Ben", role: "Best Man" });
    const names = () => within(partySection()).getAllByRole("heading", { level: 3 }).map(h => h.textContent);
    expect(names()).toEqual(["Ana", "Ben"]);

    fireEvent.click(screen.getByRole("button", { name: "Move Ben up" }));
    expect(names()).toEqual(["Ben", "Ana"]);

    // Roles suggested the sides (Maid of Honor → Bride's, Best Man → Groom's)
    fireEvent.click(screen.getByRole("switch", { name: "Group wedding party by side" }));
    expect(within(partySection()).getByTestId("party-group-bride").textContent).toMatch(/Bride's Party.*Ana/);
    expect(within(partySection()).getByTestId("party-group-groom").textContent).toMatch(/Groom's Party.*Ben/);

    fireEvent.click(screen.getByRole("switch", { name: "Show Wedding Party on invitation" }));
    expect(partySection()).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Show Wedding Party on invitation" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Ben" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove member" }));
    expect(editors()).toHaveLength(1);
    expect(within(partySection()).queryByText("Ben")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Wedding Party — save and load", () => {
  it("saves members, uploads photos, and keeps hidden contacts out of the public invitation", async () => {
    renderBuilder();
    await openParty();
    addMember();
    fillMember(0, { name: "Jordan Lee", role: "Best Man", phone: "2145550123" });
    fireEvent.change(screen.getByLabelText("Choose Member 1 photo"), {
      target: { files: [new File(["x"], "jordan.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(partySection().querySelector("img")).toBeTruthy());
    expect(partySection().querySelector("img").getAttribute("src")).toMatch(/^blob:preview-/);
    expect(storage.uploadPhoto).not.toHaveBeenCalled(); // uploads wait for Save

    clickSave();
    await waitFor(() => expect(contacts.savePartyContacts).toHaveBeenCalled());

    // Settings only — members are never spread into the settings save
    expect(fs.saveInvitation.mock.calls[0][1]).not.toHaveProperty("partyMembers");
    expect(storage.buildPartyPath).toHaveBeenCalledWith("w1", expect.any(String), "image/webp");
    const fields = story.commitMediaChanges.mock.calls[0][2];
    expect(fields.partyMembers).toHaveLength(1);
    expect(fields.partyMembers[0]).toMatchObject({ name: "Jordan Lee", role: "bestMan", side: "groom", showContact: false, publicPhone: "" });
    expect(fields.partyMembers[0].photo.url).toMatch(/^https:\/\/cdn.test\/weddings\/w1\/party\//);
    expect(JSON.stringify(fields)).not.toMatch(/2145550123/);
    expect(fields.mediaBytesUsed).toBe(1000);

    const [wid, saved] = contacts.savePartyContacts.mock.calls[0];
    expect(wid).toBe("w1");
    expect(Object.values(saved)).toEqual([{ phone: "2145550123", email: "" }]);
    await screen.findAllByText(/Saved ✓/);
  });

  it("restores saved members, settings and private contacts when the builder reopens", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1",
      partyShowOnInvitation: true,
      partyGroupBySide: true,
      partyMembers: [
        storedMember({ id: "m1", name: "Jordan Lee", isPointOfContact: true }),
        storedMember({ id: "m2", name: "Ana Ruiz", role: "maidOfHonor", side: "bride", description: "My sister." }),
      ],
    });
    contacts.loadPartyContacts.mockResolvedValue({ m1: { phone: "2145550123", email: "" } });
    renderBuilder();
    await screen.findByText("Invitation Title");

    // Preview works before the tab (and private contacts) are opened
    expect(within(partySection()).getByText("Ana Ruiz")).toBeTruthy();
    expect(within(partySection()).getByText("My sister.")).toBeTruthy();
    expect(within(partySection()).getByTestId("party-group-groom")).toBeTruthy();
    expect(contacts.loadPartyContacts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Wedding Party" }));
    await waitFor(() => expect(contacts.loadPartyContacts).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(within(editors()[0]).getByLabelText("Phone").value).toBe("2145550123"));
    expect(screen.getByRole("switch", { name: "Group wedding party by side" })).toHaveAttribute("aria-checked", "true");
    // The hidden phone number is still not in the preview
    expect(within(partySection()).queryByText(/2145550123/)).toBeNull();

    // Unchanged → nothing rewritten
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    await screen.findAllByText(/Saved ✓/);
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
    expect(contacts.savePartyContacts).not.toHaveBeenCalled();
  });

  it("never touches stored members or contacts on a save that didn't change them", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      weddingId: "w1",
      partyMembers: [storedMember()],
    });
    renderBuilder();
    await screen.findByText("Invitation Title");
    fireEvent.change(screen.getByPlaceholderText("Together with their families..."), { target: { value: "Hello" } });
    clickSave();
    await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
    await screen.findAllByText(/Saved ✓/);
    expect(fs.saveInvitation.mock.calls[0][1]).not.toHaveProperty("partyMembers");
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
    expect(contacts.loadPartyContacts).not.toHaveBeenCalled();
    expect(contacts.savePartyContacts).not.toHaveBeenCalled();
  });

  it("locks contact fields if private contacts fail to load, without blocking other edits", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", partyMembers: [storedMember()] });
    contacts.loadPartyContacts.mockRejectedValue(new Error("offline"));
    renderBuilder();
    await openParty();
    await screen.findByText(/Contact details couldn't be loaded/);
    expect(within(editors()[0]).getByLabelText("Phone")).toBeDisabled();
    expect(within(editors()[0]).getByLabelText(/^Name/)).not.toBeDisabled();

    fillMember(0, { name: "Jordan L." });
    clickSave();
    await waitFor(() => expect(story.commitMediaChanges).toHaveBeenCalled());
    expect(story.commitMediaChanges.mock.calls[0][2].partyMembers[0].name).toBe("Jordan L.");
    expect(contacts.savePartyContacts).not.toHaveBeenCalled(); // stored contacts can't be wiped
  });

  it("still saves a phone/email-only edit when Our Story failed to load", async () => {
    fs.getInvitationByUser.mockResolvedValue({ weddingId: "w1", partyMembers: [storedMember()] });
    story.loadAllStoryEntries.mockRejectedValue(new Error("offline"));
    renderBuilder();
    await openParty();
    await waitFor(() => expect(within(editors()[0]).getByLabelText("Phone")).not.toBeDisabled());
    fillMember(0, { phone: "2145550123" });
    clickSave();
    await waitFor(() => expect(contacts.savePartyContacts).toHaveBeenCalledWith("w1", { m1: { phone: "2145550123", email: "" } }));
    expect(story.commitMediaChanges).not.toHaveBeenCalled();
  });

  it("reports a contact save failure without losing the other changes", async () => {
    contacts.savePartyContacts.mockRejectedValue(new Error("denied"));
    renderBuilder();
    await openParty();
    addMember();
    fillMember(0, { name: "Jordan", role: "Best Man", email: "j@example.com" });
    clickSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(/phone numbers and emails couldn't be saved/);
    expect(story.commitMediaChanges).toHaveBeenCalled();
  });
});
