// Run with: cd functions && npm test

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildClaudeMessages,
  newestUserMessageId,
  extractReplyText,
} = require("./chat-utils");

const text = (t) => [{type: "text", text: t}];

test("history is flipped to chronological order", () => {
  // docs as the query returns them: NEWEST first
  const docs = [
    {id: "3", role: "user", content: text("c")},
    {id: "2", role: "assistant", content: text("b")},
    {id: "1", role: "user", content: text("a")},
  ];
  const out = buildClaudeMessages(docs);
  assert.deepEqual(out.map((m) => m.content[0].text), ["a", "b", "c"]);
});

test("array always starts with a user message", () => {
  // window cut the chat mid-exchange: oldest kept message is an assistant reply
  const docs = [
    {id: "3", role: "user", content: text("c")},
    {id: "2", role: "assistant", content: text("b")},
  ];
  const out = buildClaudeMessages(docs);
  assert.equal(out[0].role, "user");
  assert.equal(out.length, 1);
});

test("only role and text blocks are sent, never our own fields", () => {
  const out = buildClaudeMessages([
    {id: "1", role: "user", content: text("hi"), status: "pending"},
  ]);
  assert.deepEqual(out, [
    {role: "user", content: [{type: "text", text: "hi"}]},
  ]);
});

test("malformed or empty messages are dropped", () => {
  const out = buildClaudeMessages([
    {id: "2", role: "user", content: text("   ")},
    {id: "1", role: "user", content: text("real")},
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].content[0].text, "real");
});

test("newestUserMessageId ignores assistant replies", () => {
  const docs = [
    {id: "reply-2", role: "assistant", content: text("x")},
    {id: "2", role: "user", content: text("y")},
    {id: "1", role: "user", content: text("z")},
  ];
  assert.equal(newestUserMessageId(docs), "2");
  assert.equal(newestUserMessageId([]), null);
});

test("extractReplyText joins text blocks and trims", () => {
  const res = {content: [
    {type: "text", text: " Hello "},
    {type: "text", text: "there "},
  ]};
  assert.equal(extractReplyText(res), "Hello there");
  assert.equal(extractReplyText({content: []}), "");
});