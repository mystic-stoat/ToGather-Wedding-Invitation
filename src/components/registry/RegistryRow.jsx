// src/components/registry/RegistryRow.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One registry link in the host's list: name, URL, show/hide switch, edit and
// delete. Moved from the former src/pages/Registry.jsx. Hidden links stay in
// the list (and editable) — they're just not shown to guests.
// ─────────────────────────────────────────────────────────────────────────────

import { Gift, Pencil, Trash2, Loader2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isRegistryVisible } from "@/lib/registry";

const RegistryRow = ({ registry, onEdit, onDelete, onToggleVisible, busy, disabled = false }) => {
  // Same rule as the guest page: only isVisible === true is shown to guests.
  const visible = isRegistryVisible(registry);

  return (
    <article className="bg-card rounded-2xl border border-border/50 shadow-sm px-4 py-4 sm:px-5 flex flex-wrap items-center gap-3"
      data-testid="registry-row">
      {/* Icon + name + link */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
          <Gift size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className={`font-medium text-sm truncate ${visible ? "text-foreground" : "text-muted-foreground"}`}>
            {registry.name}
            {!visible && <span className="ml-2 text-xs font-normal text-muted-foreground">(hidden from guests)</span>}
          </p>
          <a
            href={registry.url}
            target="_blank"
            rel="noopener noreferrer"
            title={registry.url}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline max-w-full"
          >
            <span className="truncate">{registry.url}</span>
            <ExternalLink size={11} className="flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* Actions: visibility, edit, delete */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 ml-auto">
        {busy ? (
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className="flex items-center gap-1.5" title={visible ? "Visible to guests" : "Hidden from guests"}>
              {visible
                ? <Eye size={15} className="text-muted-foreground" />
                : <EyeOff size={15} className="text-muted-foreground/50" />}
              <Switch
                checked={visible}
                onCheckedChange={onToggleVisible}
                disabled={disabled}
                aria-label={`Toggle visibility of ${registry.name}`}
              />
            </span>
            <button
              onClick={onEdit}
              disabled={disabled}
              className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
              title={`Edit ${registry.name}`}
              aria-label={`Edit ${registry.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
              title={`Delete ${registry.name}`}
              aria-label={`Delete ${registry.name}`}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </article>
  );
};

export default RegistryRow;
