// Integration tests against the Firestore EMULATOR (run: npm run test:emu):
// proposeChange (step 4), the context loader (step 5), accept/reject (step 6).
// Skipped automatically when no emulator is running.
const test = require("node:test");
const assert = require("node:assert/strict");

const SKIP = !process.env.FIRESTORE_EMULATOR_HOST &&
  "no Firestore emulator (use npm run test:emu)";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {runToolLoop} = require("./tool-loop");
const {buildTools} = require("./tools");
const {fakeClaude, msg} = require("./fake-claude");
const {
  createProposeChangeHandler,
  QUEUED_MESSAGE,
  MAX_PROPOSALS_PER_TURN,
} = require("./proposals");

let db;
if (!SKIP) {
  initializeApp({projectId: process.env.GCLOUD_PROJECT || "demo-togather-test"});
  db = getFirestore();
}

const NOW = new Date("2026-10-16T12:00:00Z");
let counter = 0;

// A fresh user + invitation per test, so tests never see each other's data.
const setup = async (invitation = {}) => {
  const id = `${Date.now()}-${counter++}`;
  const [uid, weddingId] = [`user-${id}`, `wedding-${id}`];
  await db.collection("invitations").doc(weddingId)
      .set({userId: uid, isPublished: false, ...invitation});
  const handler = createProposeChangeHandler({
    db, uid, weddingId, messageId: "msg-1", now: () => NOW,
  });
  const proposals = async () => (await db.collection("betrothed").doc(uid)
      .collection("proposals").get()).docs.map((d) => ({id: d.id, ...d.data()}));
  const invitationDoc = async () =>
    (await db.collection("invitations").doc(weddingId).get()).data();
  return {uid, weddingId, handler, proposals, invitationDoc};
};

const ask = (handler, field, newValue, reason = "they said so") =>
  handler({field, newValue, reason});

test("valid proposal: pending doc, oldValue read, details untouched", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  const before = await t.invitationDoc();

  assert.equal(await ask(t.handler, "venueName", "  The Barn "), QUEUED_MESSAGE);

  const [p] = await t.proposals();
  assert.equal(p.field, "venueName");
  assert.equal(p.oldValue, "Old Hall");
  assert.equal(p.newValue, "The Barn"); // normalized
  assert.equal(p.status, "pending");
  assert.equal(p.messageId, "msg-1");
  assert.equal(p.weddingId, t.weddingId);
  assert.equal(p.decidedAt, null);
  assert.ok(p.createdAt);
  assert.deepEqual(await t.invitationDoc(), before);
});

test("inviteDeadline is checked against the stored wedding date", {skip: SKIP}, async () => {
  const t = await setup({weddingDate: "2027-06-12"});
  await assert.rejects(ask(t.handler, "inviteDeadline", "2027-07-01"),
      /on or before the wedding date/);
  await ask(t.handler, "inviteDeadline", "2027-05-01");
  assert.equal((await t.proposals())[0].newValue, "2027-05-01");
});

test("a name proposal keeps the old name as oldValue", {skip: SKIP}, async () => {
  const t = await setup({groomName: {first: "Sam", middle: "", last: "Lee"}});
  await ask(t.handler, "groomName", {first: "Samuel", last: "Lee"});
  const [p] = await t.proposals();
  assert.deepEqual(p.oldValue, {first: "Sam", middle: "", last: "Lee"});
  assert.deepEqual(p.newValue, {first: "Samuel", middle: "", last: "Lee"});
});

test("a field with no value yet gets oldValue null", {skip: SKIP}, async () => {
  const t = await setup();
  await ask(t.handler, "weddingDate", "2027-06-12");
  assert.equal((await t.proposals())[0].oldValue, null);
});

