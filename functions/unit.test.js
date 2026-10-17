// Unit tests: pure logic, no database, no network, no emulator.
// Run: npm test. One describe block per area; each block has its own requires,
// so the blocks don't share names.
//
// The database tests are in integration.test.js (npm run test:emu).
const {describe} = require("node:test");


describe("chat helpers", () => {
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
      venuePlaceId: "place-123",
    });
    assert.doesNotMatch(out, /secret-uid|example\.com|place-123/);
  });

  test("design fields show only when set and are never 'not yet set'", () => {
    const empty = buildWeddingContext({});
    assert.doesNotMatch(empty, /Primary color|Heading font|Story title/);
    const out = buildWeddingContext({
      colorPalette1: "#56642b", font1: "Lato", storyTitle: "How We Met",
    });
    assert.match(out, /Primary color: #56642b/);
    assert.match(out, /Heading font: Lato/);
    assert.match(out, /Story title: How We Met/);
  });

  test("lists are shown as JSON with ids, only known keys", () => {
    const out = buildWeddingContext({
      mealOptions: [{id: "m1", name: "Fish", description: "", secret: "x"}],
      registries: [],
    });
    assert.match(out,
        /Meal options: \[\{"id":"m1","name":"Fish","description":""\}\]/);
    assert.doesNotMatch(out, /secret|Gift registries/);
  });

  test("a list too long to show is not cut short", () => {
    const travelItems = Array.from({length: 30}, (_, i) => ({
      id: `t${i}`, name: "x".repeat(100), description: "y".repeat(300),
    }));
    const out = buildWeddingContext({travelItems});
    assert.match(out, /Travel & stay: \(too long to show/);
  });

  test("wedding context formats Timestamps and Dates", () => {
    const stamp = {toDate: () => new Date("2027-06-12T00:00:00Z")};
    const out = buildWeddingContext({
      weddingDate: stamp,
      inviteDeadline: new Date("2027-05-01T00:00:00Z"),
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
      inviteDeadline: "2027-05-01",
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
      inviteDeadline: {toDate: () => new Date("also not a date")},
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
});


describe("tool loop", () => {
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {runToolLoop, MAX_CALLS} = require("./tool-loop");

  const {fakeClaude, msg, toolUse} = require("./fake-claude");

  const start = [{role: "user", content: [{type: "text", text: "hello"}]}];

  test("end_turn: exactly one call", async () => {
    const claude = fakeClaude([msg("end_turn")]);
    const out = await runToolLoop({callClaude: claude, messages: start});
    assert.equal(claude.calls.length, 1);
    assert.equal(out.status, "done");
    assert.equal(out.iterations, 1);
  });

  test("pause_turn then end_turn: second request ends with the paused message", async () => {
    const paused = [{type: "text", text: "working..."}];
    const claude = fakeClaude([msg("pause_turn", paused), msg("end_turn")]);
    const out = await runToolLoop({callClaude: claude, messages: start});
    assert.equal(claude.calls.length, 2);
    const second = claude.calls[1];
    assert.deepEqual(second[second.length - 1], {
      role: "assistant",
      content: paused,
    });
    assert.equal(out.status, "done");
  });

  test("tool_use forever: stops at the cap", async () => {
    const claude = fakeClaude([toolUse()]);
    const out = await runToolLoop({callClaude: claude, messages: start});
    assert.equal(claude.calls.length, MAX_CALLS);
    assert.equal(out.status, "cap_reached");
  });

  test("unknown tool: error result goes back in the next request", async () => {
    const claude = fakeClaude([toolUse("nope", "abc"), msg("end_turn")]);
    await runToolLoop({callClaude: claude, messages: start});
    const last = claude.calls[1][claude.calls[1].length - 1];
    assert.equal(last.role, "user");
    assert.deepEqual(last.content, [{
      type: "tool_result",
      tool_use_id: "abc",
      content: "unknown tool",
      is_error: true,
    }]);
  });

  test("a registered tool runs and its output is returned", async () => {
    const claude = fakeClaude([toolUse("echo", "e1"), msg("end_turn")]);
    await runToolLoop({
      callClaude: claude,
      messages: start,
      toolHandlers: {echo: async () => "pong"},
    });
    const last = claude.calls[1][claude.calls[1].length - 1];
    assert.equal(last.content[0].content, "pong");
    assert.equal(last.content[0].is_error, undefined);
  });

  test("a throwing tool becomes an error result, not a crash", async () => {
    const claude = fakeClaude([toolUse("bad", "b1"), msg("end_turn")]);
    const out = await runToolLoop({
      callClaude: claude,
      messages: start,
      toolHandlers: {bad: async () => {
        throw new Error("boom");
      }},
    });
    const last = claude.calls[1][claude.calls[1].length - 1];
    assert.equal(last.content[0].is_error, true);
    assert.equal(last.content[0].content, "boom");
    assert.equal(out.status, "done");
  });

  test("multiple tool_use blocks: all results in ONE user message", async () => {
    const two = msg("tool_use", [
      {type: "tool_use", id: "a", name: "echo", input: {}},
      {type: "tool_use", id: "b", name: "echo", input: {}},
    ]);
    const claude = fakeClaude([two, msg("end_turn")]);
    await runToolLoop({
      callClaude: claude,
      messages: start,
      toolHandlers: {echo: async () => "ok"},
    });
    const last = claude.calls[1][claude.calls[1].length - 1];
    assert.deepEqual(last.content.map((r) => r.tool_use_id), ["a", "b"]);
  });

  test("max_tokens and refusal stop cleanly with their own status", async () => {
    const t = await runToolLoop({
      callClaude: fakeClaude([msg("max_tokens")]),
      messages: start,
    });
    assert.equal(t.status, "truncated");
    const r = await runToolLoop({
      callClaude: fakeClaude([msg("refusal")]),
      messages: start,
    });
    assert.equal(r.status, "refused");
  });

  test("an unexpected stop_reason throws", async () => {
    await assert.rejects(
        runToolLoop({callClaude: fakeClaude([msg("???")]), messages: start}),
        /Unexpected stop_reason/,
    );
  });

  test("trace keeps every response and usage is summed", async () => {
    const claude = fakeClaude([toolUse(), msg("end_turn")]);
    const out = await runToolLoop({callClaude: claude, messages: start});
    assert.equal(out.trace.length, 2);
    assert.deepEqual(out.usage, {input_tokens: 20, output_tokens: 10});
  });

  test("the caller's messages array is not mutated", async () => {
    const input = [...start];
    await runToolLoop({
      callClaude: fakeClaude([toolUse(), msg("end_turn")]),
      messages: input,
    });
    assert.equal(input.length, 1);
  });
  test("tools reach every call unchanged, and default to none", async () => {
    const tools = [{name: "echo"}];
    const claude = fakeClaude([toolUse("echo", "e1"), msg("end_turn")]);
    await runToolLoop({
      callClaude: claude,
      messages: start,
      tools,
      toolHandlers: {echo: async () => "ok"},
    });
    assert.deepEqual(claude.requests.map((r) => r.tools), [tools, tools]);

    const bare = fakeClaude([msg("end_turn")]);
    await runToolLoop({callClaude: bare, messages: start});
    assert.deepEqual(bare.requests[0].tools, []);
  });

  test("the fake refuses requests the real API would refuse", async () => {
    const claude = fakeClaude([msg("end_turn")]);
    const asked = [{type: "tool_use", id: "a", name: "x", input: {}}];
    const convo = (userContent) => [
      ...start,
      {role: "assistant", content: asked},
      {role: "user", content: userContent},
    ];
    const result = {type: "tool_result", tool_use_id: "a", content: "ok"};
    await assert.rejects(
        claude({messages: convo([{type: "text", text: "hi"}, result]), tools: []}),
        /only tool_result/);
    await assert.rejects(
        claude({messages: convo([{...result, tool_use_id: "zzz"}]), tools: []}),
        /need a result each/);
    await claude({messages: convo([result]), tools: []});
    await assert.rejects(
        claude({messages: start, tools: [{name: "other"}]}),
        /tools array changed/);
  });
});


describe("field registry (step 1)", () => {
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {
    FIELD_REGISTRY,
    proposableKeys,
    validateProposal,
  } = require("./field-registry");

  const now = new Date("2026-10-16T12:00:00Z");

  test("weddingDate accepts a future YYYY-MM-DD and today", () => {
    assert.deepEqual(validateProposal("weddingDate", " 2027-06-12 ", {now}),
        {ok: true, value: "2027-06-12"});
    assert.equal(validateProposal("weddingDate", "2026-10-16", {now}).ok, true);
  });

  test("weddingDate rejects past dates, bad formats, and fake dates", () => {
    const bads = ["2026-10-15", "June 12 2027", "2027-02-30", "2027-6-1", ""];
    for (const bad of bads) {
      const out = validateProposal("weddingDate", bad, {now});
      assert.equal(out.ok, false, bad);
      assert.match(out.message, /weddingDate/);
    }
  });

  test("venueName trims, and rejects empty or too long", () => {
    assert.deepEqual(validateProposal("venueName", "  The Barn "),
        {ok: true, value: "The Barn"});
    assert.equal(validateProposal("venueName", "   ").ok, false);
    assert.equal(validateProposal("venueName", "x".repeat(201)).ok, false);
  });

  test("isPublished can never be proposed", () => {
    for (const v of ["true", "false", "True", "yes"]) {
      assert.equal(validateProposal("isPublished", v).ok, false, v);
    }
    assert.ok(!proposableKeys().includes("isPublished"));
  });

  test("unknown fields are rejected and the error lists the allowed ones", () => {
    const out = validateProposal("userId", "someone-else");
    assert.equal(out.ok, false);
    assert.match(out.message, /Allowed: weddingDate, ceremonyTime, venueName,/);
  });

  test("ceremonyTime is stored as HH:MM and formatted 12-hour", () => {
    assert.deepEqual(validateProposal("ceremonyTime", "9:30"),
        {ok: true, value: "09:30"});
    assert.deepEqual(validateProposal("ceremonyTime", "16:05:00"),
        {ok: true, value: "16:05"});
    for (const bad of ["24:00", "12:60", "2pm", ""]) {
      assert.equal(validateProposal("ceremonyTime", bad).ok, false, bad);
    }
    assert.equal(FIELD_REGISTRY.ceremonyTime.format("00:15"), "12:15 AM");
    assert.equal(FIELD_REGISTRY.ceremonyTime.format("12:00"), "12:00 PM");
  });

  test("text fields trim and enforce their own limits", () => {
    assert.deepEqual(validateProposal("receptionName", " The Hall "),
        {ok: true, value: "The Hall"});
    assert.equal(validateProposal("greetingTitle", "x".repeat(101)).ok, false);
    const message = "x".repeat(1000);
    assert.equal(validateProposal("greetingMessage", message).ok, true);
    assert.equal(validateProposal("greetingMessage", "  ").ok, false);
    assert.equal(validateProposal("storyTitle", "x".repeat(61)).ok, false);
  });

  test("childrenPolicy accepts loose spellings and stores the key", () => {
    assert.deepEqual(validateProposal("childrenPolicy", "Adults only"),
        {ok: true, value: "adults_only"});
    assert.deepEqual(validateProposal("childrenPolicy", "ALLOWED"),
        {ok: true, value: "allowed"});
    assert.equal(validateProposal("childrenPolicy", "kids").ok, false);
    assert.equal(FIELD_REGISTRY.childrenPolicy.format("adults_only"),
        "Adults Only");
  });

  test("colors are normalized to lower-case #rrggbb", () => {
    assert.deepEqual(validateProposal("colorPalette1", "ABC"),
        {ok: true, value: "#aabbcc"});
    assert.deepEqual(validateProposal("colorPalette2", " #56642B "),
        {ok: true, value: "#56642b"});
    for (const bad of ["red", "#12345", "#ggg"]) {
      assert.equal(validateProposal("colorPalette1", bad).ok, false, bad);
    }
  });

  test("fonts must be invitation fonts, matched case-insensitively", () => {
    assert.deepEqual(validateProposal("font1", "great vibes"),
        {ok: true, value: "Great Vibes"});
    const out = validateProposal("font2", "Comic Sans");
    assert.equal(out.ok, false);
    assert.match(out.message, /Lato/);
  });

  describe("list fields", () => {
    let n = 0;
    const newId = () => `new-${++n}`;

    test("mealOptions: keeps known ids, replaces unknown ones", () => {
      n = 0;
      const current = [{id: "m1", name: "Fish", description: ""}];
      const out = validateProposal("mealOptions", JSON.stringify([
        {id: "m1", name: " Fish ", description: "Grilled"},
        {id: "made-up", name: "Pasta"},
        {name: "Salad"},
      ]), {current, newId});
      assert.deepEqual(out, {ok: true, value: [
        {id: "m1", name: "Fish", description: "Grilled"},
        {id: "new-1", name: "Pasta", description: ""},
        {id: "new-2", name: "Salad", description: ""},
      ]});
    });

    test("a repeated id is only kept once", () => {
      n = 0;
      const current = [{id: "m1", name: "Fish"}];
      const out = validateProposal("mealOptions",
          [{id: "m1", name: "A"}, {id: "m1", name: "B"}], {current, newId});
      assert.deepEqual(out.value.map((m) => m.id), ["m1", "new-1"]);
    });

    test("[] clears a list; non-arrays and bad JSON are rejected", () => {
      assert.deepEqual(validateProposal("registries", "[]"),
          {ok: true, value: []});
      for (const bad of ["Fish, Chicken", "{\"name\":\"x\"}", "[1]"]) {
        const out = validateProposal("mealOptions", bad);
        assert.equal(out.ok, false, bad);
      }
    });

    test("items are checked: required names, lengths, max items", () => {
      assert.equal(validateProposal("mealOptions", [{name: ""}]).ok, false);
      assert.equal(validateProposal("mealOptions",
          [{name: "x".repeat(61)}]).ok, false);
      assert.equal(validateProposal("mealOptions",
          Array.from({length: 11}, () => ({name: "x"}))).ok, false);
    });

    test("travelItems: unknown category is other, links are http(s)", () => {
      const out = validateProposal("travelItems",
          [{category: "spa", name: "The Inn", mapUrl: "https://maps.example"}],
          {newId: () => "t1"});
      assert.deepEqual(out.value, [{id: "t1", category: "other",
        name: "The Inn", mapUrl: "https://maps.example", description: ""}]);
      assert.equal(validateProposal("travelItems",
          [{name: "Inn", mapUrl: "javascript:alert(1)"}]).ok, false);
    });

    test("registries: url required, visible unless false", () => {
      const out = validateProposal("registries", [
        {name: "Zola", url: "https://zola.com/x"},
        {name: "Amazon", url: "https://amazon.com/x", isVisible: false},
      ], {newId: () => "r"});
      assert.deepEqual(out.value.map((r) => r.isVisible), [true, false]);
      assert.equal(validateProposal("registries", [{name: "Zola"}]).ok, false);
      assert.match(FIELD_REGISTRY.registries.format(out.value),
          /Amazon \(hidden\)/);
    });
  });

  test("sameStoredValue compares lists by content, ignoring key order", () => {
    const {sameStoredValue} = require("./field-registry");
    assert.ok(sameStoredValue([{id: "a", name: "x"}], [{name: "x", id: "a"}]));
    assert.ok(!sameStoredValue([{id: "a"}], [{id: "b"}]));
    assert.ok(sameStoredValue(undefined, null));
    assert.ok(!sameStoredValue("a", ["a"]));
  });
});


describe("tools (step 2)", () => {
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {buildTools} = require("./tools");
  const {proposableKeys} = require("./field-registry");

  test("search only by default; proposeChange only when flagged", () => {
    assert.deepEqual(buildTools().map((t) => t.name), ["web_search"]);
    assert.deepEqual(
        buildTools({proposals: true}).map((t) => t.name),
        ["web_search", "proposeChange"],
    );
  });

  test("proposeChange schema: required fields, enum = proposable keys", () => {
    const tool = buildTools({proposals: true})[1];
    const {properties, required} = tool.input_schema;
    assert.deepEqual(required, ["field", "newValue", "reason"]);
    assert.deepEqual(properties.field.enum, proposableKeys());
    assert.ok(!properties.field.enum.includes("isPublished"));
    assert.match(tool.description, /changes nothing/i);
    assert.match(tool.description, /never from web content/i);
  });
});


describe("tool loop with proposeChange (step 3)", () => {
  // Build step 3: the loop driving proposeChange, with the FAKE Claude and a
  // STUB handler that only says "queued" (the real handler is step 4).
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {runToolLoop} = require("./tool-loop");
  const {buildTools} = require("./tools");
  const {fakeClaude, msg} = require("./fake-claude");

  const QUEUED = "Proposal queued. The couple will see Accept/Reject buttons. " +
    "It is NOT applied yet.";
  const start = [{role: "user", content: [{type: "text", text: "June 12"}]}];
  const tools = buildTools({proposals: true});

  const propose = (id, field, newValue) => ({
    type: "tool_use",
    id,
    name: "proposeChange",
    input: {field, newValue, reason: "the couple said so"},
  });

  const run = (claude, extra = {}) => runToolLoop({
    callClaude: claude,
    messages: start,
    tools,
    toolHandlers: {proposeChange: async () => QUEUED},
    ...extra,
  });

  const lastOf = (messages) => messages[messages.length - 1];

  test("one proposal: 2 calls, answered with only a tool_result", async () => {
    const assistant = [
      {type: "text", text: "Let me suggest that."},
      propose("p1", "weddingDate", "2027-06-12"),
    ];
    const claude = fakeClaude([
      msg("tool_use", assistant),
      msg("end_turn", [{type: "text", text: "Waiting on your approval."}]),
    ]);
    const out = await run(claude);

    assert.equal(claude.calls.length, 2);
    assert.equal(out.status, "done");
    const second = claude.calls[1];
    assert.deepEqual(lastOf(second), {
      role: "user",
      content: [{type: "tool_result", tool_use_id: "p1", content: QUEUED}],
    });
    // The assistant turn before it is exactly what Claude sent.
    assert.deepEqual(second[second.length - 2],
        {role: "assistant", content: assistant});
  });

  test("mixed response: only client results go back, same tools", async () => {
    const mixed = [
      {type: "server_tool_use", id: "srv1", name: "web_search",
        input: {query: "barn venues"}},
      propose("p1", "venueName", "The Barn"),
    ];
    const claude = fakeClaude([msg("tool_use", mixed), msg("end_turn")]);
    await run(claude);

    const second = claude.calls[1];
    assert.deepEqual(lastOf(second).content.map((b) => b.type),
        ["tool_result"]);
    assert.deepEqual(lastOf(second).content[0].tool_use_id, "p1");
    assert.deepEqual(second[second.length - 2].content, mixed);
    assert.deepEqual(claude.requests[1].tools, claude.requests[0].tools);
    assert.deepEqual(claude.requests[0].tools, tools);
  });

  test("two proposals at once: ONE results message with two", async () => {
    const two = [
      propose("a", "weddingDate", "2027-06-12"),
      propose("b", "venueName", "The Barn"),
    ];
    const claude = fakeClaude([msg("tool_use", two), msg("end_turn")]);
    await run(claude);

    const results = lastOf(claude.calls[1]);
    assert.equal(results.role, "user");
    assert.deepEqual(results.content.map((r) => r.tool_use_id), ["a", "b"]);
    assert.equal(claude.calls.length, 2);
  });

  test("a proposal after a pause_turn still gets answered", async () => {
    const claude = fakeClaude([
      msg("pause_turn", [{type: "server_tool_use", id: "s", name: "web_search",
        input: {query: "x"}}]),
      msg("tool_use", [propose("p1", "venueName", "The Barn")]),
      msg("end_turn"),
    ]);
    const out = await run(claude);
    assert.equal(claude.calls.length, 3);
    assert.equal(out.status, "done");
  });

  test("tool_use with no client tool_use throws", async () => {
    const onlyServer = msg("tool_use", [
      {type: "server_tool_use", id: "s", name: "web_search", input: {}},
    ]);
    await assert.rejects(run(fakeClaude([onlyServer])), /without a client/);
  });
});


describe("proposals context (step 5)", () => {
  // Build step 5: what Claude is told about proposals each turn.
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {buildProposalsContext} = require("./chat-utils");

  const now = new Date("2026-10-16T12:00:00Z");
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const pendingVenue = {
    field: "venueName", oldValue: "Old Hall", newValue: "The Barn",
    status: "pending",
  };

  test("nothing pending and nothing decided: empty string", () => {
    assert.equal(buildProposalsContext({now}), "");
  });

  test("a pending proposal is listed as pending", () => {
    const out = buildProposalsContext({pending: [pendingVenue], now});
    assert.match(out, /Waiting for the couple's answer/);
    assert.match(out, /Venue: "The Barn" \(was "Old Hall"\) - pending/);
  });

  test("a recent decision is listed with its outcome", () => {
    const rejected = {
      field: "weddingDate", oldValue: null, newValue: "2027-06-12",
      status: "rejected", decidedAt: daysAgo(2),
    };
    const out = buildProposalsContext({recent: [rejected], now});
    assert.match(out, /Wedding date: "2027-06-12" \(was not set\) - rejected/);
  });

  test("decisions older than 14 days are left out", () => {
    const old = {...pendingVenue, status: "accepted", decidedAt: daysAgo(15)};
    assert.equal(buildProposalsContext({recent: [old], now}), "");
  });

  test("superseded proposals are not shown as decisions", () => {
    const replaced = {...pendingVenue, status: "superseded", decidedAt: daysAgo(1)};
    assert.equal(buildProposalsContext({recent: [replaced], now}), "");
  });

  test("only the 10 newest decisions are kept", () => {
    const many = Array.from({length: 12}, (_, i) => ({
      ...pendingVenue, newValue: `Venue ${i}`, status: "accepted",
      decidedAt: daysAgo(i % 13),
    }));
    const out = buildProposalsContext({recent: many, now});
    assert.equal(out.split("\n").filter((l) => l.startsWith("- ")).length, 10);
  });

  test("isPublished never appears, pending or decided", () => {
    const publish = {
      field: "isPublished", oldValue: false, newValue: true, status: "pending",
    };
    const decided = {...publish, status: "accepted", decidedAt: daysAgo(1)};
    assert.equal(
        buildProposalsContext({pending: [publish], recent: [decided], now}), "");
  });
});


describe("accept / reject decision (step 6)", () => {
  // Build step 6: the pure decision. No database.
  const test = require("node:test");
  const assert = require("node:assert/strict");
  const {decide} = require("./proposals");

  const pending = {status: "pending", oldValue: "Old Hall", newValue: "The Barn"};

  test("accept, field unchanged since the proposal: write", () => {
    assert.equal(decide("Old Hall", pending, "accept"), "write");
  });

  test("accept, field was empty then and still is: write", () => {
    assert.equal(decide(undefined, {...pending, oldValue: null}, "accept"),
        "write");
  });

  test("accept, but the field was edited since: stale", () => {
    assert.equal(decide("Edited By Hand", pending, "accept"), "stale");
  });

  test("reject: reject, whatever the field holds", () => {
    assert.equal(decide("Anything", pending, "reject"), "reject");
  });

  test("already decided: nothing happens again", () => {
    for (const status of ["accepted", "rejected", "superseded", "stale"]) {
      assert.equal(decide("Old Hall", {...pending, status}, "accept"),
          "already_decided");
    }
  });

  test("lists: same content writes (any key order), changed is stale", () => {
    const list = {...pending, oldValue: [{id: "m1", name: "Fish"}]};
    assert.equal(decide([{name: "Fish", id: "m1"}], list, "accept"), "write");
    assert.equal(decide([{id: "m1", name: "Beef"}], list, "accept"), "stale");
    assert.equal(decide([], list, "accept"), "stale");
  });
});
