/* eslint-disable camelcase -- field names follow the API (stop_reason) */
// A scripted stand-in for callClaude, shared by the tests and the demo.
// Replays `responses` in order (the last one repeats forever) and records
// every request. It also refuses requests the real API would refuse, so a
// loop bug fails here instead of in production.
//
//   const claude = fakeClaude([toolUse("proposeChange"), msg("end_turn")]);
//   await runToolLoop({callClaude: claude, messages, tools});
//   claude.calls     -> the `messages` array of each request
//   claude.requests  -> {messages, tools} of each request (deep copies)

const msg = (stop_reason, content = [{type: "text", text: "hi"}]) => ({
  stop_reason,
  content,
  usage: {input_tokens: 10, output_tokens: 5},
});

const toolUse = (name = "nope", id = "t1", input = {}) =>
  msg("tool_use", [{type: "tool_use", id, name, input}]);

const isResult = (b) => b.type === "tool_result";

// The API rules from "Handle tool calls", checked on the request's tail.
const checkRequest = ({messages, tools}, firstTools) => {
  if (JSON.stringify(tools) !== JSON.stringify(firstTools)) {
    throw new Error("400: the tools array changed between calls");
  }
  const last = messages[messages.length - 1];
  const prev = messages[messages.length - 2];
  if (!last || last.role !== "user" || !Array.isArray(last.content)) return;
  if (!last.content.some(isResult)) return;

  if (!last.content.every(isResult)) {
    throw new Error("400: tool_result message must hold only tool_result");
  }
  const asked = (prev && Array.isArray(prev.content) ? prev.content : [])
      .filter((b) => b.type === "tool_use").map((b) => b.id);
  const answered = last.content.map((b) => b.tool_use_id);
  if (asked.length !== answered.length ||
      !asked.every((id) => answered.includes(id))) {
    throw new Error(
        `400: tool_use ids [${asked}] need a result each, got [${answered}]`);
  }
};

const fakeClaude = (responses) => {
  const requests = [];
  const fn = async ({messages, tools}) => {
    const snapshot = structuredClone({messages, tools});
    checkRequest(snapshot, requests.length ? requests[0].tools : tools);
    requests.push(snapshot);
    return responses[Math.min(requests.length - 1, responses.length - 1)];
  };
  fn.requests = requests;
  Object.defineProperty(fn, "calls", {
    get: () => requests.map((r) => r.messages),
  });
  return fn;
};

module.exports = {fakeClaude, msg, toolUse};
