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
const mailjet = require('node-mailjet').apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE,
)

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

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


// echo's text given to it
exports.echo = onRequest(async (req, res) => {
  // Send back a message that we've successfully written the message
  res.json({result: req.query.text});
  try {
    const result = mailjet
      .post("send", { version: "v3.1" })
      .request({
        Messages: [
          {
            From: {
              Email: "invites.togather@gmail.com",
            }
            ,
            To: [
              {
                Email: "coltenmikulastik@my.unt.edu",
              }
            ],
            Subject: "test",
            TextPart: "hey this is a test",
            HTMLPart: "<h3> what the hell </h3>"
          }
        ]
      })
  } catch (err) {
    console.log(err)
  }
});
// can be tested with: "curl <endpoint-url>?text=hello"

initializeApp();
const db = getFirestore();

exports.sendInvitesOnPublish = onDocumentUpdated("invitations/{invitationId}", async (event) => {
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

  console.log(`[${invitationId}] published, weddingId=${invitationId}`);

  const pendingSnap = await db.collection("invitee")
    .where("weddingId", "==", invitationId)
    .where("emailStatus", "in", ["pending", "failed"])
    .get();

  console.log(`[${invitationId}] found ${pendingSnap.size} pending invitees`);
  pendingSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.email} (status: ${data.emailStatus})`);
  });

  // stage 2 (sending) goes here next
});