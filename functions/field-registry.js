// The one list of wedding fields the assistant may propose changes to, and
// the rules for each. Pure: no Firebase, no network. Every proposed value goes
// through `validate` before a proposal is written, and the stored value is the
// normalized one.
//
// validate(raw, {now, current, newId})
//   -> {ok: true, value} | {ok: false, message}
//   `message` goes back to Claude as the tool error, so it says what to fix.
//   `current` is the field's value right now (list fields use it to keep the
//   ids of items that already exist). `newId` makes ids for new list items
//   (tests pass a predictable one).
// format(value) -> short text for the proposal card and Claude's context.
//
// Several rules are copies of client code in src/lib/ (functions/ deploys on
// its own, so it can't import from src/). Each says which; keep them in step.

const {randomUUID} = require("node:crypto");

const MAX_TEXT = 200;
const MAX_TITLE = 100;
const MAX_MESSAGE = 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// One-digit hours are accepted and padded, since Claude may write "9:30".
const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
// Same as HEX_RE in src/lib/invitationTheme.js.
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Same values as CHILDREN_POLICY / CHILDREN_POLICY_LABELS in
// src/lib/rsvpOptions.js.
const CHILDREN_POLICY_LABELS = {
  allowed: "Kids Allowed",
  adults_only: "Adults Only",
};

// Same names as INVITATION_FONTS in src/lib/invitationTheme.js. Only these
// are ever put into a Google Fonts URL, so nothing else may be stored.
const INVITATION_FONTS = [
  "Playfair Display", "Noto Serif", "Cormorant Garamond", "Great Vibes",
  "Libre Baskerville", "DM Sans", "Manrope", "Lato", "Nunito",
  "Source Sans 3",
];

// Same as STORY_SECTION_TITLE_MAX in src/lib/storyBlocks.js.
const STORY_TITLE_MAX = 60;

// Same values as TRAVEL_CATEGORIES in src/lib/travelStay.js.
const TRAVEL_CATEGORIES = ["hotel", "restaurant", "airport", "other"];
const travelCategory = (value) =>
  (TRAVEL_CATEGORIES.includes(value) ? value : "other");

// Same rule as parseWeddingDate in src/lib/weddingDate.js.
const isRealDate = (value) => {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return year >= 1 && probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

// Same rule as isSafeHttpUrl in src/lib/travelStay.js and isValidRegistryUrl
// in src/lib/registry.js: absolute http(s) only.
const isSafeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (err) {
    return false;
  }
};

const fail = (message) => ({ok: false, message});

// Required free text: trimmed, non-empty, at most `max` characters.
const textField = (field, label, max) => ({
  proposable: true,
  label,
  validate: (raw) => {
    const value = String(raw).trim();
    if (!value) return fail(`${field} can't be empty.`);
    if (value.length > max) {
      return fail(`${field} must be ${max} characters or fewer.`);
    }
    return {ok: true, value};
  },
  format: (value) => String(value),
});

// Same rule as parseCeremonyTime in src/lib/weddingDate.js. Returns the
// stored "HH:MM" form, or null.
const normalizeTime = (raw) => {
  const m = TIME_RE.exec(String(raw).trim());
  if (!m) return null;
  const [hours, minutes] = [Number(m[1]), Number(m[2])];
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${m[2]}`;
};

// "14:30" -> "2:30 PM", like formatCeremonyTime on the client.
const formatTime = (value) => {
  const time = normalizeTime(value);
  if (!time) return String(value);
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

// Stored as "#rrggbb", lower case (normalizeHex on the client).
const colorField = (field, label) => ({
  proposable: true,
  label,
  validate: (raw) => {
    const value = String(raw).trim();
    if (!HEX_RE.test(value)) {
      return fail(`${field} must be a hex color like #56642b.`);
    }
    let hex = value.replace(/^#/, "").toLowerCase();
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return {ok: true, value: `#${hex}`};
  },
  format: (value) => String(value),
});

