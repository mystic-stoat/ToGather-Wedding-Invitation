// src/lib/weddingParty.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) for the Invitation Builder's
//   "Wedding Party" tab: roles, sides, creating/normalizing members,
//   validation, what the preview shows, and the shapes we save.
//   Kept pure so it is easy to unit test (see src/test/weddingParty.test.jsx).
//
// LOCAL MEMBER SHAPE (in the builder):
//   { id, name, role, customRole, side, description, photo,
//     phone, email, showContact, isPointOfContact, sideAuto }
//   - `photo` is a saved photo, a pending photo (src/lib/imageProcessing.js)
//     or null — exactly like the Hero Photo.
//   - `sideAuto` is local only: true until the couple picks a side by hand, so
//     choosing a role can suggest one (Best Man → Groom's Party). Never saved.
//
// WHERE IT IS SAVED (see docs in CreateInvitation.jsx):
//   invitations/{weddingId}.partyMembers = [publicMember, ...]  (display order)
//     publicMember = { id, name, role, customRole, side, description, photo,
//                      isPointOfContact, showContact, publicPhone, publicEmail }
//     publicPhone / publicEmail are "" unless showContact is true. The
//     invitation document is publicly readable, so hidden contact details
//     must NEVER be written there.
//   invitations/{weddingId}/private/weddingPartyContacts  (owner only)
//     { contacts: { [memberId]: { phone, email } }, updatedAt }
//   invitations/{weddingId}.partyShowOnInvitation / .partyGroupBySide
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeSavedPhoto } from "@/lib/storyBlocks";

// ── Limits ────────────────────────────────────────────────────────────────────
export const PARTY_NAME_MAX = 80;
export const PARTY_CUSTOM_ROLE_MAX = 40;
export const PARTY_DESCRIPTION_MAX = 300;
export const PARTY_PHONE_MAX = 30;
export const PARTY_EMAIL_MAX = 254;
export const MAX_PARTY_MEMBERS = 40;

// ── Roles & sides ─────────────────────────────────────────────────────────────
// `side` is only a suggestion used when the couple hasn't picked a side yet.
export const PARTY_ROLES = [
  { id: "maidOfHonor",   label: "Maid of Honor",   side: "bride" },
  { id: "matronOfHonor", label: "Matron of Honor", side: "bride" },
  { id: "bestMan",       label: "Best Man",        side: "groom" },
  { id: "bridesmaid",    label: "Bridesmaid",      side: "bride" },
  { id: "groomsman",     label: "Groomsman",       side: "groom" },
  { id: "other",         label: "Other",           side: null },
];
export const PARTY_ROLE_IDS = PARTY_ROLES.map(r => r.id);

export const PARTY_SIDES = [
  { id: "bride", label: "Bride's Party" },
  { id: "groom", label: "Groom's Party" },
  { id: "other", label: "Other" },
];
export const PARTY_SIDE_IDS = PARTY_SIDES.map(s => s.id);
export const DEFAULT_PARTY_SIDE = "other";

export const getSideLabel = (sideId) => PARTY_SIDES.find(s => s.id === sideId)?.label || "Other";

/** Text shown for a member's role ("Other" uses the custom role). */
export const getRoleLabel = (member) => {
  if (!member) return "";
  if (member.role === "other") return (member.customRole || "").trim() || "Other";
  return PARTY_ROLES.find(r => r.id === member.role)?.label || "";
};

// ── Section settings (saved on the invitation doc) ────────────────────────────
// Shown by default (the section only appears once a member is added); one
// combined grid by default, optionally grouped by side.
export const DEFAULT_PARTY_SETTINGS = {
  partyShowOnInvitation: true,
  partyGroupBySide: false,
};
export const PARTY_SETTING_FIELDS = Object.keys(DEFAULT_PARTY_SETTINGS);

/** Strict booleans; older invitations (no fields) get the defaults. */
export const normalizePartySettings = (source = {}) => ({
  partyShowOnInvitation: source?.partyShowOnInvitation !== false,
  partyGroupBySide: source?.partyGroupBySide === true,
});

// ── Creating & normalizing ────────────────────────────────────────────────────
const newId = () => crypto.randomUUID();
const str = (v) => (typeof v === "string" ? v : "");

/** A brand-new, empty member (role must be chosen). */
export const createPartyMember = () => ({
  id: newId(),
  name: "",
  role: "",
  customRole: "",
  side: DEFAULT_PARTY_SIDE,
  description: "",
  photo: null,
  phone: "",
  email: "",
  showContact: false,
  isPointOfContact: false,
  sideAuto: true,
});

