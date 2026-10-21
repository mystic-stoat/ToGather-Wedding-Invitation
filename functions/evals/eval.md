# Evaluating the wedding assistant

This folder checks what the **real model** does with our prompt and tools. It
is separate from `npm test` on purpose. This note explains why it is built the
way it is; the how-to-run lines are at the end.

## What we are evaluating, and what we are not

The assistant has two layers:

- **Our code around the model**: building history, validating proposed values,
  writing proposals, the tool loop. This is deterministic, so it is covered by
  ordinary tests (`unit.test.js`, `integration.test.js`) using a scripted fake
  Claude (`fake-claude.js`).
- **The model's behavior**: does it ask good questions, propose the right
  field, avoid claiming a change is done? No unit test can answer that. This is
  what the eval measures.

We evaluate the model, not the database. The eval chooses which tools to offer
and what the invitation looks like, so database and signup bugs (for example
"a new account has no invitation yet") do not affect it. Those belong in
regular tests and tickets.

## Choices and the reasoning behind them
- **Run the production path, not a copy.**
  - test what you ship, ship what you test

**Fake only Firestore.** 
  - bottleneck for no reason, even if its an emulator

**Prefer code checks to an LLM judge.** 
  - if we can deterministically judge, cheaper and faster than using better LLM.

**Use the LLM judge only for what code can't see.**
  - tone, how creative a question is, whether proposed colors really follow
    from the couple's story, whether the reply is honest about what it did
  - `judge.js` sends one run + one rubric (`rubrics.js`) to Sonnet 5.5, a
    stronger model than the Haiku being tested, so it isn't grading itself
  - it returns pass/fail plus a reason, saved in the results file
  - off by default: `--judge`, and only cases that list `judges` use it
  - read its reasons before trusting it; spot-check a few against your own
    opinion, and fix the rubric (not the threshold) if they disagree

**Global checks run on every case.**
  - the reply isn't empty, and it never says "I've suggested..." without a real
    proposal behind it (both seen in real runs)

**Run each case several times.**
  - probabilistic output means we have a distribution of answers
  - testing ~5 times and using a passing grade of 80% as threshold

**Cases are behaviors we already care about.** 
  - make sure we know that we can be consistant on specifc use cases
  - "set my wedding to be the 10/10/2026" shouldn't fail

Each case has a `why` line and
comes from something the prompt promises or something that already went wrong:
proposing instead of claiming "done", asking one personal question before
picking colors, not correcting itself after the couple accepts, treating
`<wedding_details>` as data not instructions, not re-proposing a rejected value,
and not asking about fields that are already filled in. When a real chat goes
badly, add a case for it; the `trace` on reply docs (emulator only) helps.

**How many cases?** Cost isn't the limit, attention is.
  - a 5-run pass over ~8 cases cost about $0.03 on Haiku 5.5; the runner
    prints the real token counts and an estimate every time
  - add a case when: a real chat went wrong, a prompt rule was added, or a new
    KIND of field arrived (date, time, name object, text, list...)
  - don't add one per field if fields share a validation path; a second case
    would only repeat the first
  - to check a prompt change, run the affected cases with `--runs 10` or more;
    5 runs can't tell a 95% case from a 70% one reliably

**Keep it out of `npm test` and CI for now.**
  - important to know we are paying for every evaluation

**Test the harness itself.** 
  - make sure how we are evaluating isn't broken

## Limits to keep in mind

- Keyword checks (for example "asks something personal") can fail a good reply
  that is worded differently. Read failing replies with `--verbose` before
  changing a threshold or the prompt.
- Thresholds are a starting point, not a measured baseline. Revisit them after
  the first few real runs.
- Results describe the model named in `assistant-config.js` on the day of the
  run. A model update can change them without any code change.

## Running it

```
cd functions
npm run eval                                  # all cases, 5 runs each
npm run eval -- --case pick-for-me --runs 3   # one case
npm run eval -- --verbose                     # also print failing replies
npm run eval -- --judge                       # also grade with the LLM judge
```

The key is read from `ANTHROPIC_API_KEY`, `functions/.env.local` or
`functions/.secret.local`.
Full results are written to `evals/results/` (gitignored).

## Files

| File | Role |
|---|---|
| `cases.js` | The situations and the checks each must pass |
| `checks.js` | Code-graded checks, each `(run) => null or a failure reason` |
| `rubrics.js` | What the LLM judge is asked about, with pass/fail examples |
| `judge.js` | Sends one run + rubric to the judge model, returns pass/fail + reason |
| `harness.js` | Runs one case through the production path with a fake database |
| `run.js` | Runs cases against the real API and prints pass rates |
| `harness.test.js` | Tests of the harness and checks; runs in `npm test`, no key |
