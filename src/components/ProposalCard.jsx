// src/components/ProposalCard.jsx
// One change the assistant has PROPOSED, with Accept / Reject buttons. Nothing
// is applied until the couple clicks Accept (see decideProposal in
// src/lib/firestore.js).

import { formatCeremonyTime } from "@/lib/weddingDate";
import { CHILDREN_POLICY_LABELS } from "@/lib/rsvpOptions";
import { getTravelCategoryLabel } from "@/lib/travelStay";

// The assistant changes the name only. The address, map link and pin come from
// the Google place picker, so they stay on the old place until it is re-picked.
const PLACE_NOTE =
  "This changes the name only. After accepting, re-pick the place in Wedding Details so the address and map match.";

// Same idea for the address text: the map link and pin stay on the old place.
const ADDRESS_NOTE =
  "This changes the address text only. After accepting, re-pick the place in Wedding Details so the map link and pin match.";

// Only fields the assistant can propose (functions/field-registry.js). A field
// missing here gets no card at all, so keep this in step with the registry.
// `kind` picks how the value is shown (plain text when missing); `note` is
// shown under the change.
const FIELDS = {
  groomName:        { label: "Partner one", kind: "name" },
  brideName:        { label: "Partner two", kind: "name" },
  weddingDate:      { label: "Wedding date" },
  inviteDeadline:   { label: "RSVP deadline" },
  venueAddress:     { label: "Venue address", note: ADDRESS_NOTE },
  receptionAddress: { label: "Reception address", note: ADDRESS_NOTE },
  ceremonyTime:    { label: "Ceremony time", kind: "time" },
  venueName:       { label: "Venue", note: PLACE_NOTE },
  receptionName:   { label: "Reception", note: PLACE_NOTE },
  greetingTitle:   { label: "Greeting title" },
  greetingMessage: { label: "Greeting message" },
  childrenPolicy:  { label: "Children policy", kind: "children" },
  colorPalette1:   { label: "Primary color", kind: "color" },
  colorPalette2:   { label: "Secondary color", kind: "color" },
  font1:           { label: "Heading font", kind: "font" },
  font2:           { label: "Body font", kind: "font" },
  storyTitle:      { label: "Story title" },
  mealOptions:     { label: "Meal options", kind: "list" },
  travelItems:     { label: "Travel & stay", kind: "list" },
  registries:      { label: "Gift registries", kind: "list" },
};

const isUnset = (value) => value === null || value === undefined;

// One line per list item. Links are shown as text, not clickable, so the
// couple reads the full address before accepting it.
const describeItem = (field, item) => {
  if (field === "mealOptions") {
    return item.description ? `${item.name} — ${item.description}` : item.name;
  }
  if (field === "travelItems") {
    const parts = [`${item.name} (${getTravelCategoryLabel(item.category)})`];
    if (item.description) parts.push(item.description);
    if (item.mapUrl) parts.push(item.mapUrl);
    return parts.join(" — ");
  }
  if (field === "registries") {
    return `${item.name}${item.isVisible ? "" : " (hidden)"} — ${item.url}`;
  }
  return item.name || JSON.stringify(item);
};

const ListValue = ({ field, value, struck }) => {
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return <span className={struck ? "line-through" : ""}>none</span>;
  return (
    <ul className={`list-disc pl-5 space-y-0.5 break-all ${struck ? "line-through" : ""}`}>
      {items.map((item, i) => <li key={item?.id || i}>{describeItem(field, item || {})}</li>)}
    </ul>
  );
};

const Value = ({ field, kind, value, struck }) => {
  if (kind === "list") return <ListValue field={field} value={value} struck={struck} />;
  const style = struck ? "line-through" : "";
  if (isUnset(value)) return <span className={style}>not set</span>;
  if (kind === "name") {
    // {first, middle, last} -> "First Middle Last"
    const text = value && typeof value === "object"
      ? ["first", "middle", "last"].map((k) => value[k]).filter(Boolean).join(" ")
      : String(value);
    return <span className={style}>{text || "not set"}</span>;
  }
  if (kind === "time") return <span className={style}>{formatCeremonyTime(value)}</span>;
  if (kind === "children") {
    return <span className={style}>{CHILDREN_POLICY_LABELS[value] || String(value)}</span>;
  }
  if (kind === "color") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${style}`}>
        <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: value }} />
        {String(value)}
      </span>
    );
  }
  if (kind === "font") {
    return <span className={style} style={{ fontFamily: `"${value}"` }}>{String(value)}</span>;
  }
  return <span className={`whitespace-pre-wrap ${style}`}>{String(value)}</span>;
};

const ProposalCard = ({ proposal, busy, onDecide }) => {
  const config = FIELDS[proposal.field];
  if (!config) return null;
  const { label, kind, note } = config;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-lg rounded-2xl rounded-bl-md border-2 border-primary/30 bg-card px-5 py-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Suggested change · {label}</p>
        {kind === "list" ? (
          <div className="space-y-2">
            <div className="text-muted-foreground">
              <p className="text-xs uppercase tracking-wide">Now</p>
              <Value field={proposal.field} kind={kind} value={proposal.oldValue} struck />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Proposed</p>
              <div className="font-semibold">
                <Value field={proposal.field} kind={kind} value={proposal.newValue} />
              </div>
            </div>
          </div>
        ) : (
          <p>
            <span className="text-muted-foreground">
              <Value field={proposal.field} kind={kind} value={proposal.oldValue} struck />
            </span>
            {" → "}
            <span className="font-semibold">
              <Value field={proposal.field} kind={kind} value={proposal.newValue} />
            </span>
          </p>
        )}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        {proposal.reason && (
          <p className="text-sm text-muted-foreground">{proposal.reason}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(proposal.id, "accept")}
            className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(proposal.id, "reject")}
            className="px-4 py-1.5 rounded-full border hover:bg-muted disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposalCard;
