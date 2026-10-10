// src/components/invitation/QaPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Q&A" tab of the Invitation Builder (after Registry).
//   - "Show Q&A on Invitation" switch (OFF until the couple turns it on)
//   - suggested + custom questions, each with a status, its own show/hide
//     switch, Move Up / Move Down, Edit and Delete
//   - "+ Add Question"
// Like Registry, every change SAVES IMMEDIATELY (src/hooks/useQa.js); the
// builder's main Save button doesn't touch Q&A.
// ─────────────────────────────────────────────────────────────────────────────

import { Plus, Info, AlertCircle, Loader2, EyeOff, MessageCircle } from "lucide-react";
import QaQuestionRow from "@/components/qa/QaQuestionRow";
import QaFormModal from "@/components/qa/QaFormModal";
import DeleteQaModal from "@/components/qa/DeleteQaModal";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import { resolveQaAnswer, QA_MAX_ITEMS } from "@/lib/qa";

/**
 * Props
 *   qa    the object returned by useQa()
 *   ctx   { data, availableSections } — how answers resolve in the preview
 */
const QaPanel = ({ qa, ctx }) => {
  const hasWedding = Boolean(qa.weddingId);
  const sectionHeading = "text-xs font-bold tracking-widest uppercase";

  if (qa.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg text-sm" role="status"
        style={{ backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurfaceVar }}>
        <Loader2 size={16} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
        Loading questions...
      </div>
    );
  }

  if (qa.status === "error") {
    return (
      <div className="flex items-start gap-2 p-4 rounded-lg text-sm" role="alert"
        style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: ERROR_COLOR }} />
        <p>
          <strong>Something went wrong.</strong> Couldn't load your wedding details, so your Q&A can't be
          shown or edited right now. Please check your connection and refresh the page.
        </p>
      </div>
    );
  }

  const locked = !hasWedding;
  const readyCount = qa.items.filter(i => i.isVisible && resolveQaAnswer(i, ctx).status === "ready").length;

  return (
    <>
    <div className="space-y-8 min-w-0">
      {/* Show Q&A on Invitation */}
      <div>
        <div className="p-4 rounded-lg flex items-center justify-between gap-4"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div>
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Show Q&amp;A on Invitation</p>
            <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Off until you turn it on. Guests only see questions that are switched on and answered.
            </p>
          </div>
          <button
            type="button" role="switch" aria-checked={qa.showOnInvitation}
            aria-label="Show Q&A on Invitation"
            disabled={locked || qa.showSaving}
            onClick={() => qa.setShowOnInvitation(!qa.showOnInvitation)}
            className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: qa.showOnInvitation ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
              style={{ transform: qa.showOnInvitation ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
        {qa.showError && <p className="text-xs mt-2" role="alert" style={{ color: ERROR_COLOR }}>{qa.showError}</p>}
        {!qa.showOnInvitation && hasWedding && (
          <p className="text-xs mt-2 flex items-center gap-1.5" role="status" data-testid="qa-hidden-notice"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            <EyeOff size={13} className="flex-shrink-0" />
            Q&amp;A is hidden from guests — your questions are kept. Turn this on when you're ready.
          </p>
        )}
        {qa.showOnInvitation && readyCount === 0 && (
          <p className="text-xs mt-2" role="status" style={{ color: BUILDER_UI.onSurfaceVar }}>
            No questions are ready to show yet — switch on at least one answered question.
          </p>
        )}
      </div>

      {/* Immediate-save notice */}
      <div className="flex items-start gap-2 p-4 rounded-lg" data-testid="qa-immediate-save-notice"
        style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
        <Info size={16} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
        <div className="text-sm" style={{ color: BUILDER_UI.onSurface }}>
          <p className="font-bold">Q&amp;A changes save immediately</p>
          <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
            Adding, editing, reordering, showing, hiding or deleting a question is saved right away. The Save
            button at the top of the builder doesn't change your Q&amp;A. Suggested questions start hidden —
            review each one, then switch it on.
          </p>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 p-4 rounded-lg text-sm" role="status"
          style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
          <p>
            Fill in your wedding details first (or click Save at the top to create your invitation),
            then your suggested questions will appear here.
          </p>
        </div>
      )}

      {/* Questions */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>
              Questions {qa.items.length > 0 && (
                <span className="normal-case tracking-normal font-normal">({qa.items.length}/{QA_MAX_ITEMS})</span>
              )}
            </h3>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Guests see them in this order. Use the arrows to reorder.
            </p>
          </div>
          <button type="button" onClick={qa.openAdd} disabled={locked}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex-shrink-0 disabled:opacity-60"
            style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
            <Plus size={14} /> Add Question
          </button>
        </div>

        {qa.actionError && (
          <p className="text-xs mb-3" role="alert" style={{ color: ERROR_COLOR }}>{qa.actionError}</p>
        )}

        {qa.starterStatus === "creating" && (
          <div className="flex items-center gap-2 p-4 rounded-lg mb-3 text-sm" role="status"
            style={{ backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurfaceVar }}>
            <Loader2 size={16} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
            Adding suggested questions...
          </div>
        )}
        {qa.starterStatus === "error" && (
          <div className="flex items-start gap-2 p-4 rounded-lg mb-3 text-sm" role="alert"
            style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: ERROR_COLOR }} />
            <div>
              <p>Suggested questions couldn't be added. You can still add your own.</p>
              <button type="button" onClick={qa.retryStarters} className="mt-1 text-xs font-bold underline"
                style={{ color: BUILDER_UI.primary }}>
                Try again
              </button>
            </div>
          </div>
        )}

        {qa.items.length === 0 && qa.starterStatus !== "creating" ? (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed"
            style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
            <MessageCircle size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No questions yet</p>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Add answers to things guests often ask — dress code, parking, children, photos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {qa.items.map((item, i) => (
              <QaQuestionRow
                key={item.id}
                item={item}
                answer={resolveQaAnswer(item, ctx)}
                index={i}
                total={qa.items.length}
                busy={qa.busyId === item.id}
                disabled={locked || Boolean(qa.busyId)}
                onToggleVisible={() => qa.toggleVisible(item)}
                onMoveUp={() => qa.move(item, -1)}
                onMoveDown={() => qa.move(item, 1)}
                onEdit={() => qa.openEdit(item)}
                onDelete={() => qa.requestDelete(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

      {/* Modals live outside the spaced list above — `space-y-*` would add a
          top margin to these fixed overlays and shift them down. */}
      {qa.formModal && (
        <QaFormModal
          item={qa.formModal.item}
          autoData={ctx.data}
          onSave={qa.saveItem}
          onClose={qa.closeForm}
          saving={qa.formSaving}
          error={qa.formError}
        />
      )}
      {qa.deleteTarget && (
        <DeleteQaModal
          item={qa.deleteTarget}
          onConfirm={qa.confirmDelete}
          onClose={qa.closeDelete}
          deleting={qa.deleting}
          error={qa.deleteError}
        />
      )}
    </>
  );
};

export default QaPanel;