// Case-insensitive match, stored with the canonical spelling.
const fontField = (field, label) => ({
  proposable: true,
  label,
  validate: (raw) => {
    const wanted = String(raw).trim().toLowerCase();
    const value = INVITATION_FONTS.find((f) => f.toLowerCase() === wanted);
    if (!value) {
      return fail(`${field} must be one of: ${INVITATION_FONTS.join(", ")}.`);
    }
    return {ok: true, value};
  },
  format: (value) => String(value),
});

// --- List fields -----------------------------------------------------------
// A list proposal replaces the WHOLE list, so it fits the one-field
// old -> new model of proposals. newValue is the full list as a JSON array.
// An item whose id matches an item in the current list keeps that id (guests'
// RSVPs point at meal ids); any other item gets a new id from the server, so
// Claude can't invent or reuse ids.

const str = (v) => (typeof v === "string" ? v.trim() : "");

const parseList = (raw) => {
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }
  return Array.isArray(list) ? list : null;
};

// `cleanItem(item, i)` -> {ok, value} for one item (without its id).
const listField = ({
  field, label, maxItems, example, cleanItem, formatItem,
}) => ({
  proposable: true,
  label,
  isList: true,
  validate: (raw, {current, newId = randomUUID} = {}) => {
    const list = parseList(raw);
    if (!list) {
      return fail(`${field} must be the WHOLE list as a JSON array, ` +
        `e.g. ${example}. Use [] to clear it.`);
    }
    if (list.length > maxItems) {
      return fail(`${field} can have at most ${maxItems} items.`);
    }
    const known = new Set((Array.isArray(current) ? current : [])
        .map((item) => item && item.id).filter(Boolean));
    const used = new Set();
    const value = [];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return fail(`${field} item ${i + 1} must be an object.`);
      }
      const cleaned = cleanItem(item, i + 1);
      if (!cleaned.ok) return cleaned;
      const id = known.has(item.id) && !used.has(item.id) ? item.id : newId();
      used.add(id);
      value.push({id, ...cleaned.value});
    }
    return {ok: true, value};
  },
  format: (value) => {
    if (!Array.isArray(value) || !value.length) return "(none)";
    return value.map(formatItem).join("; ");
  },
});

// Checks one text property of a list item.
const itemText = (field, i, item, key, max, {required = false} = {}) => {
  const value = str(item[key]);
  const where = `${field} item ${i}: ${key}`;
  if (required && !value) return fail(`${where} is required.`);
  if (value.length > max) {
    return fail(`${where} must be ${max} characters or fewer.`);
  }
  return {ok: true, value};
};

const itemUrl = (field, i, item, key, {required = false} = {}) => {
  const value = str(item[key]);
  if (!value && !required) return {ok: true, value};
  if (!isSafeHttpUrl(value)) {
    return fail(`${field} item ${i}: ${key} must be a full http:// or ` +
      "https:// link.");
  }
  return {ok: true, value};
};

