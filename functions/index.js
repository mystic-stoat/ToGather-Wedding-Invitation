/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore} = require("firebase-admin/firestore");
const {initializeApp} = require("firebase-admin/app");
const nodemailer = require("nodemailer");

// const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 5});
const SENDER = "TogatherInvites@mikulastik.live";

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}


// echo's text given to it
exports.echo = onRequest(async (req, res) => {
  // Send back a message that we've successfully written the message
  res.json({result: req.query.text});
});
// can be tested with: "curl <endpoint-url>?text=hello"

initializeApp();
const db = getFirestore();

exports.sendInvitesOnPublish = onDocumentUpdated("invitations/{invitationId}", async (event) => {
  // checks for if a change to the database was to a published invitation
  const before = event.data.before.data();
  const after = event.data.after.data();
  const invitationId = event.params.invitationId;

  console.log(`[${invitationId}] before.isPublished=${before.isPublished} after.isPublished=${after.isPublished}`);

  if (before.isPublished === after.isPublished) {
    console.log(`[${invitationId}] isPublished didn't change, skipping`);
    return;
  }
  if (!after.isPublished) {
    console.log(`[${invitationId}] flipped to false, skipping`);
    return;
  }

  // found newly published invitation
  console.log(`[${invitationId}] published, weddingId=${invitationId}`);

  // get the invitees who have not been an email yet
  const pendingSnap = await db.collection("invitee")
    .where("weddingId", "==", invitationId)
    .where("emailStatus", "in", ["pending", "failed"])
    .get();

  // const legacyNoEmailStatusSnap = await db.collection("invitee")
  //   .where("weddingId", "==", invitationId)
  //   .where("emailStatus", "==", null)
  //   .get();
  //
  // const allPendingDocs = [...pendingSnap, ...legacyNoEmailStatusSnap]


  console.log(`[${invitationId}] found ${pendingSnap.size} pending invitees`);
  pendingSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.email} (status: ${data.emailStatus})`);
  });

  // for each matching doc, create the email body
  const emails = pendingSnap.docs.map( invitee => ({
    // format data for email
    to: [`<${invitee.data().email}>`],
    sender: `"Togather" <${SENDER}>`,
    subject: "You're Invited!",
    html_body: `
      <h1>Hi there,</h1>
      <p>You're invited to our wedding!</p>
      <p><a href="https://togather-64b0b.web.app/rsvp/${invitee.id}/${invitee.data().token}"> RSVP here </a></p>
    `,
  }));

  if (emails.length <= 0) {
    console.log("no emails needed to be sent")
  } else {
    // create API POST request for SMTP2Go
    const res = await fetch("https://api.smtp2go.com/v3/email/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.SMTPGO_API,
        emails,
      }),
    });

    // get a response from server
    const body = await res.json();

    const batch = db.batch();

    if (res.ok) {
      //if everything success we can mark them as received!
      pendingSnap.forEach((doc) => {
        const docRef = db.collection("invitee").doc(doc.id);
        batch.update(docRef, { emailStatus: "received" });
      });
      await batch.commit();
    } else {
      // perhaps we could parse the resp body for specific failed addresses
      // right now we are just going to write off the whole block cause we can't make sure
      console.log("error sending emails:", body);
      pendingSnap.forEach((doc) => {
        const docRef = db.collection("invitee").doc(doc.id);
        batch.update(docRef, { emailStatus: "failed" });
      })
      await batch.commit();
      return;
    }

    console.log(JSON.stringify(body, null, 2));
  }


});