// src/lib/qa.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) for the Invitation Builder's "Q&A"
//   tab, its phone preview and the guest RSVP page: starter questions, answer
//   types, auto-filled answers, validation, and what guests may see.
//
// DATA (on the existing invitation document — no new collection):
//   invitations/{weddingId}.qaItems = [{
//     id, question,
//     answerType: "auto" | "text" | "section" | "url",
//     autoSource: "weddingDate" | "ceremonyTime" | "venue" | null,  (starters only)
//     text,                 custom text answer
//     section, note,        section link + optional short note
//     url, linkLabel,       external link + optional label
//     isVisible,            this question's own switch
//     starterKey,           which suggested question it came from (or null)
//   }]                      — display order
//   invitations/{weddingId}.qaShowOnInvitation = true | false
//       Only an explicit true shows the section (missing = OFF).
//   invitations/{weddingId}.qaStartersCreated  = true once starters were added,
//       so deleted starters never come back.
//
// AUTO-FILL answers are never stored: they are derived from the current
// invitation data every time they are shown, so editing Wedding Details or the
// Venue tab updates them automatically.
//
// GUESTS see a question only when: the section is ON, the question is ON, and
// its answer is complete ("ready"). Section links count only when that section
// is actually shown where the answer is displayed (the caller passes the
// available section ids), so no broken links ever appear.
// ─────────────────────────────────────────────────────────────────────────────

import { parseWeddingDate, formatCeremonyTime, parseCeremonyTime } from "@/lib/weddingDate";
import { getVenueDisplay } from "@/lib/venueDisplay";
import { isValidRegistryUrl } from "@/lib/registry";

// ── Limits ────────────────────────────────────────────────────────────────────
export const QA_MAX_ITEMS = 50;
export const QA_QUESTION_MAX = 200;
export const QA_TEXT_MAX = 1000;
export const QA_NOTE_MAX = 300;
export const QA_URL_MAX = 2048;
export const QA_LINK_LABEL_MAX = 60;

// ── Answer types ──────────────────────────────────────────────────────────────
export const ANSWER_TYPES = {
  AUTO: "auto",
  TEXT: "text",
  SECTION: "section",
  URL: "url",
};
export const ANSWER_TYPE_IDS = Object.values(ANSWER_TYPES);

export const ANSWER_TYPE_LABELS = {
  auto: "Auto-fill",
  text: "Custom text",
  section: "Link to section",
  url: "External link",
};

/** Data an auto-filled answer can come from (only invitation fields that exist). */
export const AUTO_SOURCES = {
  weddingDate:  { label: "Wedding date",  from: "Wedding Details" },
  ceremonyTime: { label: "Ceremony time", from: "Wedding Details" },
  venue:        { label: "Venue",         from: "Wedding Details and the Venue tab" },
};
export const AUTO_SOURCE_IDS = Object.keys(AUTO_SOURCES);

/** Guest-facing sections an answer can link to (ids match the preview's data-section). */
export const QA_SECTIONS = [
  { id: "date",     label: "Wedding Day" },
  { id: "venue",    label: "Venue" },
  { id: "travel",   label: "Travel & Stay" },
  { id: "story",    label: "Our Story" },
  { id: "party",    label: "Wedding Party" },
  { id: "rsvp",     label: "RSVP" },
  { id: "registry", label: "Registry" },
];
export const QA_SECTION_IDS = QA_SECTIONS.map(s => s.id);
export const getQaSectionLabel = (id) => QA_SECTIONS.find(s => s.id === id)?.label || "";

// ── Suggested starter questions (only features the app already has) ──────────
// Created ONCE per invitation, all hidden until the couple reviews them.
export const STARTER_QUESTIONS = [
  { starterKey: "when",     question: "When is the wedding?",               answerType: "auto",    autoSource: "weddingDate" },
  { starterKey: "time",     question: "What time does the ceremony start?", answerType: "auto",    autoSource: "ceremonyTime" },
  { starterKey: "where",    question: "Where is the wedding?",              answerType: "auto",    autoSource: "venue" },
  { starterKey: "stay",     question: "Where should I stay?",               answerType: "section", section: "travel" },
  { starterKey: "rsvp",     question: "How do I RSVP?",                     answerType: "section", section: "rsvp" },
  { starterKey: "registry", question: "Do you have a wedding registry?",    answerType: "section", section: "registry" },
  { starterKey: "party",    question: "Who is in the wedding party?",       answerType: "section", section: "party" },
];