test("invalid value: error with the registry's message, no proposal", {skip: SKIP}, async () => {
  const t = await setup();
  await assert.rejects(ask(t.handler, "weddingDate", "2020-01-01"), /past/);
  await assert.rejects(ask(t.handler, "weddingDate", "next june"), /YYYY-MM-DD/);
  await assert.rejects(ask(t.handler, "isPublished", "true"), /can't be proposed/);
  await assert.rejects(ask(t.handler, "userId", "me"), /Allowed: /);
  assert.deepEqual(await t.proposals(), []);
});

test("same field twice: the first becomes superseded", {skip: SKIP}, async () => {
  const t = await setup();
  await ask(t.handler, "venueName", "The Barn");
  await ask(t.handler, "venueName", "The Hall");
  const all = await t.proposals();
  const byValue = Object.fromEntries(all.map((p) => [p.newValue, p]));
  assert.equal(byValue["The Barn"].status, "superseded");
  assert.ok(byValue["The Barn"].decidedAt);
  assert.equal(byValue["The Hall"].status, "pending");
});

test("supersede is per field, and a later TURN supersedes too", {skip: SKIP}, async () => {
  const t = await setup();
  await ask(t.handler, "venueName", "The Barn");
  await ask(t.handler, "weddingDate", "2027-06-12");
  // a new turn = a new handler (its count restarts)
  const nextTurn = createProposeChangeHandler({
    db, uid: t.uid, weddingId: t.weddingId, messageId: "msg-2",
    now: () => NOW,
  });
  await ask(nextTurn, "venueName", "The Hall");
  const status = Object.fromEntries(
      (await t.proposals()).map((p) => [p.newValue, p.status]));
  assert.deepEqual(status, {
    "The Barn": "superseded",
    "2027-06-12": "pending",
    "The Hall": "pending",
  });
});

test("more than 5 in a turn: extras get an instructive error", {skip: SKIP}, async () => {
  const t = await setup();
  for (let i = 0; i < MAX_PROPOSALS_PER_TURN; i++) {
    await ask(t.handler, "venueName", `Venue ${i}`);
  }
  await assert.rejects(ask(t.handler, "venueName", "One too many"),
      /Limit of 5 proposals/);
  assert.equal((await t.proposals()).length, MAX_PROPOSALS_PER_TURN);
});

test("no invitation: instructive error, no proposal", {skip: SKIP}, async () => {
  const uid = `lonely-${Date.now()}`;
  const handler = createProposeChangeHandler({
    db, uid, weddingId: "does-not-exist", messageId: "m", now: () => NOW,
  });
  await assert.rejects(ask(handler, "venueName", "X"), /no invitation/);
});

test("through the loop: two proposals, ONE results message", {skip: SKIP}, async () => {
  const t = await setup();
  const use = (id, field, newValue) => ({
    type: "tool_use", id, name: "proposeChange",
    input: {field, newValue, reason: "r"},
  });
  const claude = fakeClaude([
    msg("tool_use", [
      use("a", "weddingDate", "2027-06-12"),
      use("b", "venueName", "The Barn"),
      use("c", "weddingDate", "1999-01-01"), // invalid: error, not a crash
    ]),
    msg("end_turn", [{type: "text", text: "Both are waiting on you."}]),
  ]);

  const out = await runToolLoop({
    callClaude: claude,
    messages: [{role: "user", content: [{type: "text", text: "June 12, Barn"}]}],
    tools: buildTools({proposals: true}),
    toolHandlers: {proposeChange: t.handler},
  });

  assert.equal(out.status, "done");
  assert.equal(claude.calls.length, 2);
  const results = claude.calls[1].at(-1).content;
  assert.deepEqual(results.map((r) => r.tool_use_id), ["a", "b", "c"]);
  assert.deepEqual(results.map((r) => Boolean(r.is_error)),
      [false, false, true]);
  assert.equal((await t.proposals()).length, 2);
});

test("context: pending proposals show up, superseded ones do not", {skip: SKIP}, async () => {
  const {loadProposalsContext} = require("./proposals");
  const t = await setup({venueName: "Old Hall"});
  await ask(t.handler, "venueName", "The Barn");
  await ask(t.handler, "venueName", "The Hall"); // supersedes The Barn
  const out = await loadProposalsContext(db, t.uid, NOW);
  assert.match(out, /Venue: "The Hall" \(was "Old Hall"\) - pending/);
  assert.doesNotMatch(out, /The Barn/);
});

// --- Step 6: accept / reject ---
const {decideProposal} = require("./proposals");

const proposeVenue = async (t, value = "The Barn") => {
  await ask(t.handler, "venueName", value);
  return (await t.proposals()).find((p) => p.newValue === value).id;
};
const decide = (t, proposalId, decision) =>
  decideProposal({db, uid: t.uid, proposalId, decision});

test("accept: the field is written and the status is accepted", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  const id = await proposeVenue(t);
  assert.equal(await decide(t, id, "accept"), "write");
  assert.equal((await t.invitationDoc()).venueName, "The Barn");
  const [p] = await t.proposals();
  assert.equal(p.status, "accepted");
  assert.ok(p.decidedAt);
});

test("reject: nothing is written", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  const id = await proposeVenue(t);
  assert.equal(await decide(t, id, "reject"), "reject");
  assert.equal((await t.invitationDoc()).venueName, "Old Hall");
  assert.equal((await t.proposals())[0].status, "rejected");
});

test("double accept: the second does nothing", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  const id = await proposeVenue(t);
  await decide(t, id, "accept");
  assert.equal(await decide(t, id, "accept"), "already_decided");
  assert.equal(await decide(t, id, "reject"), "already_decided");
  assert.equal((await t.proposals())[0].status, "accepted");
});

test("field edited by hand, then accept: stale, nothing written", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  const id = await proposeVenue(t);
  await db.collection("invitations").doc(t.weddingId)
      .update({venueName: "Edited By Hand"});
  assert.equal(await decide(t, id, "accept"), "stale");
  assert.equal((await t.invitationDoc()).venueName, "Edited By Hand");
  assert.equal((await t.proposals())[0].status, "stale");
});

test("accept and reject create no chat message", {skip: SKIP}, async () => {
  const t = await setup({venueName: "Old Hall"});
  await decide(t, await proposeVenue(t, "A"), "accept");
  await decide(t, await proposeVenue(t, "B"), "reject");
  const messages = await db.collection("betrothed").doc(t.uid)
      .collection("messages").get();
  assert.equal(messages.size, 0);
});
