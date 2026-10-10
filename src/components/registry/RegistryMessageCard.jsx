// src/components/registry/RegistryMessageCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Editable message shown to guests above their registry links.
// Moved from the former src/pages/Registry.jsx (now the Registry tab of the
// Invitation Builder). Lives on the invitation doc as `registryMessage`, so
// saving is a partial updateDoc via saveInvitation() — no other invitation
// fields are touched. Saved only by the "Save Message" button.
// ─────────────────────────────────────────────────────────────────────────────

import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Props
 *   value, onChange(text), onSave, saving, saved, error, disabled
 *   dirty   true when the text differs from what's saved (shows "Not saved yet")
 */
const RegistryMessageCard = ({ value, onChange, onSave, saving, saved, error, disabled, dirty = false }) => (
  <section className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 sm:p-6 mb-6">
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Registry Message
      </h2>
      {saving ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </span>
      ) : saved && !dirty ? (
        <span className="text-xs font-medium text-primary">Saved</span>
      ) : dirty ? (
        <span className="text-xs font-medium text-muted-foreground" data-testid="registry-message-unsaved">
          Not saved yet
        </span>
      ) : null}
    </div>

    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Share a note with your guests about gifts (e.g. “Your presence at our wedding is the greatest gift...”)"
      aria-label="Registry message"
      disabled={disabled || saving}
      className="min-h-[88px] bg-background border-border/60 rounded-xl resize-y"
    />

    {error && (
      <div className="flex items-start gap-2 mt-3 text-destructive">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <p className="text-xs">{error}</p>
      </div>
    )}

    <div className="flex justify-end mt-4">
      <Button
        variant="default"
        size="sm"
        className="rounded-xl gap-2"
        onClick={onSave}
        disabled={disabled || saving}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        Save Message
      </Button>
    </div>
  </section>
);

export default RegistryMessageCard;
