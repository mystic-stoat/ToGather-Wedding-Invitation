// Run with: cd functions && npm test

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildClaudeMessages,
  newestUserMessageId,
  extractReplyText,
  slimTrace,
  buildWeddingContext,
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
test("extractReplyText drops narration before the last search", () => {
  const res = {content: [
    {type: "text", text: "Let me look that up."},
    {type: "server_tool_use", name: "web_search", input: {}},
    {type: "web_search_tool_result", content: []},
    {type: "text", text: "The Barn is "},
    {type: "text", text: "open on Fridays.", citations: []},
  ]};
  assert.equal(extractReplyText(res), "The Barn is open on Fridays.");
});

test("slimTrace keeps stop reason, usage and block names only", () => {
  const out = slimTrace([{
    stop_reason: "end_turn",
    usage: {input_tokens: 1, output_tokens: 2},
    content: [
      {type: "server_tool_use", name: "web_search", input: {query: "x"}},
      {type: "web_search_tool_result", content: [{encrypted_content: "..."}]},
      {type: "text", text: "hi"},
    ],
  }]);
  assert.deepEqual(out[0].blocks, [
    "server_tool_use:web_search",
    "web_search_tool_result",
    "text",
  ]);
  assert.equal(JSON.stringify(out).includes("encrypted_content"), false);
});

test("wedding context lists known fields and the missing ones", () => {
  const out = buildWeddingContext({
    groomName: {first: "Sam" , last:"Lee"},
    venueName: "The Barn",
  });
  assert.match(out, /Partner one: Sam Lee/);
  assert.match(out, /Venue: The Barn/);
  assert.match(out, /Not yet set: .*Wedding date.*Ceremony time/);
  assert.ok(out.startsWith("<wedding_details>"));
  assert.ok(out.endsWith("</wedding_details>"));
});

test("wedding context with no invitation says nothing is entered", () => {
  assert.match(buildWeddingContext(null), /No wedding details entered yet/);
});

test("wedding context ignores fields outside the allowlist", () => {
  const out = buildWeddingContext({
    coupleNames: "Sam & Alex",
    userId: "secret-uid",
    venueURL: "https://example.com",
    registries: [{name: "x"}],
  });
  assert.doesNotMatch(out, /secret-uid|example\.com|registries/);
});

test("wedding context formats Timestamps and Dates", () => {
  const stamp = {toDate: () => new Date("2027-06-12T00:00:00Z")};
  const out = buildWeddingContext({
    weddingDate: stamp,
    rsvpDeadline: new Date("2027-05-01T00:00:00Z"),
  });
  assert.match(out, /Wedding date: 2027-06-12/);
  assert.match(out, /RSVP deadline: 2027-05-01/);
});

test("wedding context caps long user-typed values", () => {
  const out = buildWeddingContext({venueName: "x".repeat(5000)});
  assert.ok(out.length < 600);
});

test("wedding context formats name maps and skips blank parts", () => {
  const out = buildWeddingContext({
    groomName: {first: "Sam", middle: "", last: "Lee"},
    brideName: {first: "Alex", middle: "J", last: "Ng"},
  });
  assert.match(out, /Partner one: Sam Lee/);
  assert.match(out, /Partner two: Alex J Ng/);
  assert.doesNotMatch(out, /Not yet set:.*Partner/);
});

test("wedding context omits the 'Not yet set' line when everything is filled", () => {
  const out = buildWeddingContext({
    groomName: {first: "Sam", last: "Lee"},
    brideName: {first: "Alex", last: "Ng"},
    weddingDate: "2027-06-12",
    ceremonyTime: "16:00",
    venueName: "The Barn",
    venueAddress: "1 Farm Rd",
    receptionName: "The Hall",
    receptionAddress: "2 Town St",
    rsvpDeadline: "2027-05-01",
    childrenPolicy: "adults_only",
  });
  assert.doesNotMatch(out, /Not yet set/);
  assert.match(out, /Children policy: adults_only/);
});

test("wedding context keeps fields in the allowlist's display order", () => {
  const out = buildWeddingContext({
    childrenPolicy: "allowed",
    venueName: "The Barn",
    groomName: {first: "Sam"},
  });
  const at = (s) => out.indexOf(s);
  assert.ok(at("Partner one") < at("Venue:"));
  assert.ok(at("Venue:") < at("Children policy"));
});

test("blank and whitespace-only values count as not set", () => {
  const out = buildWeddingContext({venueName: "   ", venueAddress: ""});
  assert.doesNotMatch(out, /Venue: /);
  assert.match(out, /Not yet set: .*Venue.*Venue address/);
});

test("string values are trimmed", () => {
  const out = buildWeddingContext({venueName: "  The Barn  "});
  assert.match(out, /Venue: The Barn\n/);
});

test("invalid dates are treated as not set", () => {
  const out = buildWeddingContext({
    weddingDate: new Date("not a date"),
    rsvpDeadline: {toDate: () => new Date("also not a date")},
  });
  assert.doesNotMatch(out, /Wedding date: |RSVP deadline: /);
  assert.match(out, /Not yet set: .*Wedding date/);
});

test("numbers are passed through as text", () => {
  const out = buildWeddingContext({ceremonyTime: 1600});
  assert.match(out, /Ceremony time: 1600/);
});

test("unsupported value types (boolean, array, function) are not set", () => {
  const out = buildWeddingContext({
    venueName: true,
    venueAddress: ["a", "b"],
    receptionName: () => "x",
  });
  assert.doesNotMatch(out, /Venue: |Venue address: |Reception: /);
});

test("null and undefined fields are treated as not set", () => {
  const out = buildWeddingContext({venueName: null, venueAddress: undefined});
  assert.match(out, /Not yet set: .*Venue.*Venue address/);
});

test("name maps: first and last only, no double space", () => {
  const out = buildWeddingContext({groomName: {first: "Sam", last: "Lee"}});
  assert.match(out, /Partner one: Sam Lee\n/);
});

test("name maps: blank parts and non-string parts are skipped", () => {
  const out = buildWeddingContext({
    groomName: {first: " Sam ", middle: "  ", last: 42},
  });
  assert.match(out, /Partner one: Sam\n/);
});

test("an empty or unrecognised name map is treated as not set", () => {
  const out = buildWeddingContext({
    groomName: {first: "", middle: "", last: ""},
    brideName: {nickname: "Al"},
  });
  assert.doesNotMatch(out, /Partner one: |Partner two: /);
  assert.match(out, /Not yet set: Partner one, Partner two/);
});

test("name maps are capped like other values", () => {
  const out = buildWeddingContext({groomName: {first: "x".repeat(5000)}});
  assert.ok(out.length < 600);
});

test("an empty invitation object lists every field as not set", () => {
  const out = buildWeddingContext({});
  assert.match(out, /Not yet set: Partner one, Partner two, Wedding date/);
  assert.doesNotMatch(out, /No wedding details entered yet/);
});
