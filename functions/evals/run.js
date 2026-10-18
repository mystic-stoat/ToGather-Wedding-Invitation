// Runs the eval cases against the REAL model and prints a pass rate per case.
// Costs money and needs an API key, so it is not part of `npm test`:
//
//   cd functions
//   npm run eval                       all cases, 5 runs each
//   npm run eval -- --case pick-for-me --runs 3
//   npm run eval -- --verbose          also print the reply of failing runs
//   npm run eval -- --judge            also grade tone/reasoning with the
//                                      LLM judge, on cases that list `judges`
//
// The key comes from ANTHROPIC_API_KEY, functions/.env.local or
// functions/.secret.local.

const fs = require("node:fs");
const path = require("node:path");
const Anthropic = require("@anthropic-ai/sdk");
const {makeCallClaude, CLAUDE_MODEL} = require("../assistant-config");
const {runCase} = require("./harness");
const {buildCases} = require("./cases");
const {globalChecks} = require("./checks");
const {judgeRun, JUDGE_MODEL} = require("./judge");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const RUNS = Number(flag("runs") ?? 5);
const ONLY = flag("case");
const VERBOSE = args.includes("--verbose");
const JUDGE = args.includes("--judge");
const DEFAULT_THRESHOLD = 0.8;

// USD per million tokens, from the pricing table as of 2026-10-06. Only used
// for the estimate printed at the end; update it if prices change. Haiku's
// price is for prompts up to 100K tokens, which these never reach.
const PRICES = {
  "claude-haiku-5-5": {input: 0.10, output: 0.50},
  "claude-sonnet-5-5": {input: 2.00, output: 10.00},
};
const cost = (model, usage) => {
  const p = PRICES[model];
  if (!p || !usage) return 0;
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1e6;
};
const addUsage = (a, b) => ({
  input_tokens: a.input_tokens + (b?.input_tokens ?? 0),
  output_tokens: a.output_tokens + (b?.output_tokens ?? 0),
});
const NO_USAGE = {input_tokens: 0, output_tokens: 0};

// ANTHROPIC_API_KEY=... lines, like the emulator's env files.
const readApiKey = () => {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const name of [".env.local", ".secret.local"]) {
    try {
      const file = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
      const line = file.split("\n").find((l) => l.startsWith("ANTHROPIC_API_KEY="));
      if (line) return line.slice("ANTHROPIC_API_KEY=".length).trim();
    } catch (err) {
      // file missing: try the next one
    }
  }
  return null;
};

// Code checks first (global ones apply to every case), then the judge if
// asked for. A judge error is reported, not silently counted as a pass.
const gradeRun = async (testCase, run, create) => {
  const failures = [...globalChecks(), ...testCase.checks]
      .map((check) => check(run)).filter(Boolean);
  const judged = [];
  let judgeUsage = NO_USAGE;

  // No judge on a failed or empty reply: the code checks already report it,
  // and the judge would only repeat the same failure in other words.
  if (create && testCase.judges && run.status !== "error" && run.text) {
    for (const rubricName of testCase.judges) {
      try {
        const verdict = await judgeRun({create, rubricName, testCase, run});
        judgeUsage = addUsage(judgeUsage, verdict.usage);
        judged.push({rubricName, pass: verdict.pass, reason: verdict.reason});
        if (!verdict.pass) failures.push(`judge ${rubricName}: ${verdict.reason}`);
      } catch (err) {
        judged.push({rubricName, error: err.message});
        failures.push(`judge ${rubricName} errored: ${err.message}`);
      }
    }
  }
  return {run, failures: [...new Set(failures)], judged, judgeUsage,
    passed: failures.length === 0};
};

const main = async () => {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error("No API key. Set ANTHROPIC_API_KEY, or put " +
      "ANTHROPIC_API_KEY=... in functions/.env.local.");
    process.exit(1);
  }
  const client = new Anthropic({apiKey});
  const makeCall = (system) => makeCallClaude(client, system);
  const create = JUDGE ? (params) => client.messages.create(params) : null;

  const cases = buildCases().filter((tc) => !ONLY || tc.id === ONLY);
  if (!cases.length) {
    console.error(`No case named "${ONLY}".`);
    process.exit(1);
  }

  console.log(`Model: ${CLAUDE_MODEL}   runs per case: ${RUNS}` +
    (JUDGE ? `   judge: ${JUDGE_MODEL}` : "") + "\n");
  if (JUDGE) {
    const judged = cases.filter((tc) => tc.judges);
    if (!judged.length) {
      console.log("Note: --judge is on, but none of the selected cases list " +
        "`judges`, so the judge will not run.\n      Cases that use it: " +
        buildCases().filter((tc) => tc.judges).map((tc) => tc.id).join(", ") + "\n");
    }
  }
  const report = [];
  let belowThreshold = 0;
  let modelUsage = NO_USAGE;
  let judgeUsage = NO_USAGE;

  for (const testCase of cases) {
    // Runs of one case go in parallel; cases go one after another.
    const graded = await Promise.all(
        Array.from({length: RUNS}, () =>
          runCase(testCase, makeCall).then((run) => gradeRun(testCase, run, create))),
    );
    graded.forEach((g) => {
      modelUsage = addUsage(modelUsage, g.run.usage);
      judgeUsage = addUsage(judgeUsage, g.judgeUsage);
    });

    const passed = graded.filter((g) => g.passed).length;
    const rate = passed / RUNS;
    const threshold = testCase.threshold ?? DEFAULT_THRESHOLD;
    const ok = rate >= threshold;
    if (!ok) belowThreshold += 1;

    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.id}  ${passed}/${RUNS}` +
      `   ${testCase.why}`);

    // Group identical failure reasons so a repeated problem reads once.
    const reasons = new Map();
    graded.forEach((g) => g.failures.forEach((f) =>
      reasons.set(f, (reasons.get(f) || 0) + 1)));
    reasons.forEach((count, reason) => console.log(`        x${count}  ${reason}`));
    if (VERBOSE) {
      graded.filter((g) => !g.passed).slice(0, 2).forEach((g) =>
        console.log(`        reply: ${JSON.stringify(g.run.text)}`));
    }
    report.push({
      id: testCase.id, passed, runs: RUNS, threshold, ok,
      results: graded.map((g) => ({
        passed: g.passed, failures: g.failures, text: g.run.text,
        toolCalls: g.run.toolCalls, usage: g.run.usage, judged: g.judged,
        trace: g.run.trace,
      })),
    });
  }

  const modelCost = cost(CLAUDE_MODEL, modelUsage);
  const judgeCost = cost(JUDGE_MODEL, judgeUsage);
  const dir = path.join(__dirname, "results");
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({
    model: CLAUDE_MODEL, judge: JUDGE ? JUDGE_MODEL : null,
    usage: {model: modelUsage, judge: judgeUsage},
    estimatedCostUsd: {model: modelCost, judge: judgeCost},
    report,
  }, null, 2));

  console.log(`\n${cases.length - belowThreshold}/${cases.length} cases at ` +
    `or above their threshold. Details: ${path.relative(process.cwd(), file)}`);
  console.log(`Tokens: model ${modelUsage.input_tokens} in / ` +
    `${modelUsage.output_tokens} out` +
    (JUDGE ? `, judge ${judgeUsage.input_tokens} in / ${judgeUsage.output_tokens} out` : "") +
    `.  Estimated cost: $${(modelCost + judgeCost).toFixed(3)} ` +
    "(list prices as of 2026-10-06)");
  process.exit(belowThreshold ? 1 : 0);
};

main();