// ── Section on/off ────────────────────────────────────────────────────────────
/** Only an explicit true shows the Q&A section (new and existing invitations start OFF). */
export const isQaSectionShown = (source) => source?.qaShowOnInvitation === true;

// ── Creating & normalizing ────────────────────────────────────────────────────
const newId = () => crypto.randomUUID();
const str = (v) => (typeof v === "string" ? v : "");
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A blank question (custom questions start visible; starters don't). */
export const createQaItem = (overrides = {}) => ({
  id: newId(),
  question: "",
  answerType: ANSWER_TYPES.TEXT,
  autoSource: null,
  text: "",
  section: null,
  note: "",
  url: "",
  linkLabel: "",
  isVisible: true,
  starterKey: null,
  ...overrides,
});

/** The starter questions as new items — all hidden until reviewed. */
export const buildStarterItems = () =>
  STARTER_QUESTIONS.map(s => createQaItem({ ...s, isVisible: false }));

/** Firestore value → clean item. Tolerates missing/garbage fields. */
export const normalizeQaItem = (raw) => {
  const r = raw && typeof raw === "object" ? raw : {};
  const autoSource = AUTO_SOURCE_IDS.includes(r.autoSource) ? r.autoSource : null;
  let answerType = ANSWER_TYPE_IDS.includes(r.answerType) ? r.answerType : ANSWER_TYPES.TEXT;
  // Auto-fill only exists for questions that have a data source.
  if (answerType === ANSWER_TYPES.AUTO && !autoSource) answerType = ANSWER_TYPES.TEXT;
  return {
    id: typeof r.id === "string" && SAFE_ID.test(r.id) ? r.id : newId(),
    question: str(r.question).slice(0, QA_QUESTION_MAX),
    answerType,
    autoSource,
    text: str(r.text).slice(0, QA_TEXT_MAX),
    section: QA_SECTION_IDS.includes(r.section) ? r.section : null,
    note: str(r.note).slice(0, QA_NOTE_MAX),
    url: str(r.url).slice(0, QA_URL_MAX),
    linkLabel: str(r.linkLabel).slice(0, QA_LINK_LABEL_MAX),
    isVisible: r.isVisible === true,
    starterKey: typeof r.starterKey === "string" ? r.starterKey : null,
  };
};

export const normalizeQaItems = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.map(normalizeQaItem).filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
};

// ── Editing ───────────────────────────────────────────────────────────────────
/**
 * Values from the Add/Edit form → the fields to save (trimmed, limited).
 * Fields of the other answer types are kept, so switching type back and forth
 * never loses what was typed.
 */
export const cleanQaInput = (values, { autoSource = null } = {}) => {
  const answerType = ANSWER_TYPE_IDS.includes(values.answerType) ? values.answerType : ANSWER_TYPES.TEXT;
  return {
    question: str(values.question).trim().slice(0, QA_QUESTION_MAX),
    answerType: answerType === ANSWER_TYPES.AUTO && !autoSource ? ANSWER_TYPES.TEXT : answerType,
    text: str(values.text).trim().slice(0, QA_TEXT_MAX),
    section: QA_SECTION_IDS.includes(values.section) ? values.section : null,
    note: str(values.note).trim().slice(0, QA_NOTE_MAX),
    url: str(values.url).trim().slice(0, QA_URL_MAX),
    linkLabel: str(values.linkLabel).trim().slice(0, QA_LINK_LABEL_MAX),
    isVisible: values.isVisible === true,
  };
};

/** Form validation → { question?, text?, section?, url? } (empty = OK to save). */
export const validateQaInput = (values) => {
  const errors = {};
  if (!str(values.question).trim()) errors.question = "Enter a question.";
  if (values.answerType === ANSWER_TYPES.TEXT && !str(values.text).trim()) {
    errors.text = "Enter an answer.";
  }
  if (values.answerType === ANSWER_TYPES.SECTION && !QA_SECTION_IDS.includes(values.section)) {
    errors.section = "Choose a section to link to.";
  }
  if (values.answerType === ANSWER_TYPES.URL) {
    if (!str(values.url).trim()) errors.url = "Enter a website address.";
    else if (!isValidRegistryUrl(values.url)) errors.url = "Enter a valid http:// or https:// URL.";
  }
  return errors;
};

