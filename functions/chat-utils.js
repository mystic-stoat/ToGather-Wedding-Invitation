
// Pure helpers for the wedding assistant chat function: no Firebase, no
// network. Kept separate from index.js (like email-utils.js) so they can be
// unit-tested without the emulator.

const {FIELD_REGISTRY} = require("./field-registry");

// A message is sendable only if every block is non-empty text. Tool blocks
// will need their own handling when tool use arrives.
const isPlainText = (blocks) =>
  Array.isArray(blocks) &&
  blocks.length > 0 &&
  blocks.every(
      (b) => b && b.type === "text" &&
        typeof b.text === "string" && b.text.trim() !== "",
  );
 
// `docs` is newest-first (the order the query returns). Used for the
// double-submit guard: if the triggering message isn't the newest user
// message, a later message's own run answers with full context.
const newestUserMessageId = (docs) => {
  const found = docs.find((m) => m.role === "user");
  return found ? found.id : null;
};
 
// Turns the newest-first query result into the `messages` array for Claude:
//   1. flip to chronological order
//   2. keep only well-formed text messages (the API rejects empty text)
//   3. drop leading messages until the array starts with a user message
//      (a hard API requirement; it also keeps a future tool call from being
//      separated from its result)
const buildClaudeMessages = (docsNewestFirst) => {
  const usable = [...docsNewestFirst]
      .reverse()
      .filter((m) =>
        (m.role === "user" || m.role === "assistant") && isPlainText(m.content),
      );
 
  while (usable.length && usable[0].role !== "user") usable.shift();
 
  // Send only role + text blocks, never our own fields (status, createdAt...).
  return usable.map((m) => ({
    role: m.role,
    content: m.content.map((b) => ({type: "text", text: b.text})),
  }));
};
 
// Joins the text blocks of a Claude response. After a web search, only the
// text that follows the last search block is the answer; anything before it
// is narration like "Let me look that up". Citations split a sentence into
// several text blocks, so the pieces are joined with no separator.
const extractReplyText = (response) => {
  const content = response.content || [];
  const lastSearch = content.reduce(
      (last, b, i) =>
        (b.type === "server_tool_use" || b.type === "web_search_tool_result" ?
          i : last),
      -1,
  );
  return content
      .slice(lastSearch + 1)
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
};

// What we store on the reply doc: per response, the stop reason, usage, and
// block types. Search results are large and would risk Firestore's 1 MiB
// document limit, so their content is left out.
const slimTrace = (trace) =>
  trace.map((r) => ({
    stop_reason: r.stop_reason,
    usage: r.usage,
    blocks: (r.content || []).map((b) => (b.name ? `${b.type}:${b.name}` : b.type)),
  }));
 
// Invitation fields the assistant may see, in display order. An allowlist on
// purpose: the invitation doc also holds URLs, coordinates, user ids etc.
const WEDDING_CONTEXT_FIELDS = [
  ["groomName", "Partner one"],
  ["brideName", "Partner two"],
  ["weddingDate", "Wedding date"],
  ["ceremonyTime", "Ceremony time"],
  ["venueName", "Venue"],
  ["venueAddress", "Venue address"],
  ["receptionName", "Reception"],
  ["receptionAddress", "Reception address"],
  ["inviteDeadline", "RSVP deadline"],
  ["childrenPolicy", "Children policy"],
];
const WEDDING_CONTEXT_MAX_VALUE = 200; // user-typed text: cap what we forward

// Proposable fields that are optional or about the design. Shown only when
// set, and never listed as "Not yet set", so the assistant doesn't ask about
// them unprompted. [key, label, cap]
const WEDDING_CONTEXT_EXTRA_FIELDS = [
  ["greetingTitle", "Greeting title", WEDDING_CONTEXT_MAX_VALUE],
  ["greetingMessage", "Greeting message", 1000],
  ["storyTitle", "Story title", WEDDING_CONTEXT_MAX_VALUE],
  ["colorPalette1", "Primary color", WEDDING_CONTEXT_MAX_VALUE],
  ["colorPalette2", "Secondary color", WEDDING_CONTEXT_MAX_VALUE],
  ["font1", "Heading font", WEDDING_CONTEXT_MAX_VALUE],
  ["font2", "Body font", WEDDING_CONTEXT_MAX_VALUE],
];

// List fields, shown as JSON (with ids) so a proposal can keep the existing
// items. Only the item keys the registry knows are forwarded. A list too long
// to show in full is NOT cut short: a cut list proposed back would delete the
// missing items, so the assistant is told not to change it instead.
const WEDDING_CONTEXT_LISTS = [
  ["mealOptions", "Meal options", ["id", "name", "description"]],
  ["travelItems", "Travel & stay",
    ["id", "category", "name", "mapUrl", "description"]],
  ["registries", "Gift registries", ["id", "name", "url", "isVisible"]],
];
const WEDDING_CONTEXT_MAX_LIST = 6000;

