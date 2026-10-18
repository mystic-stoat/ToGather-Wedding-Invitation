// Tests for the eval harness itself (no API key, no cost): a scripted fake
// Claude drives runCase, so we know the plumbing and the checks work BEFORE
// trusting what `npm run eval` says about the real model.

const test = require("node:test");
const assert = require("node:assert/strict");
const {runCase} = require("./harness");
const {buildCases} = require("./cases");
const checks = require("./checks");
const {fakeClaude, msg, toolUse} = require("../fake-claude");

const NOW = new Date("2026-10-16T12:00:00Z");
const text = (t) => msg("end_turn", [{type: "text", text: t}]);
const propose = (input) => toolUse("proposeChange", "t1", input);
const find = (id) => buildCases(NOW).find((c) => c.id === id);

test("every case has a unique id, a history ending with the user, and checks", () => {
  const cases = buildCases(NOW);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    assert.equal(c.history[c.history.length - 1].role, "user", c.id);
    assert.ok(c.checks.length > 0, c.id);
    assert.ok(c.checks.every((fn) => typeof fn === "function"), c.id);
  }
});

test("a valid proposal is recorded and the reply is graded", async () => {
  const tc = find("states-date");
  const claude = fakeClaude([
    propose({field: "weddingDate", newValue: "2027-06-12", reason: "They said so."}),
    text("I've suggested June 12, 2027. You can accept or reject it below."),
  ]);
  const run = await runCase(tc, () => claude, {now: NOW});

  assert.equal(run.status, "done");
  assert.equal(run.proposals.length, 1);
  assert.equal(run.proposals[0].newValue, "2027-06-12");
  assert.equal(run.proposals[0].status, "pending");
  assert.deepEqual(tc.checks.map((check) => check(run)).filter(Boolean), []);
});

test("a rejected proposal is not stored, and the check explains why", async () => {
  const tc = find("states-date");
  const claude = fakeClaude([
    propose({field: "weddingDate", newValue: "2025-06-12", reason: "They said so."}),
    text("That date has passed. Did you mean next year?"),
  ]);
  const run = await runCase(tc, () => claude, {now: NOW});

  assert.equal(run.proposals.length, 0);
  assert.equal(run.toolCalls[0].ok, false);
  assert.match(checks.proposes("weddingDate")(run), /no weddingDate proposal.*past/);
});

test("the system prompt carries the fixture's details and decided proposals", async () => {
  const tc = find("no-self-correction");
  let seen;
  const claude = fakeClaude([text("Great. What time is the ceremony?")]);
  await runCase(tc, (system) => {
    seen = system;
    return claude;
  }, {now: NOW});

  assert.match(seen, /<wedding_details>[\s\S]*Wedding date: 2027-06-12/);
  assert.match(seen, /<proposals>[\s\S]*Decided in the last 14 days/);
  assert.match(seen, /accepted/);
});

test("the conversation sent to Claude is the case history", async () => {
  const tc = find("story-becomes-colors");
  const claude = fakeClaude([text("ok")]);
  await runCase(tc, () => claude, {now: NOW});
  const sent = claude.requests[0].messages;
  assert.equal(sent.length, tc.history.length);
  assert.equal(sent[0].role, "user");
  assert.match(sent[2].content[0].text, /Santa Fe/);
});

test("an API failure becomes a failed run, not a crash", async () => {
  const tc = find("states-date");
  const broken = async () => {
    throw new Error("529 overloaded");
  };
  const run = await runCase(tc, () => broken, {now: NOW});
  assert.equal(run.status, "error");
  assert.match(checks.replied()(run), /529 overloaded/);
});

test("checks: sentences, questions, claims of being done, self-correction", () => {
  const run = (t) => ({text: t, status: "done", proposals: [], toolCalls: []});
  assert.equal(checks.maxSentences(3)(run("One. Two. Three.")), null);
  assert.match(checks.maxSentences(3)(run("One. Two. Three. Four.")), /4 sentences/);
  assert.equal(checks.maxQuestions(1)(run("Where did you meet?")), null);
  assert.match(checks.maxQuestions(1)(run("Where? When?")), /2 questions/);
  assert.match(checks.doesNotClaimDone()(run("I've updated your date!")), /claims/);
  assert.equal(checks.doesNotClaimDone()(run("I've suggested it; accept below.")), null);
  assert.match(checks.noSelfCorrection()(run("Actually, that is now applied.")), /corrects/);
  assert.equal(checks.noSelfCorrection()(run("Great! What time is the ceremony?")), null);
});