/** Move the item with `id` up (-1) or down (+1). Returns a new array (same one if impossible). */
export const moveQaItemInList = (items, id, delta) => {
  const from = items.findIndex(i => i.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

// ── Answers ───────────────────────────────────────────────────────────────────
/**
 * Auto-filled answer from current invitation data.
 * `data` = the invitation (Wedding Details fields) merged with the builder's
 * live settings (Venue tab switches).
 * → { status: "ready", text } | { status: "missing" } | { status: "hidden" }
 */
export const getAutoAnswer = (autoSource, data = {}) => {
  switch (autoSource) {
    case "weddingDate": {
      const d = parseWeddingDate(data?.weddingDate);
      if (!d) return { status: "missing" };
      const text = new Date(d.year, d.month - 1, d.day).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
      return { status: "ready", text };
    }
    case "ceremonyTime": {
      if (!parseCeremonyTime(data?.ceremonyTime)) return { status: "missing" };
      return { status: "ready", text: `The ceremony starts at ${formatCeremonyTime(data.ceremonyTime)}.` };
    }
    case "venue": {
      const name = str(data?.venueName).trim();
      const address = str(data?.venueAddress).trim();
      if (!name && !address) return { status: "missing" };
      // Respect the Venue tab: never reveal what the couple chose to hide.
      const display = getVenueDisplay(data || {});
      if (!display.section) return { status: "hidden" };
      const parts = [name, display.address ? address : ""].filter(Boolean);
      if (!parts.length) return { status: "hidden" };
      return { status: "ready", text: parts.join(", ") };
    }
    default:
      return { status: "missing" };
  }
};

/**
 * Resolve one question's answer where it is being shown.
 * ctx = { data, availableSections: Set<sectionId> }
 * → { status, kind, text?, section?, sectionLabel?, url?, label? }
 *   status: "ready" | "incomplete" | "missing" | "hidden" | "sectionUnavailable"
 */
export const resolveQaAnswer = (item, ctx = {}) => {
  const available = ctx.availableSections || new Set();
  if (!str(item?.question).trim()) return { status: "incomplete", kind: item?.answerType };
  switch (item.answerType) {
    case ANSWER_TYPES.AUTO: {
      const a = getAutoAnswer(item.autoSource, ctx.data);
      return { ...a, kind: "text" };
    }
    case ANSWER_TYPES.TEXT:
      return str(item.text).trim()
        ? { status: "ready", kind: "text", text: item.text.trim() }
        : { status: "incomplete", kind: "text" };
    case ANSWER_TYPES.SECTION: {
      if (!QA_SECTION_IDS.includes(item.section)) return { status: "incomplete", kind: "section" };
      const base = {
        kind: "section", section: item.section, sectionLabel: getQaSectionLabel(item.section),
        text: str(item.note).trim(),
      };
      return available.has(item.section) ? { ...base, status: "ready" } : { ...base, status: "sectionUnavailable" };
    }
    case ANSWER_TYPES.URL: {
      if (!isValidRegistryUrl(item.url)) return { status: "incomplete", kind: "url" };
      let label = str(item.linkLabel).trim();
      if (!label) {
        try { label = new URL(item.url.trim()).hostname.replace(/^www\./, ""); } catch { label = item.url; }
      }
      return { status: "ready", kind: "url", url: item.url.trim(), label };
    }
    default:
      return { status: "incomplete", kind: item.answerType };
  }
};

/**
 * What guests see: [{ item, answer }] in the couple's order — only when the
 * section is ON, the question is ON and its answer is ready.
 */
export const getGuestQaItems = (items, ctx, sectionShown) => {
  if (!sectionShown) return [];
  return (Array.isArray(items) ? items : [])
    .filter(i => i?.isVisible === true)
    .map(item => ({ item, answer: resolveQaAnswer(item, ctx) }))
    .filter(x => x.answer.status === "ready");
};

/** Builder status text for a question (shown under it in the Q&A tab). */
export const describeQaStatus = (item, answer) => {
  switch (answer.status) {
    case "ready":
      return item.isVisible ? "Shown to guests" : (item.starterKey ? "Suggested — review, then switch on" : "Hidden from guests");
    case "missing":
      return `Information needed — add the ${AUTO_SOURCES[item.autoSource]?.label.toLowerCase() || "details"} in ${AUTO_SOURCES[item.autoSource]?.from || "Wedding Details"}`;
    case "hidden":
      return "Not shown — your Venue section (or its address) is hidden on the invitation";
    case "sectionUnavailable":
      return `Not shown — the ${answer.sectionLabel} section is hidden or empty right now`;
    default:
      return "Incomplete — add an answer";
  }
};
