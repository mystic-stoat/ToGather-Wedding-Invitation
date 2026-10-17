// Tool definitions for the wedding assistant, and the one place that builds
// the `tools` array. Pure: no Firebase, no SDK. index.js builds the array once
// at the start of a turn and hands it to runToolLoop, which sends the SAME
// array on every call (the API rejects a resume request whose tools changed).

const {proposableKeys, INVITATION_FONTS} = require("./field-registry");

// Server tool: Anthropic runs the search, so there is no handler for it. The
// basic variant is used because the newer web_search_20260209 isn't listed for
// Haiku 5.5. max_uses caps cost per turn.
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
};

// Client tool: comes back to our code (toolHandlers.proposeChange).
const buildProposeChangeTool = () => ({
  name: "proposeChange",
  description:
    "Proposes a change to ONE wedding detail. This changes nothing by " +
    "itself: the couple sees Accept/Reject buttons and the detail is only " +
    "updated if they accept. Call once per field.\n" +
    "Design fields (colors, fonts, story title, greeting title and " +
    "message): when the couple asks you to choose or suggest, pick " +
    "concrete values yourself and propose them right away. They review " +
    "the proposal before anything changes, so don't ask permission first.\n" +
    "Facts (date, time, venue, reception, children policy) and lists " +
    "(meals, travel, registries): use only values the couple stated or " +
    "agreed to in this chat, never from web content alone. You may search " +
    "to suggest options, but propose only once they pick one.\n" +
    "venueName and receptionName change only the name, never the address, " +
    "map link or map pin. After proposing one, tell the couple to re-pick " +
    "the place in Wedding Details so those match.\n" +
    "In `reason`, say what the couple actually asked for or said. Never " +
    "claim they chose something they didn't. After proposing, tell them " +
    "it is waiting for their approval.",
  input_schema: {
    type: "object",
    properties: {
      field: {type: "string", enum: proposableKeys()},
      newValue: {
        type: "string",
        description:
          "The new value. Dates as YYYY-MM-DD; times as 24-hour HH:MM; " +
          "childrenPolicy as allowed or adults_only; colors as hex " +
          `(#56642b); fonts one of: ${INVITATION_FONTS.join(", ")}. ` +
          "mealOptions, travelItems and registries replace the WHOLE " +
          "list: send it as a JSON array, keeping each existing item's id " +
          "from <wedding_details> and leaving id out for new items.",
      },
      reason: {
        type: "string",
        description: "One short sentence: why this change.",
      },
    },
    required: ["field", "newValue", "reason"],
  },
});

// Flags are read ONCE per turn by the caller; nothing here looks at the
// environment, so the array can't change mid-turn.
const buildTools = ({proposals = false} = {}) => {
  const tools = [WEB_SEARCH_TOOL];
  if (proposals) tools.push(buildProposeChangeTool());
  return tools;
};

module.exports = {WEB_SEARCH_TOOL, buildProposeChangeTool, buildTools};