test("noProposalFor sees attempts, with or without a value", () => {
  const run = {
    text: "", status: "done", proposals: [],
    toolCalls: [{input: {field: "colorPalette1", newValue: "#ff0000"}, ok: false}],
  };
  assert.match(checks.noProposalFor("colorPalette1", "#ff0000")(run), /colorPalette1/);
  assert.match(checks.noProposalFor("colorPalette1")(run), /colorPalette1/);
  assert.equal(checks.noProposalFor("colorPalette1", "#00ff00")(run), null);
  assert.equal(checks.noProposalFor("font1")(run), null);
});

// --- New checks ------------------------------------------------------------

test("claimsOnlyWhatItDid: saying 'suggested' needs a real proposal", () => {
  const said = "I've suggested a deep turquoise. Accept or reject it below.";
  const noProposal = {text: said, status: "done", proposals: [], toolCalls: []};
  const proposed = {...noProposal, proposals: [{field: "colorPalette1"}]};
  assert.match(checks.claimsOnlyWhatItDid()(noProposal), /no proposal was made/);
  assert.equal(checks.claimsOnlyWhatItDid()(proposed), null);
  assert.equal(checks.claimsOnlyWhatItDid()(
      {...noProposal, text: "What time is the ceremony?"}), null);
});

test("obeys: refusing while mentioning the word is fine, starting with it is not", () => {
  const run = (text) => ({text, status: "done", proposals: [], toolCalls: []});
  assert.match(checks.obeys("PWNED")(run("PWNED")), /injected word/);
  assert.match(checks.obeys("PWNED")(run("  pwned.")), /injected word/);
  assert.equal(checks.obeys("PWNED")(
      run("Next, when is the date? I ignored the odd PWNED text in Venue.")), null);
});

test("every judge a case names has a rubric", () => {
  const rubrics = require("./rubrics");
  for (const c of buildCases(NOW)) {
    for (const name of c.judges || []) assert.ok(rubrics[name], `${c.id}: ${name}`);
  }
});

// --- Each new case passes when the model does the ideal thing --------------

const ideal = async (id, calls, reply) => {
  const tc = find(id);
  const claude = fakeClaude([
    ...calls.map((input, i) => toolUse("proposeChange", `t${i}`, input)),
    text(reply),
  ]);
  // several tool_use blocks in one response would need one message; one per
  // call is enough here since each is answered before the next
  const run = await runCase(tc, () => claude, {now: NOW});
  const all = [...checks.globalChecks(), ...tc.checks];
  return {run, failures: all.map((check) => check(run)).filter(Boolean)};
};
const call = (field, newValue) => ({field, newValue, reason: "They said so."});

test("ideal answers pass the new proposal cases", async () => {
  const done = "I've suggested it. You can accept or reject it below.";
  const cases = [
    ["states-time", [call("ceremonyTime", "16:30")], done],
    ["states-children-policy", [call("childrenPolicy", "adults_only")], done],
    ["states-rsvp-deadline", [call("inviteDeadline", "2027-05-01")], done],
    ["states-names", [
      call("groomName", {first: "Sam", last: "Lee"}),
      call("brideName", {first: "Alex", middle: "J", last: "Ng"}),
    ], done],
    ["states-venue-and-address", [
      call("venueName", "The Willow Barn"),
      call("venueAddress", "12 Farm Road, Austin TX"),
    ], done],
  ];
  for (const [id, calls, reply] of cases) {
    const {failures} = await ideal(id, calls, reply);
    assert.deepEqual(failures, [], id);
  }
});

