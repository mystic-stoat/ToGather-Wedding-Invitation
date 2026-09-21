require('dotenv').config();

const SENDER = "TogatherInvites@mikulastik.live";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendInviteBatch(invitees) {
  const rsvpLink = "https://togather-64b0b.web.app/";

  const emails = invitees.map(invitee => ({
    to: [`<${invitee}>`],
    sender: `"Togather" <${SENDER}>`,
    subject: "You're Invited!",
    html_body: `
      <h1>Hi there,</h1>
      <p>You're invited to our wedding!</p>
      <p><a href="${rsvpLink}">RSVP here</a></p>
    `,
  }));

  const res = await fetch("https://api.smtp2go.com/v3/email/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.SMTP2GOApi,
      emails,
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.log("error sending emails:", body);
    return;
  }

  console.log(JSON.stringify(body, null, 2));
}

// actually run it
async function main() {
    console.log(process.env.SMTP2GOApi);
  const testInvitees = ["coltenmikulastik@my.unt.edu", "mikulastikc@gmail.com", "lightening414@gmail.com"]; // put a real test address here
  await sendInviteBatch(testInvitees);
}

main();