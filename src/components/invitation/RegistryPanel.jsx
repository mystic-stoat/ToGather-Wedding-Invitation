// src/components/invitation/RegistryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Registry" tab of the Invitation Builder. This is the former dashboard
// Registry page (src/pages/Registry.jsx), moved into the builder: same
// message card, link list, add/edit modal, delete confirmation and
// show/hide switches (src/components/registry/*), driven by the same state
// and Firestore helpers (src/hooks/useRegistries.js).
//
// Unlike the other builder tabs, Registry changes SAVE IMMEDIATELY (as they
// always have) — the builder's main Save button does not save or overwrite
// them. The notice at the top tells the couple this.
// ─────────────────────────────────────────────────────────────────────────────

import { Plus, Gift, Info, AlertCircle, Loader2, EyeOff } from "lucide-react";
import RegistryMessageCard from "@/components/registry/RegistryMessageCard";
import RegistryRow from "@/components/registry/RegistryRow";
import RegistryFormModal from "@/components/registry/RegistryFormModal";
import DeleteRegistryModal from "@/components/registry/DeleteRegistryModal";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";

/**
 * Props
 *   registry   the object returned by useRegistries()
 */
const RegistryPanel = ({ registry }) => {
  const r = registry;
  const hasWedding = Boolean(r.weddingId);
  const sectionHeading = "text-xs font-bold tracking-widest uppercase";

  if (r.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg text-sm" role="status"
        style={{ backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurfaceVar }}>
        <Loader2 size={16} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
        Loading registries...
      </div>
    );
  }

  if (r.status === "error") {
    return (
      <div className="flex items-start gap-2 p-4 rounded-lg text-sm" role="alert"
        style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: ERROR_COLOR }} />
        <p>
          <strong>Something went wrong.</strong> Couldn't load your wedding details, so your registries
          can't be shown or edited right now. Please check your connection and refresh the page.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-8 min-w-0">
      {/* Show Registry on Invitation — the whole Gift Registry section.
          Off hides it (message + links) from the preview and from guests;
          nothing is deleted, and each link keeps its own switch below. */}
      <div>
        <div className="p-4 rounded-lg flex items-center justify-between gap-4"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div>
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>
              Show Registry on Invitation
            </p>
            <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Shows your registry message and visible links to guests. Saved immediately.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={r.showOnInvitation}
            aria-label="Show Registry on Invitation"
            disabled={!hasWedding || r.showSaving}
            onClick={() => r.setShowOnInvitation(!r.showOnInvitation)}
            className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: r.showOnInvitation ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
              style={{ transform: r.showOnInvitation ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
        {r.showError && (
          <p className="text-xs mt-2" role="alert" style={{ color: ERROR_COLOR }}>{r.showError}</p>
        )}
        {!r.showOnInvitation && (
          <p className="text-xs mt-2 flex items-center gap-1.5" role="status" data-testid="registry-hidden-notice"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            <EyeOff size={13} className="flex-shrink-0" />
            Hidden from guests — your message and links are kept. Turn this on to show them again.
          </p>
        )}
      </div>

      {/* Immediate-save notice */}
      <div className="flex items-start gap-2 p-4 rounded-lg" data-testid="registry-immediate-save-notice"
        style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
        <Info size={16} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
        <div className="text-sm" style={{ color: BUILDER_UI.onSurface }}>
          <p className="font-bold">Registry changes save immediately</p>
          <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
            Showing or hiding the Registry section, and adding, editing, hiding or deleting a registry link,
            are saved right away. Your message is saved
            when you click <strong>Save Message</strong>. The Save button at the top of the builder doesn't
            change your registry.
          </p>
        </div>
      </div>

      {!hasWedding && (
        <div className="flex items-start gap-2 p-4 rounded-lg text-sm" role="status"
          style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
          <p>
            Fill in your wedding details first (or click Save at the top to create your invitation),
            then add your registries here.
          </p>
        </div>
      )}

      {/* Registry message */}
      <div>
        <RegistryMessageCard
          value={r.message}
          onChange={r.changeMessage}
          onSave={r.saveMessage}
          saving={r.messageSaving}
          saved={r.messageSaved}
          error={r.messageError}
          dirty={r.messageDirty}
          disabled={!hasWedding}
        />
      </div>

      {/* Registry links */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>Registry Links</h3>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Guests only see links that are switched on. Hidden links stay here so you can edit them.
            </p>
          </div>
          <button type="button" onClick={r.openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex-shrink-0 disabled:opacity-60"
            style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
            <Plus size={14} /> Add Registry
          </button>
        </div>

        {r.registries.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed"
            style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
            <Gift size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No registries yet</p>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              {hasWedding
                ? `Click "Add Registry" to link your first gift registry.`
                : "Fill in your wedding details first, then add your registries here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {r.registries.map(entry => (
              <RegistryRow
                key={entry.id}
                registry={entry}
                busy={r.busyId === entry.id}
                onEdit={() => r.openEdit(entry)}
                onDelete={() => r.requestDelete(entry)}
                onToggleVisible={() => r.toggleVisible(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

      {/* Modals live outside the spaced list above — `space-y-*` would add a
          top margin to these fixed overlays and shift them down. */}
      {/* Add / Edit modal */}
      {r.formModal && (
        <RegistryFormModal
          registry={r.formModal.registry}
          onSave={r.saveRegistry}
          onClose={r.closeForm}
          saving={r.formSaving}
          error={r.formError}
        />
      )}

      {/* Delete confirmation modal */}
      {r.deleteTarget && (
        <DeleteRegistryModal
          registry={r.deleteTarget}
          onConfirm={r.confirmDelete}
          onClose={r.closeDelete}
          deleting={r.deleting}
          error={r.deleteError}
        />
      )}
    </>
  );
};

export default RegistryPanel;
