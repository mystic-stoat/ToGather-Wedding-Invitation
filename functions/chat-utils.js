
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
 
// Joins the text blocks of a Claude response.
const extractReplyText = (response) =>
  (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
 
module.exports = {
  isPlainText,
  newestUserMessageId,
  buildClaudeMessages,
  extractReplyText,
};
 