// Storage paths are built from the id, so only allow safe characters.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * normalizePartyMember
 * Stored public member (invitation doc) → local member. Tolerates garbage.
 * Contact details start from the PUBLIC copy (only present when shown); the
 * private copy is merged in later (mergePrivateContacts).
 */
export const normalizePartyMember = (raw) => {
  const m = raw && typeof raw === "object" ? raw : {};
  const role = PARTY_ROLE_IDS.includes(m.role) ? m.role : "";
  const showContact = m.showContact === true;
  return {
    id: typeof m.id === "string" && SAFE_ID.test(m.id) ? m.id : newId(),
    name: str(m.name),
    role,
    customRole: str(m.customRole),
    side: PARTY_SIDE_IDS.includes(m.side) ? m.side : DEFAULT_PARTY_SIDE,
    description: str(m.description),
    photo: normalizeSavedPhoto(m.photo),
    phone: showContact ? str(m.publicPhone) : "",
    email: showContact ? str(m.publicEmail) : "",
    showContact,
    isPointOfContact: m.isPointOfContact === true,
    sideAuto: false,
  };
};

/** Firestore array → local members. Duplicate ids are dropped; one point of contact max. */
export const normalizePartyMembers = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  let hasContactPerson = false;
  const out = [];
  for (const raw of list) {
    const m = normalizePartyMember(raw);
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    if (m.isPointOfContact) {
      if (hasContactPerson) m.isPointOfContact = false;
      hasContactPerson = true;
    }
    out.push(m);
  }
  return out;
};

// ── Editing helpers ───────────────────────────────────────────────────────────
/**
 * Apply a field change to one member. Choosing a role suggests a side until
 * the couple picks one by hand; picking a side by hand stops the suggestions.
 */
export const updatePartyMember = (member, field, value) => {
  const next = { ...member, [field]: value };
  if (field === "role" && member.sideAuto) {
    const suggested = PARTY_ROLES.find(r => r.id === value)?.side;
    if (suggested) next.side = suggested;
  }
  if (field === "side") next.sideAuto = false;
  return next;
};

/** Make `id` the only wedding-day point of contact (or clear it). */
export const setPointOfContact = (members, id, on) =>
  members.map(m => ({ ...m, isPointOfContact: on ? m.id === id : (m.id === id ? false : m.isPointOfContact) }));

// ── Validation ────────────────────────────────────────────────────────────────
/** A member with nothing filled in at all is dropped on save (like Travel places). */
export const isPartyMemberBlank = (m) =>
  !str(m.name).trim() && !m.role && !str(m.customRole).trim() && !str(m.description).trim() &&
  !m.photo && !str(m.phone).trim() && !str(m.email).trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_CHARS_RE = /^[0-9+()\-.\s]+$/;

export const isValidPartyEmail = (email) => {
  const e = str(email).trim();
  return e.length <= PARTY_EMAIL_MAX && EMAIL_RE.test(e);
};

export const isValidPartyPhone = (phone) => {
  const p = str(phone).trim();
  const digits = p.replace(/\D/g, "").length;
  return p.length <= PARTY_PHONE_MAX && PHONE_CHARS_RE.test(p) && digits >= 7 && digits <= 15;
};

/**
 * validatePartyMembers
 * → { [memberId]: { name?, role?, customRole?, phone?, email? } }
 * Blank members are skipped (they are dropped on save).
 */
export const validatePartyMembers = (members = []) => {
  const errors = {};
  for (const m of members) {
    if (isPartyMemberBlank(m)) continue;
    const e = {};
    if (!str(m.name).trim()) e.name = "Enter a name.";
    if (!m.role) e.role = "Choose a role.";
    else if (m.role === "other" && !str(m.customRole).trim()) e.customRole = "Enter the role, e.g. Flower Girl.";
    if (str(m.phone).trim() && !isValidPartyPhone(m.phone)) e.phone = "Enter a valid phone number, e.g. (214) 555-0123.";
    if (str(m.email).trim() && !isValidPartyEmail(m.email)) e.email = "Enter a valid email address.";
    if (Object.keys(e).length) errors[m.id] = e;
  }
  return errors;
};

// ── Saving ────────────────────────────────────────────────────────────────────
/** Trimmed copy of a local member (still local shape). */
const trimMember = (m) => ({
  ...m,
  name: str(m.name).trim().slice(0, PARTY_NAME_MAX),
  customRole: m.role === "other" ? str(m.customRole).trim().slice(0, PARTY_CUSTOM_ROLE_MAX) : "",
  description: str(m.description).trim().slice(0, PARTY_DESCRIPTION_MAX),
  phone: str(m.phone).trim().slice(0, PARTY_PHONE_MAX),
  email: str(m.email).trim().slice(0, PARTY_EMAIL_MAX),
});

