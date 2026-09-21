/**
 * Seeds the Firestore EMULATOR, publishes the invitation, and watches the
 * invitee statuses until the Cloud Function has finished.
 *
 *   node dev/seed.js [guestCount] [--bad]
 *
 *   guestCount   number of invitees to create (default 120 -> 3 batches of 50)
 *   --bad        also add 2 invitees with no email, to test that path
 *
 * Environment:
 *   FIRESTORE_EMULATOR_HOST  default 127.0.0.1:8080
 *   GCLOUD_PROJECT           default togather-64b0b (must match the emulator)
 */
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const crypto = require("node:crypto");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const projectId = process.env.GCLOUD_PROJECT || "togather-64b0b";
initializeApp({projectId});
const db = getFirestore();

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 120);
const withBad = args.includes("--bad");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function summarize(invitationId) {
  const snap = await db.collection("invitee")
      .where("weddingId", "==", invitationId).get();
  const counts = {};
  snap.docs.forEach((d) => {
    const s = d.get("emailStatus") ?? "(none)";
    counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
}

async function main() {
  const invitationId = `test-${Date.now()}`;
  console.log(`Project ${projectId}, emulator ${process.env.FIRESTORE_EMULATOR_HOST}`);

  // 1. Unpublished invitation: creating it must NOT trigger any emails.
  await db.collection("invitations").doc(invitationId).set({isPublished: false});

  // 2. Invitees (Firestore batches max out at 500 writes).
  const invitees = Array.from({length: count}, (_, i) => ({
    weddingId: invitationId,
    email: `guest${i + 1}@example.com`,
    token: crypto.randomUUID(),
    emailStatus: "pending",
  }));
  if (withBad) {
    invitees.push(
        {weddingId: invitationId, token: crypto.randomUUID(), emailStatus: "pending"},
        {weddingId: invitationId, email: "not-an-email", token: crypto.randomUUID(), emailStatus: "pending"},
    );
  }
  for (let i = 0; i < invitees.length; i += 500) {
    const batch = db.batch();
    invitees.slice(i, i + 500).forEach((inv) => batch.set(db.collection("invitee").doc(), inv));
    await batch.commit();
  }
  console.log(`Created invitation ${invitationId} with ${invitees.length} invitees (all pending)`);

  // 3. Publish -> this is what fires sendInvitesOnPublish.
  await sleep(500);
  await db.collection("invitations").doc(invitationId).update({isPublished: true});
  console.log("Published. Waiting for the function...");

  // 4. Poll until nothing is pending/sending (or we give up).
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(1000);
    const counts = await summarize(invitationId);
    console.log(`  t+${attempt + 1}s`, counts);
    if (!counts.pending && !counts.sending) {
      console.log("\nDone. Final statuses:", counts);
      console.log(`\nNext, simulate delivery results:\n  node dev/fake-webhook.js ${invitationId} --bounce 3`);
      return;
    }
  }
  console.log("\nTimed out waiting. Check the Functions emulator logs.");
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});