const formatContextList = (list, keys) => {
  if (!Array.isArray(list)) return "";
  const items = list
      .filter((item) => item && typeof item === "object")
      .map((item) => Object.fromEntries(
          keys.filter((k) => item[k] !== undefined).map((k) => [k, item[k]])));
  if (!items.length) return "";
  const json = JSON.stringify(items);
  return json.length > WEDDING_CONTEXT_MAX_LIST ?
    "(too long to show; don't propose changes to this list)" : json;
};


const formatName = (name) =>
  ["first", "middle", "last"]
    .map((part) => typeof name[part] === "string" ? name[part].trim(): "")
    .filter(Boolean)
    .join(" ");

// Firestore Timestamp, Date or string -> a short readable string ("" if unusable).
const formatContextValue = (value, cap = WEDDING_CONTEXT_MAX_VALUE) => {
  if (value === null || value === undefined) return "";
  let v = value;
  if (typeof v.toDate === "function") v = v.toDate();
  if (typeof v === "object" && !(v instanceof Date)) return formatName(v).slice(0, WEDDING_CONTEXT_MAX_VALUE);
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  }
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v).trim().slice(0, cap);
};

// Builds the <wedding_details> block appended to the system prompt. Lists
// what is filled in AND what is still missing, so the assistant only asks
// about the gaps. `invitation` is null when the host has none yet.
const buildWeddingContext = (invitation) => {
  if (!invitation) {
    return "<wedding_details>\nNo wedding details entered yet.\n" +
      "</wedding_details>";
  }
  const known = [];
  const missing = [];
  for (const [key, label] of WEDDING_CONTEXT_FIELDS) {
    const value = formatContextValue(invitation[key]);
    if (value) known.push(`${label}: ${value}`);
    else missing.push(label);
  }
  for (const [key, label, cap] of WEDDING_CONTEXT_EXTRA_FIELDS) {
    const value = formatContextValue(invitation[key], cap);
    if (value) known.push(`${label}: ${value}`);
  }
  for (const [key, label, keys] of WEDDING_CONTEXT_LISTS) {
    const value = formatContextList(invitation[key], keys);
    if (value) known.push(`${label}: ${value}`);
  }
  const lines = [...known];
  if (missing.length) lines.push(`Not yet set: ${missing.join(", ")}`);
  return `<wedding_details>\n${lines.join("\n")}\n</wedding_details>`;
};

// --- Proposals in Claude's context -----------------------------------------
// Claude learns what the couple decided from the system prompt, never from a
// chat message (a decision is not a message). Pending proposals plus recent
// decisions, so it won't re-propose a pending or rejected value.

const PROPOSAL_DECIDED_DAYS = 14;
const PROPOSAL_DECIDED_MAX = 10;
// Decisions the couple made. "superseded" was replaced by a newer proposal,
// not decided, so it is left out.
const COUPLE_DECISIONS = ["accepted", "rejected", "stale"];

// Firestore Timestamp, Date, or millis -> millis (null if unusable).
const toMillis = (v) => {
  if (v && typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return typeof v === "number" ? v : null;
};

const describeValue = (field, value) => {
  if (value === null || value === undefined) return "not set";
  const text = FIELD_REGISTRY[field].format(value);
  return `"${String(text).slice(0, WEDDING_CONTEXT_MAX_VALUE)}"`;
};

const describeProposal = (p, tail) =>
  `- ${FIELD_REGISTRY[p.field].label}: ${describeValue(p.field, p.newValue)}` +
  ` (was ${describeValue(p.field, p.oldValue)}) ${tail}`;

// `pending`: all pending proposals. `recent`: proposals with a decidedAt,
// any status, any order. Returns "" when there is nothing to say.
// Only proposable fields are shown, so isPublished never appears here.
const buildProposalsContext = ({pending = [], recent = [], now = new Date()}) => {
  const known = (p) => FIELD_REGISTRY[p.field] && FIELD_REGISTRY[p.field].proposable;
  const cutoff = now.getTime() - PROPOSAL_DECIDED_DAYS * 24 * 60 * 60 * 1000;

  const decided = recent
      .filter((p) => known(p) && COUPLE_DECISIONS.includes(p.status))
      .filter((p) => (toMillis(p.decidedAt) ?? 0) >= cutoff)
      .sort((a, b) => toMillis(b.decidedAt) - toMillis(a.decidedAt))
      .slice(0, PROPOSAL_DECIDED_MAX);
  const waiting = pending.filter(known);

  if (!waiting.length && !decided.length) return "";
  const lines = [];
  if (waiting.length) {
    lines.push("Waiting for the couple's answer:");
    waiting.forEach((p) => lines.push(describeProposal(p, "- pending")));
  }
  if (decided.length) {
    lines.push(`Decided in the last ${PROPOSAL_DECIDED_DAYS} days:`);
    decided.forEach((p) => lines.push(describeProposal(p, `- ${p.status}`)));
  }
  return `<proposals>\n${lines.join("\n")}\n</proposals>`;
};

module.exports = {
  buildProposalsContext,
  PROPOSAL_DECIDED_DAYS,
  COUPLE_DECISIONS,
  isPlainText,
  newestUserMessageId,
  buildClaudeMessages,
  extractReplyText,
  slimTrace,
  buildWeddingContext,
};
 