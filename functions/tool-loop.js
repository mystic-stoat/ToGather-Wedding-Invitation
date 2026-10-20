// Drives one assistant turn: call Claude, and if it asks for tools or pauses,
// keep going until it finishes or we hit the call cap. No Firebase and no
// SDK here: `callClaude({messages, tools})` is passed in, so tests can hand in
// a fake. `toolHandlers` covers CLIENT tools only; server tools (web_search)
// run inside the API call and need no handler.

const MAX_CALLS = 6;

// One tool_use block -> one tool_result block. Never throws: a failing tool
// becomes an error result Claude can see and react to.
const runOneTool = async (block, toolHandlers) => {
  const handler = toolHandlers[block.name];
  if (!handler) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: "unknown tool",
      is_error: true,
    };
  }
  try {
    const content = await handler(block.input);
    return {type: "tool_result", tool_use_id: block.id, content};
  } catch (err) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: err.message,
      is_error: true,
    };
  }
};

const sumUsage = (trace) =>
  trace.reduce(
      (total, r) => ({
        input_tokens: total.input_tokens + (r.usage?.input_tokens ?? 0),
        output_tokens: total.output_tokens + (r.usage?.output_tokens ?? 0),
      }),
      {input_tokens: 0, output_tokens: 0},
  );

// The API sometimes answers with client tool_use blocks but stop_reason
// "end_turn" (seen with Haiku 5.5 when it makes several calls at once). Trust
// the content: a call we never answer never runs, and the reply would promise
// Accept/Reject buttons that don't exist. A "max_tokens" response is left
// alone, since a cut-off tool call may be incomplete.
const effectiveStopReason = (response) => {
  const callsATool = (response.content || []).some((b) => b.type === "tool_use");
  const endedNormally = response.stop_reason === "end_turn" ||
    response.stop_reason === "stop_sequence";
  return callsATool && endedNormally ? "tool_use" : response.stop_reason;
};

// status: "done" | "truncated" | "refused" | "cap_reached"
// `response` is the last response received (what the reply doc displays).
const runToolLoop = async ({
  callClaude,
  messages,
  tools = [],
  toolHandlers = {},
  maxCalls = MAX_CALLS,
}) => {
  const convo = [...messages];
  const trace = [];
  let toolErrors = 0; // client tool calls that came back as errors

  const finish = (status, response) => ({
    status,
    response,
    trace,
    iterations: trace.length,
    usage: sumUsage(trace),
    toolErrors,
  });

  for (let i = 0; i < maxCalls; i++) {
    // Pass a copy: we keep pushing onto `convo` below, and a caller holding
    // the array it was given would otherwise see it change afterwards.
    // `tools` is built once by the caller and sent unchanged every time.
    const response = await callClaude({messages: [...convo], tools});
    trace.push(response);

    switch (effectiveStopReason(response)) {
      case "end_turn":
      case "stop_sequence":
        return finish("done", response);

      case "max_tokens":
        return finish("truncated", response);

      case "refusal":
        return finish("refused", response);

      case "pause_turn":
        // Server tool still working: send its progress back unchanged.
        convo.push({role: "assistant", content: response.content});
        break;

      case "tool_use": {
        // Whole content, not just the tool blocks (thinking blocks too).
        convo.push({role: "assistant", content: response.content});
        const toolBlocks = response.content.filter(
            (b) => b.type === "tool_use",
        );
        // Nothing for us to answer would mean an empty user message (a 400).
        if (toolBlocks.length === 0) {
          throw new Error("stop_reason tool_use without a client tool_use.");
        }
        const results = [];
        for (const block of toolBlocks) {
          results.push(await runOneTool(block, toolHandlers));
        }
        toolErrors += results.filter((r) => r.is_error).length;
        // ALL results in ONE user message.
        convo.push({role: "user", content: results});
        break;
      }

      default:
        throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }
  }

  return finish("cap_reached", trace[trace.length - 1]);
};

module.exports = {runToolLoop, MAX_CALLS};

