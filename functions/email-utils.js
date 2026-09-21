/**
 * Pure helpers with no Firebase dependencies, so they can be unit tested
 * with plain `node --test`.
 */

/**
 * Splits an array into consecutive chunks of at most `size` items.
 * Does not mutate the input.
 *
 * chunk([1,2,3,4,5], 2) -> [[1,2],[3,4],[5]]
 *
 * @param {Array} arr
 * @param {number} size  must be a positive integer
 * @return {Array[]}
 */
function chunk(arr, size) {
  // Guard: with size 0 the loop below would never advance (i += 0) and hang.
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Cheap sanity check; real validation belongs where emails are entered, defensive programming */
function hasUsableEmail(invitee) {
  return typeof invitee.email === "string" && invitee.email.includes("@");
}

/**
 * Invitee -> SMTP2GO email payload.
 * @param {{id: string, token: string, email: string}} invitee
 * @param {{sender: string, appUrl: string}} config
 */
function buildEmail(invitee, {sender, appUrl}) {
  const rsvpUrl = `${appUrl}/rsvp/${encodeURIComponent(invitee.id)}/` +
    `${encodeURIComponent(invitee.token)}`;

  return {
    to: [invitee.email],
    sender,
    subject: "You're Invited!",
    html_body: `
      <h1>Hi there,</h1>
      <p>You're invited to our wedding!</p>
      <p><a href="${rsvpUrl}">RSVP here</a></p>
    `,
    // Plain-text alternative helps deliverability and accessibility.
    text_body: `Hi there,\n\nYou're invited to our wedding!\n\nRSVP here: ${rsvpUrl}\n`,
  };
}

module.exports = {chunk, hasUsableEmail, buildEmail};