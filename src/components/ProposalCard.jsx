// src/components/ProposalCard.jsx
// One change the assistant has PROPOSED, with Accept / Reject buttons. Nothing
// is applied until the couple clicks Accept (see decideProposal in
// src/lib/firestore.js).

// Only fields the assistant can propose (functions/field-registry.js).
const FIELD_LABELS = {
  weddingDate: "Wedding date",
  venueName: "Venue",
};

const show = (value) => (value === null || value === undefined ? "not set" : String(value));

const ProposalCard = ({ proposal, busy, onDecide }) => {
  const label = FIELD_LABELS[proposal.field];
  if (!label) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-lg rounded-2xl rounded-bl-md border-2 border-primary/30 bg-card px-5 py-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Suggested change · {label}</p>
        <p>
          <span className="text-muted-foreground line-through">{show(proposal.oldValue)}</span>
          {" → "}
          <span className="font-semibold">{show(proposal.newValue)}</span>
        </p>
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
