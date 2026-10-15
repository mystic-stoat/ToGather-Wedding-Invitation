const test = require("node:test");
const assert = require("node:assert/strict");
const {runToolLoop, MAX_CALLS} = require("./tool-loop");

const msg = (stop_reason, content = [{type: "text", text: "hi"}]) => ({
  stop_reason,
  content,
  usage: {input_tokens: 10, output_tokens: 5},
});
const toolUse = (name = "nope", id = "t1") =>
  msg("tool_use", [{type: "tool_use", id, name, input: {}}]);

// Replays `responses` in order (the last one repeats forever) and records
// every request it was given.
const fakeClaude = (responses) => {
  const calls = [];
  const fn = async (messages) => {
    calls.push(messages);
    return responses[Math.min(calls.length - 1, responses.length - 1)];
  };
  fn.calls = calls;
  return fn;
};

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