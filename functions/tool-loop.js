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

  const finish = (status, response) => ({
    status,
    response,
    trace,
    iterations: trace.length,
    usage: sumUsage(trace),
  });

  for (let i = 0; i < maxCalls; i++) {
    // Pass a copy: we keep pushing onto `convo` below, and a caller holding
    // the array it was given would otherwise see it change afterwards.
    // `tools` is built once by the caller and sent unchanged every time.
    const response = await callClaude({messages: [...convo], tools});
    trace.push(response);

    switch (response.stop_reason) {
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

