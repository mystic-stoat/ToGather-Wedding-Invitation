/**
 * Allows for debugging of accept and reject proposed changes (w/o ui)
 * Accept or reject a proposal in the Firestore EMULATOR, standing in for the
 * Accept/Reject buttons (build step 8). Uses the same decideProposal the
 * buttons will use.
 *
 *   node dev/decide.js                        list pending proposals
 *   node dev/decide.js <accept|reject> [proposalId]
 *                                             decide one (default: newest pending)
 *
 * Environment: FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080),
 *              GCLOUD_PROJECT (default togather-64b0b)
 */
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {decideProposal} = require("../proposals");

initializeApp({projectId: process.env.GCLOUD_PROJECT || "togather-64b0b"});
const db = getFirestore();

async function main() {
  const [decision, wantedId] = process.argv.slice(2);

  // proposals live under betrothed/{uid}/proposals, so search every user
  const snap = await db.collectionGroup("proposals")
      .where("status", "==", "pending").get();
  const pending = snap.docs
      .map((d) => ({id: d.id, uid: d.ref.parent.parent.id, ...d.data()}))
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  if (!decision) {
    if (!pending.length) console.log("No pending proposals.");
    pending.forEach((p) => console.log(
        `${p.id}  ${p.field}: ${JSON.stringify(p.oldValue)} -> ` +
        `${JSON.stringify(p.newValue)}  (user ${p.uid})`));
    return;
  }

  const target = wantedId ?
    pending.find((p) => p.id === wantedId) : pending[0];
  if (!target) throw new Error("No matching pending proposal.");

  const invitation = db.collection("invitations").doc(target.weddingId);
  const before = (await invitation.get()).get(target.field);
  const action = await decideProposal({
    db, uid: target.uid, proposalId: target.id, decision,
  });
  const after = (await invitation.get()).get(target.field);

  console.log(`${decision} ${target.field} -> ${action}`);
  console.log(`invitations/${target.weddingId}.${target.field}: ` +
      `${JSON.stringify(before)} => ${JSON.stringify(after)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
