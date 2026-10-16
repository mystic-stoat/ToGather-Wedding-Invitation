// src/components/PublishedInvitationBanner.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   Persistent informational warning shown on pages where the host can edit
//   guest-visible wedding information AFTER their invitation has been
//   published (invitations/{weddingId}.isPublished === true).
//
// WHY IT EXISTS:
//   Publishing triggers the sendInvitesOnPublish Cloud Function exactly once
//   (on the isPublished false -> true transition), which queues invitation
//   emails for guests pending at that moment. Any later edits — new dates,
//   venue changes, new guests — do NOT update or resend those emails. This
//   banner tells the couple that previously delivered emails may be stale.
//
// WHAT IT DOES NOT DO:
//   - It never writes to Firestore and never touches isPublished.
//   - It does not claim every guest received an email ("may have received").
//   - It does not block editing — it is informational only.
//
// USAGE:
//   <PublishedInvitationBanner isPublished={invitation?.isPublished} />
//   Pass `message` to tailor the body copy (e.g. Guest List warns that newly
//   added guests may not have been sent an invitation email).
//   Hidden whenever isPublished is falsy, so a page whose invitation is still
//   loading — or failed to load — simply renders nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { AlertTriangle } from "lucide-react";

const DEFAULT_TITLE = "Invitation Already Published";

const DEFAULT_MESSAGE =
  "Your wedding invitation has already been published, and guests may have " +
  "received an email with the original details. Any changes you make here " +
  "will not update emails that have already been delivered. Please make sure " +
  "your guests are informed of important changes.";

const PublishedInvitationBanner = ({ isPublished, title = DEFAULT_TITLE, message = DEFAULT_MESSAGE, className = "" }) => {
  if (!isPublished) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-status-pending/40 bg-status-pending-bg px-4 py-3 text-sm text-foreground ${className}`}
    >
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-status-pending" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{message}</p>
      </div>
    </div>
  );
};

export default PublishedInvitationBanner;
