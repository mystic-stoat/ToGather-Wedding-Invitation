// src/pages/Registry.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The host-facing gift registry manager. The couple can:
//     1. Write/edit a "Registry Message" shown to guests on the RSVP page
//        (stored as `registryMessage` on their invitations document)
//     2. Add, edit, delete, and show/hide external gift registry links
//        (stored in the `registries` array on the same invitations document —
//        each entry is { id, name, url, isVisible })
//
// DATA FLOW:
//   1. Load invitation from `invitations` — it carries weddingId,
//      registryMessage, and the registries array (no separate collection)
//   2. Add/edit/delete/visibility run as transactions on that array via
//      src/lib/firestore.js, each returning the updated array
//   3. Guests only see entries where isVisible === true — the public RSVP page
//      reads the same invitation doc and filters client-side (see RSVP.jsx)
//
// PAGE LAYOUT mirrors GuestList.jsx: shared <Sidebar>, mobile top bar,
// in-file modal components, same card/button styling conventions.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gift, Plus, Pencil, Trash2, Loader2, ExternalLink,
  Eye, EyeOff, Heart, LogOut, AlertCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser,
  saveInvitation,
  addRegistry,
  updateRegistry,
  deleteRegistry,
} from "@/lib/firestore";
import Sidebar from "@/components/Sidebar";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Only http:// and https:// links are allowed — this rejects `javascript:`,
// `data:`, and malformed input that `new URL()` itself can't parse.
const isValidRegistryUrl = (value) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// ── Registry Message card ─────────────────────────────────────────────────────
// Editable message shown to guests above their registry links on the RSVP page.
// Lives on the invitation doc, so saving is a partial updateDoc via
// saveInvitation() — no other invitation fields are touched.
const RegistryMessageCard = ({ value, onChange, onSave, saving, saved, error, disabled }) => (
  <section className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 sm:p-6 mb-6">
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Registry Message
      </h2>
      {saving ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </span>
      ) : saved ? (
        <span className="text-xs font-medium text-primary">Saved</span>
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

// ── Registry card (one per registry link) ────────────────────────────────────
const RegistryRow = ({ registry, onEdit, onDelete, onToggleVisible, busy }) => {
  const visible = registry.isVisible !== false;

  return (
    <article className="bg-card rounded-2xl border border-border/50 shadow-sm px-4 py-4 sm:px-5 flex flex-wrap items-center gap-3">
      {/* Icon + name + link */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
          <Gift size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className={`font-medium text-sm truncate ${visible ? "text-foreground" : "text-muted-foreground"}`}>
            {registry.name}
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
                aria-label={`Toggle visibility of ${registry.name}`}
              />
            </span>
            <button
              onClick={onEdit}
              className="text-muted-foreground hover:text-primary transition-colors"
              title={`Edit ${registry.name}`}
              aria-label={`Edit ${registry.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive transition-colors"
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

// ── Add / Edit Registry modal ─────────────────────────────────────────────────
// Same fixed-overlay modal convention as GuestList.jsx's AddGuestModal.
// `registry` is null when adding, or the existing doc when editing.
const RegistryFormModal = ({ registry, onSave, onClose, saving, error }) => {
  const isEditing = Boolean(registry);
  const [name, setName]           = useState(registry?.name || "");
  const [url, setUrl]             = useState(registry?.url || "");
  const [isVisible, setIsVisible] = useState(registry?.isVisible !== false);
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

// ── Delete confirmation modal ────────────────────────────────────────────────
// Identifies the registry by name — the trash button never deletes directly.
const DeleteRegistryModal = ({ registry, onConfirm, onClose, deleting, error }) => (
  <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div role="dialog" aria-modal="true" aria-label={`Delete ${registry.name}`}
      className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-sm space-y-5">
      <h3 className="font-heading text-lg font-semibold text-foreground italic">
        Delete “{registry.name}”?
      </h3>
      <p className="text-sm text-muted-foreground">
        This registry link will be removed from your list and hidden from guests. This cannot be undone.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="default"
          className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting
            ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting...</span>
            : "Delete"}
        </Button>
      </div>
    </div>
  </div>
);

// ── Main Registry page ────────────────────────────────────────────────────────
const Registry = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [invitation, setInvitation]         = useState(null);
  const [registries, setRegistries]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState("");

  const [message, setMessage]               = useState("");
  const [messageSaving, setMessageSaving]   = useState(false);
  const [messageSaved, setMessageSaved]     = useState(false);
  const [messageError, setMessageError]     = useState("");

  const [formModal, setFormModal]           = useState(null); // null | { registry?: registryDoc }
  const [formSaving, setFormSaving]         = useState(false);
  const [formError, setFormError]           = useState("");

  const [deleteTarget, setDeleteTarget]     = useState(null); // registry doc pending confirmation
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState("");

  const [busyId, setBusyId]                 = useState(null); // row-level spinner for toggle

  // ── Load invitation + registries on mount ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    loadData();
  }, [user?.uid]);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const inv = await getInvitationByUser(user.uid);
      setInvitation(inv);
      setMessage(inv?.registryMessage || "");
      // Registries are embedded on the invitation doc — no second query needed
      setRegistries(inv?.registries || []);
    } catch (err) {
      console.error("Registry load error:", err);
      setLoadError("Couldn't load your wedding details. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Save registry message ──────────────────────────────────────────────────
  const handleSaveMessage = async () => {
    if (!invitation?.weddingId) {
      setMessageError("Please fill in your wedding details first.");
      return;
    }
    setMessageSaving(true);
    setMessageError("");
    setMessageSaved(false);
    try {
      await saveInvitation(user.uid, { registryMessage: message }, invitation.weddingId);
      setMessageSaved(true);
    } catch (err) {
      console.error("Registry message save error:", err);
      // `message` state is untouched — the user's text stays in the textarea
      setMessageError("Couldn't save your message. Please try again.");
    } finally {
      setMessageSaving(false);
    }
  };

  // ── Add / edit registry ────────────────────────────────────────────────────
  const handleSaveRegistry = async ({ name, url, isVisible }) => {
    if (!invitation?.weddingId) {
      setFormError("Please fill in your wedding details first.");
      return;
    }
    setFormSaving(true);
    setFormError("");
    try {
      // Each helper returns the updated registries array from the transaction
      const updated = formModal?.registry?.id
        ? await updateRegistry(invitation.weddingId, formModal.registry.id, { name, url, isVisible })
        : await addRegistry(invitation.weddingId, { name, url, isVisible });
      setRegistries(updated);
      setFormModal(null);
    } catch (err) {
      console.error("Registry save error:", err);
      // Modal stays open with the user's input intact
      setFormError("Couldn't save this registry. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  // ── Visibility toggle ──────────────────────────────────────────────────────
  const handleToggleVisible = async (registry) => {
    const next = !(registry.isVisible !== false);
    setBusyId(registry.id);
    // Optimistic update — reverted below if the write fails
    setRegistries(prev => prev.map(r =>
      r.id === registry.id ? { ...r, isVisible: next } : r
    ));
    try {
      setRegistries(
        await updateRegistry(invitation.weddingId, registry.id, { isVisible: next })
      );
    } catch (err) {
      console.error("Visibility toggle error:", err);
      setRegistries(prev => prev.map(r =>
        r.id === registry.id ? { ...r, isVisible: !next } : r
      ));
      alert(`Couldn't update "${registry.name}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  // ── Delete registry ────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      setRegistries(await deleteRegistry(invitation.weddingId, deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Registry delete error:", err);
      setDeleteError(`Couldn't delete "${deleteTarget.name}". Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading registries...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">

      {/* Sidebar navigation — Registry highlighted at /gift-registry */}
      <Sidebar invitation={invitation} onLogout={handleLogout} />

      {/* Add / Edit modal */}
      {formModal && (
        <RegistryFormModal
          registry={formModal.registry}
          onSave={handleSaveRegistry}
          onClose={() => { setFormModal(null); setFormError(""); }}
          saving={formSaving}
          error={formError}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteRegistryModal
          registry={deleteTarget}
          onConfirm={handleConfirmDelete}
          onClose={() => { setDeleteTarget(null); setDeleteError(""); }}
          deleting={deleting}
          error={deleteError}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">

        {/* Mobile top bar */}
        <div className="lg:hidden bg-card border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-primary" />
            <span className="font-heading text-lg font-semibold">ToGather</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={15} /> Log out
          </button>
        </div>

        <div className="px-6 lg:px-10 py-8 max-w-4xl mx-auto">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-semibold text-foreground">Registry</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your gift registries and links.
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => {
                if (!invitation?.weddingId) {
                  alert("Please fill in your wedding details first.");
                  return;
                }
                setFormError("");
                setFormModal({ registry: null });
              }}
            >
              <Plus size={15} /> Add Registry
            </Button>
          </div>

          {/* Fatal load error — page stays usable behind a retry */}
          {loadError ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <AlertCircle size={36} className="mx-auto text-destructive/60 mb-3" />
              <p className="font-heading text-lg text-foreground mb-1">Something went wrong</p>
              <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={loadData}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              {/* Registry Message */}
              <RegistryMessageCard
                value={message}
                onChange={v => { setMessage(v); setMessageSaved(false); setMessageError(""); }}
                onSave={handleSaveMessage}
                saving={messageSaving}
                saved={messageSaved}
                error={messageError}
                disabled={!invitation?.weddingId}
              />

              {/* Registry list */}
              {registries.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
                  <Gift size={36} className="mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-heading text-lg text-foreground mb-1">No registries yet</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation?.weddingId
                      ? `Click "Add Registry" to link your first gift registry.`
                      : "Fill in your wedding details first, then add your registries here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {registries.map(r => (
                    <RegistryRow
                      key={r.id}
                      registry={r}
                      busy={busyId === r.id}
                      onEdit={() => { setFormError(""); setFormModal({ registry: r }); }}
                      onDelete={() => { setDeleteError(""); setDeleteTarget(r); }}
                      onToggleVisible={() => handleToggleVisible(r)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Registry;