// Runs the checks for one item; the first failure wins.
const collect = (checks) => {
  const value = {};
  for (const [key, out] of checks) {
    if (!out.ok) return out;
    value[key] = out.value;
  }
  return {ok: true, value};
};

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

  // Stored as "HH:MM", 24-hour (what <input type="time"> writes).
  ceremonyTime: {
    proposable: true,
    label: "Ceremony time",
    validate: (raw) => {
      const value = normalizeTime(raw);
      if (!value) {
        return fail("ceremonyTime must be a 24-hour time written HH:MM.");
      }
      return {ok: true, value};
    },
    format: formatTime,
  },

  // Only the name: the address, URL and placeId come from the Google Places
  // picker, so a new name leaves the old map pin until the couple re-picks.
  venueName: textField("venueName", "Venue", MAX_TEXT),
  receptionName: textField("receptionName", "Reception", MAX_TEXT),

  greetingTitle: textField("greetingTitle", "Greeting title", MAX_TITLE),
  greetingMessage: textField("greetingMessage", "Greeting message",
      MAX_MESSAGE),

  // "allowed" | "adults_only". Loose spellings ("Adults only") are accepted.
  childrenPolicy: {
    proposable: true,
    label: "Children policy",
    validate: (raw) => {
      const value = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (!CHILDREN_POLICY_LABELS[value]) {
        return fail("childrenPolicy must be \"allowed\" or \"adults_only\".");
      }
      return {ok: true, value};
    },
    format: (value) => CHILDREN_POLICY_LABELS[value] || String(value),
  },

  // Changing one color or font on its own is fine: the builder then shows
  // the preset (themePreset / fontPreset) as customized.
  colorPalette1: colorField("colorPalette1", "Primary color"),
  colorPalette2: colorField("colorPalette2", "Secondary color"),
  font1: fontField("font1", "Heading font"),
  font2: fontField("font2", "Body font"),

  storyTitle: textField("storyTitle", "Story title", STORY_TITLE_MAX),

  // [{id, name, description}], like cleanMealOptionsForSave in
  // src/lib/rsvpOptions.js (limits from the builder's inputs).
  mealOptions: listField({
    field: "mealOptions",
    label: "Meal options",
    maxItems: 10,
    example: "[{\"name\":\"Chicken\",\"description\":\"Herb roasted\"}]",
    cleanItem: (item, i) => collect([
      ["name", itemText("mealOptions", i, item, "name", 60, {required: true})],
      ["description", itemText("mealOptions", i, item, "description", 140)],
    ]),
    formatItem: (m) =>
      (m.description ? `${m.name} (${m.description})` : m.name),
  }),

  // [{id, category, name, mapUrl, description}], like cleanTravelItemsForSave
  // in src/lib/travelStay.js. An unknown category becomes "other".
  travelItems: listField({
    field: "travelItems",
    label: "Travel & stay",
    maxItems: 20,
    example: "[{\"category\":\"hotel\",\"name\":\"The Inn\"," +
      "\"mapUrl\":\"https://...\",\"description\":\"Shuttle to venue\"}]",
    cleanItem: (item, i) => collect([
      ["category", {ok: true, value: travelCategory(item.category)}],
      ["name", itemText("travelItems", i, item, "name", 100, {required: true})],
      ["mapUrl", itemUrl("travelItems", i, item, "mapUrl")],
      ["description", itemText("travelItems", i, item, "description", 300)],
    ]),
    formatItem: (t) => `${t.name} (${t.category})`,
  }),

  // [{id, name, url, isVisible}] (src/lib/registry.js). New registries are
  // visible unless isVisible is false, like the Registry form.
  registries: listField({
    field: "registries",
    label: "Gift registries",
    maxItems: 20,
    example: "[{\"name\":\"Zola\",\"url\":\"https://...\",\"isVisible\":true}]",
    cleanItem: (item, i) => collect([
      ["name", itemText("registries", i, item, "name", 100, {required: true})],
      ["url", itemUrl("registries", i, item, "url", {required: true})],
      ["isVisible", {ok: true, value: item.isVisible !== false}],
    ]),
    formatItem: (r) => `${r.name}${r.isVisible ? "" : " (hidden)"}: ${r.url}`,
  }),

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

// Deep equality for stored values (strings, numbers, lists of plain maps).
// Map keys are compared in sorted order, since Firestore doesn't keep the
// order they were written in. Same rule as sameStoredValue in
// src/lib/firestore.js.
const sameStoredValue = (a, b) => {
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().map((k) => [k, canon(v[k])]);
    }
    return v === undefined ? null : v;
  };
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
};

module.exports = {
  FIELD_REGISTRY,
  proposableKeys,
  validateProposal,
  sameStoredValue,
  INVITATION_FONTS,
};