/** Members that will be saved: blank ones dropped, text trimmed. */
export const cleanPartyMembersForSave = (members = []) =>
  members.filter(m => !isPartyMemberBlank(m)).map(trimMember);

/**
 * toStoredPartyMember
 * Local member → the public object written to invitations/{id}.partyMembers.
 * `photo` must already be a saved photo (or null). Contact details are only
 * copied when the couple turned "Show contact details" on.
 */
export const toStoredPartyMember = (member, photo = member.photo) => {
  const m = trimMember(member);
  const savedPhoto = normalizeSavedPhoto(photo);
  return {
    id: m.id,
    name: m.name,
    role: PARTY_ROLE_IDS.includes(m.role) ? m.role : "other",
    customRole: m.customRole,
    side: PARTY_SIDE_IDS.includes(m.side) ? m.side : DEFAULT_PARTY_SIDE,
    description: m.description,
    photo: savedPhoto,
    isPointOfContact: m.isPointOfContact === true,
    showContact: m.showContact === true,
    publicPhone: m.showContact === true ? m.phone : "",
    publicEmail: m.showContact === true ? m.email : "",
  };
};

/** Every stored photo referenced by a list of stored (or local, saved) members. */
export const collectPartyPhotos = (members = []) => {
  const out = [];
  for (const m of members) if (m?.photo?.path) out.push({ path: m.photo.path, bytes: m.photo.bytes || 0 });
  return out;
};

/** Bytes used by members' photos (pending ones counted by their compressed size). */
export const partyPhotoBytes = (members = []) =>
  members.reduce((n, m) => n + (m && !isPartyMemberBlank(m) && m.photo ? Number(m.photo.bytes) || 0 : 0), 0);

// ── Private contacts (owner-only doc) ─────────────────────────────────────────
/** { [id]: { phone, email } } for members that have any contact details. */
export const toPrivateContacts = (members = []) => {
  const out = {};
  for (const m of members) {
    const phone = str(m.phone).trim().slice(0, PARTY_PHONE_MAX);
    const email = str(m.email).trim().slice(0, PARTY_EMAIL_MAX);
    if (phone || email) out[m.id] = { phone, email };
  }
  return out;
};

/** Firestore data → { [id]: { phone, email } }. */
export const normalizePrivateContacts = (data) => {
  const raw = data?.contacts;
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, c] of Object.entries(raw)) {
    if (!c || typeof c !== "object") continue;
    const phone = str(c.phone);
    const email = str(c.email);
    if (phone || email) out[id] = { phone, email };
  }
  return out;
};

/** Fill members' phone/email from the private copy (it is the full record). */
export const mergePrivateContacts = (members, contacts) =>
  members.map(m => (contacts[m.id] ? { ...m, phone: contacts[m.id].phone, email: contacts[m.id].email } : m));

export const sameContacts = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sortKeys = (obj) => Object.fromEntries(Object.keys(obj || {}).sort().map(k => [k, obj[k]]));

// ── Display ───────────────────────────────────────────────────────────────────
/** Members the invitation shows: named and not blank. */
export const getVisiblePartyMembers = (members = []) =>
  members.filter(m => m && !isPartyMemberBlank(m) && str(m.name).trim());

/** Section visibility: toggle on AND at least one named member. */
export const shouldShowPartySection = (settings, members) =>
  settings?.partyShowOnInvitation !== false && getVisiblePartyMembers(members).length > 0;

/**
 * Groups for display. Combined (default) → one group without a label.
 * By side → Bride's Party, Groom's Party, Other (empty groups skipped).
 */
export const groupPartyMembers = (members, bySide = false) => {
  const visible = getVisiblePartyMembers(members);
  if (!bySide) return visible.length ? [{ id: "all", label: null, members: visible }] : [];
  return PARTY_SIDES
    .map(s => ({ id: s.id, label: s.label, members: visible.filter(m => (m.side || DEFAULT_PARTY_SIDE) === s.id) }))
    .filter(g => g.members.length > 0);
};

/**
 * Contact details guests may see — ONLY when showContact is on.
 * Returns { phone, email } (either may be "") or null.
 */
export const getShownContact = (member) => {
  if (!member?.showContact) return null;
  const phone = str(member.phone).trim();
  const email = str(member.email).trim();
  return phone || email ? { phone, email } : null;
};

/** tel: link — keeps digits and a leading +. */
export const phoneHref = (phone) => {
  const p = str(phone).trim();
  const plus = p.startsWith("+") ? "+" : "";
  return `tel:${plus}${p.replace(/\D/g, "")}`;
};

/** Initials for the placeholder avatar ("Jordan Lee" → "JL"). */
export const memberInitials = (name) =>
  str(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
