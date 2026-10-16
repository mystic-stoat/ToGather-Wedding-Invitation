// The proposeChange handler: the ONLY thing the chat function does with
// wedding details. It never writes them. It validates, then records a
// `pending` proposal under betrothed/{uid}/proposals and says "queued".
// Applying a proposal is a separate act (accept, build step 6).
//
// Takes `db` as an argument (no Firebase import) so tests can pass the
// emulator's Firestore.

const {FieldValue} = require("firebase-admin/firestore");
const {validateProposal} = require("./field-registry");
const {
  buildProposalsContext,
  PROPOSAL_DECIDED_DAYS,
} = require("./chat-utils");

const MAX_PROPOSALS_PER_TURN = 5;
const MAX_REASON = 300;

const ProposalStatus = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  SUPERSEDED: "superseded",
  STALE: "stale",
});

const QUEUED_MESSAGE =
  "Proposal queued. The couple will see Accept/Reject buttons. " +
  "It is NOT applied yet.";

const proposalsRef = (db, uid) =>
  db.collection("betrothed").doc(uid).collection("proposals");

/**
 * Builds the handler for ONE chat turn. The per-turn count lives in this
 * closure, so a new turn starts from zero.
 *
 * Errors are thrown with a message written for Claude: the loop turns a
 * thrown error into an `is_error` tool_result.
 */
const createProposeChangeHandler = ({
  db, uid, weddingId, messageId, now = () => new Date(),
}) => {
  let written = 0;

  return async (input) => {
    const {field, newValue, reason} = input || {};

    if (written >= MAX_PROPOSALS_PER_TURN) {
      throw new Error(
          `Limit of ${MAX_PROPOSALS_PER_TURN} proposals per message reached. ` +
          "Tell the couple what you have proposed so far and ask what " +
          "they want to change next.");
    }

    const checked = validateProposal(field, newValue, {now: now()});
    if (!checked.ok) throw new Error(checked.message);

    // oldValue is read NOW so the card can show what is being replaced, and
    // so accept can later tell if the couple edited the field by hand.
    const invitation = await db.collection("invitations").doc(weddingId).get();
    if (!invitation.exists) {
      throw new Error("There is no invitation to change yet.");
    }
    const oldValue = invitation.get(field) ?? null;

    const collection = proposalsRef(db, uid);
    const older = await collection
        .where("field", "==", field)
        .where("status", "==", ProposalStatus.PENDING)
        .get();

    const batch = db.batch();
    older.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: ProposalStatus.SUPERSEDED,
        decidedAt: FieldValue.serverTimestamp(),
      });
    });
    batch.set(collection.doc(), {
      field,
      oldValue,
      newValue: checked.value,
      reason: String(reason ?? "").trim().slice(0, MAX_REASON),
      status: ProposalStatus.PENDING,
      messageId,
      weddingId,
      createdAt: FieldValue.serverTimestamp(),
      decidedAt: null,
    });
    await batch.commit();

    written += 1;
    return QUEUED_MESSAGE;
  };
};

// Reads what Claude needs to know about proposals and returns the
// <proposals> block. Two single-field queries, so no composite index is
// needed; decisions are fetched with slack and the builder keeps the newest 10.
const loadProposalsContext = async (db, uid, now = new Date()) => {
  const col = proposalsRef(db, uid);
  const cutoff = new Date(now.getTime() - PROPOSAL_DECIDED_DAYS * 86_400_000);
  const [pending, recent] = await Promise.all([
    col.where("status", "==", ProposalStatus.PENDING).get(),
    col.where("decidedAt", ">=", cutoff)
        .orderBy("decidedAt", "desc").limit(30).get(),
  ]);
  return buildProposalsContext({
    pending: pending.docs.map((d) => d.data()),
    recent: recent.docs.map((d) => d.data()),
    now,
  });
};

// --- Accepting / rejecting ---------------------------------------------------
// NOT a cloud function: the couple's click runs this. It is the only code path
// that writes a proposable field. A decision never creates a chat message, so
// it can't trigger the chat function.

// Pure: what should happen? One of write | reject | stale | already_decided.
//   write            accept, and the field still holds what it held when the
//                    proposal was made (oldValue)
//   stale            accept, but the field changed since (e.g. edited by hand)
const decide = (currentValue, proposal, decision) => {
  if (proposal.status !== ProposalStatus.PENDING) return "already_decided";
  if (decision === "reject") return "reject";
  if (decision !== "accept") throw new Error(`Unknown decision: ${decision}`);
  const same = (currentValue ?? null) === (proposal.oldValue ?? null);
  return same ? "write" : "stale";
};

// Reads the proposal and the current field, calls `decide`, then writes the
// field and/or the status, all in one transaction. Returns the action taken.
const decideProposal = ({db, uid, proposalId, decision}) =>
  db.runTransaction(async (tx) => {
    const proposalRef = proposalsRef(db, uid).doc(proposalId);
    const proposalSnap = await tx.get(proposalRef);
    if (!proposalSnap.exists) throw new Error("Proposal not found.");
    const proposal = proposalSnap.data();

    const invitationRef = db.collection("invitations").doc(proposal.weddingId);
    const invitationSnap = await tx.get(invitationRef);
    // No invitation any more: nothing to write to, so the proposal is stale.
    const action = invitationSnap.exists ?
      decide(invitationSnap.get(proposal.field), proposal, decision) :
      (proposal.status === ProposalStatus.PENDING ? "stale" :
        "already_decided");

    const status = {
      write: ProposalStatus.ACCEPTED,
      reject: ProposalStatus.REJECTED,
      stale: ProposalStatus.STALE,
    }[action];
    if (!status) return action; // already_decided: change nothing

    if (action === "write") {
      tx.update(invitationRef, {[proposal.field]: proposal.newValue});
    }
    tx.update(proposalRef, {
      status,
      decidedAt: FieldValue.serverTimestamp(),
    });
    return action;
  });

module.exports = {
  decide,
  decideProposal,
  createProposeChangeHandler,
  loadProposalsContext,
  ProposalStatus,
  QUEUED_MESSAGE,
  MAX_PROPOSALS_PER_TURN,
};
