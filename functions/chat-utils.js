
// Pure helpers for the wedding assistant chat function: no Firebase, no
// network. Kept separate from index.js (like email-utils.js) so they can be
// unit-tested without the emulator.
 
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
// purpose: the invitation doc also holds URLs, coordinates, registries etc.
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


const formatName = (name) =>
  ["first", "middle", "last"]
    .map((part) => typeof name[part] === "string" ? name[part].trim(): "")
    .filter(Boolean)
    .join(" ");

// Firestore Timestamp, Date or string -> a short readable string ("" if unusable).
const formatContextValue = (value) => {
  if (value === null || value === undefined) return "";
  let v = value;
  if (typeof v.toDate === "function") v = v.toDate();
  if (typeof v === "object" && !(v instanceof Date)) return formatName(v).slice(0, WEDDING_CONTEXT_MAX_VALUE);
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  }
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v).trim().slice(0, WEDDING_CONTEXT_MAX_VALUE);
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
  const lines = [...known];
  if (missing.length) lines.push(`Not yet set: ${missing.join(", ")}`);
  return `<wedding_details>\n${lines.join("\n")}\n</wedding_details>`;
};

module.exports = {
  isPlainText,
  newestUserMessageId,
  buildClaudeMessages,
  extractReplyText,
  slimTrace,
  buildWeddingContext,
};
 