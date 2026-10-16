// The one list of wedding fields the assistant may propose changes to, and
// the rules for each. Pure: no Firebase, no network. Every proposed value goes
// through `validate` before a proposal is written, and the stored value is the
// normalized one.
//
// validate(raw, {now}) -> {ok: true, value} | {ok: false, message}
//   `message` goes back to Claude as the tool error, so it says what to fix.
// format(value) -> short text for the proposal card and Claude's context.

const MAX_TEXT = 200;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Same rule as parseWeddingDate in src/lib/weddingDate.js (functions/ deploys
// on its own, so it can't import from src/). Keep the two in step.
const isRealDate = (value) => {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return year >= 1 && probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

const fail = (message) => ({ok: false, message});

const FIELD_REGISTRY = {
  // Stored as "YYYY-MM-DD" (what the date input on the client writes).
  weddingDate: {
    proposable: true,
    label: "Wedding date",
    validate: (raw, {now = new Date()} = {}) => {
      const value = String(raw).trim();
      if (!isRealDate(value)) {
        return fail("weddingDate must be a real date written YYYY-MM-DD.");
      }
      if (value < now.toISOString().slice(0, 10)) {
        return fail("weddingDate is in the past. Ask the couple to confirm.");
      }
      return {ok: true, value};
    },
    format: (value) => String(value),
  },

  venueName: {
    proposable: true,
    label: "Venue",
    validate: (raw) => {
      const value = String(raw).trim();
      if (!value) return fail("venueName can't be empty.");
      if (value.length > MAX_TEXT) {
        return fail(`venueName must be ${MAX_TEXT} characters or fewer.`);
      }
      return {ok: true, value};
    },
    format: (value) => String(value),
  },

  // Never proposable: publishing emails every invitee (sendInvitesOnPublish)
  // and can't be undone, so only the couple does it, from the app. Listed so
  // the exclusion is explicit and tested.
  isPublished: {
    proposable: false,
    label: "Published",
    validate: () => fail("isPublished can't be proposed."),
    format: (value) => (value ? "Published" : "Not published"),
  },
};

const proposableKeys = () =>
  Object.keys(FIELD_REGISTRY).filter((k) => FIELD_REGISTRY[k].proposable);

// Unknown or non-proposable keys get the same error a bad value would.
const validateProposal = (field, raw, opts) => {
  const entry = FIELD_REGISTRY[field];
  if (!entry || !entry.proposable) {
    return fail(`"${field}" can't be proposed. Allowed: ` +
      `${proposableKeys().join(", ")}.`);
  }
  return entry.validate(raw, opts);
};

module.exports = {FIELD_REGISTRY, proposableKeys, validateProposal};
