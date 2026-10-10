// src/components/registry/RegistryFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Registry modal. Moved from the former src/pages/Registry.jsx.
// Same fixed-overlay modal convention as GuestList.jsx's AddGuestModal.
// `registry` is null when adding, or the existing entry when editing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { isValidRegistryUrl, isRegistryVisible } from "@/lib/registry";

const RegistryFormModal = ({ registry, onSave, onClose, saving, error }) => {
  const isEditing = Boolean(registry);
  const [name, setName]           = useState(registry?.name || "");
  const [url, setUrl]             = useState(registry?.url || "");
  // New registries default to visible; existing ones keep the guest-page rule.
  const [isVisible, setIsVisible] = useState(registry ? isRegistryVisible(registry) : true);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Registry name is required.";
    if (!url.trim()) errs.url = "Registry URL is required.";
    else if (!isValidRegistryUrl(url)) errs.url = "Enter a valid http:// or https:// URL.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      url: url.trim(),
      isVisible,
    });
  };

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label={isEditing ? "Edit Registry" : "Add Registry"}
        className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-sm space-y-5">
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-lg font-semibold text-foreground italic">
            {isEditing ? "Edit Registry" : "Add Registry"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Registry name */}
        <div className="space-y-1.5">
          <label htmlFor="registry-name" className="text-sm font-medium text-muted-foreground">
            Registry Name *
          </label>
          <Input
            id="registry-name"
            placeholder="e.g. Amazon Wedding Registry"
            value={name}
            autoFocus
            onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })); }}
            className="h-11 border-border/60 rounded-xl"
          />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>

        {/* Registry URL */}
        <div className="space-y-1.5">
          <label htmlFor="registry-url" className="text-sm font-medium text-muted-foreground">
            Registry URL *
          </label>
          <Input
            id="registry-url"
            type="url"
            placeholder="https://www.example.com/registry/your-link"
            value={url}
            onChange={e => { setUrl(e.target.value); setFieldErrors(p => ({ ...p, url: undefined })); }}
            className="h-11 border-border/60 rounded-xl"
          />
          {fieldErrors.url && <p className="text-xs text-destructive">{fieldErrors.url}</p>}
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Visible to guests</p>
            <p className="text-xs text-muted-foreground/70">Shown on your public invitation page.</p>
          </div>
          <Switch
            checked={isVisible}
            onCheckedChange={setIsVisible}
            aria-label="Visible to guests"
          />
        </div>

        {/* Save error — form values are preserved so nothing typed is lost */}
        {error && (
          <div className="flex items-start gap-2 bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" className="flex-1 rounded-xl" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Saving...</span>
              : isEditing ? "Save Changes" : "Add Registry"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegistryFormModal;