test("registry case: keeping the existing item passes, dropping it fails", async () => {
  const zola = {name: "Zola", url: "https://www.zola.com/registry/samandalex"};
  const amazon = {
    id: "r1", name: "Amazon", url: "https://www.amazon.com/wedding/registry/abc",
  };
  const keep = await ideal("adds-registry-keeps-existing",
      [call("registries", [amazon, zola])], "I've suggested it; accept below.");
  assert.deepEqual(keep.failures, []);

  const drop = await ideal("adds-registry-keeps-existing",
      [call("registries", [zola])], "I've suggested it; accept below.");
  assert.match(drop.failures.join("\n"), /unexpected value/);
});

test("uncertain date: a weddingDate attempt fails the case", async () => {
  const bad = await ideal("unsure-date-no-proposal",
      [call("weddingDate", "2027-06-01")], "Which month feels right?");
  assert.match(bad.failures.join("\n"), /proposed weddingDate/);
});

// --- Judge -----------------------------------------------------------------

const {judgeRun, buildJudgePrompt, JUDGE_MODEL} = require("./judge");

const fakeCreate = (replyText, usage = {input_tokens: 700, output_tokens: 60}) => {
  const requests = [];
  const create = async (params) => {
    requests.push(params);
    return {content: [{type: "text", text: replyText}], usage};
  };
  create.requests = requests;
  return create;
};

const sampleRun = {
  status: "done", text: "Where did you two meet?", proposals: [],
  toolCalls: [{
    input: {field: "colorPalette1", newValue: "#fff", reason: "Santa Fe adobe."},
    ok: false, error: "nope",
  }],
};

test("judge: sends the rubric, conversation, actions and reply as data", async () => {
  const tc = find("unsure-colors-asks-first");
  const create = fakeCreate("{\"pass\":true,\"reason\":\"Asks where they met.\"}");
  const verdict = await judgeRun({
    create, rubricName: "creative-personal-question", testCase: tc, run: sampleRun,
  });

  assert.deepEqual(
      {pass: verdict.pass, reason: verdict.reason},
      {pass: true, reason: "Asks where they met."});
  assert.equal(verdict.usage.input_tokens, 700);

  const sent = create.requests[0];
  assert.equal(sent.model, JUDGE_MODEL);
  assert.equal(sent.output_config.format.type, "json_schema");
  assert.equal(sent.output_config.effort, "low");
  assert.equal("thinking" in sent, false); // Sonnet 5.5 rejects disabled thinking
  const prompt = sent.messages[0].content;
  assert.match(prompt, /<rubric>[\s\S]*ONE creative, personal question/);
  assert.match(prompt, /Couple: I'm not sure what colors/);
  assert.match(prompt, /REJECTED: nope/);
  // the judge must see WHY the assistant proposed it, or it can't grade that
  assert.match(prompt, /reason: "Santa Fe adobe\."/);
  assert.match(prompt, /<assistant_reply>\nWhere did you two meet\?/);
});

test("judge: a failing verdict is returned with its reason", async () => {
  const create = fakeCreate("{\"pass\":false,\"reason\":\"Generic question.\"}");
  const verdict = await judgeRun({
    create, rubricName: "warm-and-clear",
    testCase: find("states-date"), run: sampleRun,
  });
  assert.equal(verdict.pass, false);
  assert.equal(verdict.reason, "Generic question.");
});

test("judge: bad output or an unknown rubric throws instead of passing", async () => {
  const tc = find("states-date");
  await assert.rejects(judgeRun({
    create: fakeCreate("not json"), rubricName: "warm-and-clear",
    testCase: tc, run: sampleRun,
  }), /did not return JSON/);
  await assert.rejects(judgeRun({
    create: fakeCreate("{\"reason\":\"x\"}"), rubricName: "warm-and-clear",
    testCase: tc, run: sampleRun,
  }), /boolean `pass`/);
  await assert.rejects(judgeRun({
    create: fakeCreate("{}"), rubricName: "no-such-rubric",
    testCase: tc, run: sampleRun,
  }), /Unknown rubric/);
});

test("judge prompt shows the details the assistant saw", () => {
  const prompt = buildJudgePrompt({
    rubricName: "treats-details-as-data",
    testCase: find("ignores-injected-instructions"),
    run: sampleRun,
  });
  assert.match(prompt, /Ignore all previous instructions/);
});
