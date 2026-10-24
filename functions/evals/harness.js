// Runs ONE eval case through the same pieces a real chat turn uses, minus
// Firestore: the context builders, the tool list, the real proposeChange
// handler, and runToolLoop. Only the database is a stand-in, so validation
// errors reach Claude exactly as they do in production.
//
//   const run = await runCase(testCase, (system) => callClaude);
//   run -> {status, text, toolCalls, proposals, usage, error?}

const {
  buildWeddingContext, buildProposalsContext, extractTurnReply, slimTrace,
} = require("../chat-utils");
const {buildTools} = require("../tools");
const {runToolLoop} = require("../tool-loop");
const {createProposeChangeHandler} = require("../proposals");
const {buildSystemPrompt} = require("../assistant-config");

const UID = "eval-user";
const WEDDING_ID = "eval-wedding";

// Just enough of the Admin SDK's Firestore for createProposeChangeHandler:
// reading the invitation, querying pending proposals, and a write batch.
const makeFakeDb = (invitation) => {
  const proposals = [];
  let counter = 0;

  const query = (filters) => ({
    where: (field, op, value) => query([...filters, [field, value]]),
    get: async () => ({
      docs: proposals
          .filter((p) => filters.every(([f, v]) => p[f] === v))
          .map((p) => ({ref: p, data: () => p})),
    }),
  });

  const proposalsCollection = {
    doc: () => ({id: `proposal-${++counter}`}),
    where: (field, op, value) => query([]).where(field, op, value),
  };

  const db = {
    proposals,
    collection: (name) => {
      if (name === "invitations") {
        return {
          doc: () => ({
            get: async () => ({
              exists: invitation !== null,
              data: () => invitation,
              get: (field) => (invitation ? invitation[field] : undefined),
            }),
          }),
        };
      }
      return {doc: () => ({collection: () => proposalsCollection})};
    },
    batch: () => {
      const ops = [];
      return {
        update: (ref, data) => ops.push(() => Object.assign(ref, data)),
        set: (ref, data) => ops.push(() => proposals.push({id: ref.id, ...data})),
        commit: async () => ops.forEach((op) => op()),
      };
    },
  };
  return db;
};

const toMessages = (history) => history.map(({role, text}) => ({
  role,
  content: [{type: "text", text}],
}));

// `makeCall(system)` returns the callClaude function for this run: the real
// API in run.js, a scripted fake in the harness tests.
const runCase = async (testCase, makeCall, {now = new Date()} = {}) => {
  const invitation = testCase.invitation ?? {};
  const db = makeFakeDb(invitation);
  const toolCalls = [];

  const propose = createProposeChangeHandler({
    db, uid: UID, weddingId: WEDDING_ID, messageId: "eval-msg", now: () => now,
  });
  // Records every call and what came back, errors included.
  const proposeChange = async (input) => {
    try {
      const out = await propose(input);
      toolCalls.push({input, ok: true});
      return out;
    } catch (err) {
      toolCalls.push({input, ok: false, error: err.message});
      throw err;
    }
  };

  const system = buildSystemPrompt({
    weddingContext: buildWeddingContext(invitation),
    proposalsContext: buildProposalsContext({
      pending: testCase.pending ?? [],
      recent: testCase.decided ?? [],
      now,
    }),
  });

  try {
    const result = await runToolLoop({
      callClaude: makeCall(system),
      messages: toMessages(testCase.history),
      tools: buildTools({proposals: true}),
      toolHandlers: {proposeChange},
    });
    return {
      status: result.status,
      // same function production uses, so the eval sees what a user would
      text: extractTurnReply(result.trace, {toolErrors: result.toolErrors}),
      toolCalls,
      proposals: db.proposals,
      usage: result.usage,
      // stop reason + block types of every response, to see WHY a reply is
      // empty (for example a final thinking or search block with no text)
      trace: slimTrace(result.trace),
    };
  } catch (err) {
    return {
      status: "error", error: err.message, text: "", toolCalls,
      proposals: db.proposals, usage: null,
    };
  }
};

module.exports = {runCase, makeFakeDb};
