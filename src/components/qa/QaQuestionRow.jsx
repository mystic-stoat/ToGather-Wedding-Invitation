// src/components/qa/QaQuestionRow.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One question in the builder's Q&A list: question, answer type, status
// ("Shown to guests", "Information needed", …), a short answer preview, and
// its controls — show/hide switch, Move Up / Move Down, Edit, Delete.
// ─────────────────────────────────────────────────────────────────────────────

import { ArrowUp, ArrowDown, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2, EyeOff, Sparkles } from "lucide-react";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import { ANSWER_TYPE_LABELS, describeQaStatus, getQaSectionLabel } from "@/lib/qa";

const iconBtn = "w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5F47]";

const typeLabel = (item) =>
  item.answerType === "section" && item.section
    ? `${ANSWER_TYPE_LABELS.section}: ${getQaSectionLabel(item.section)}`
    : ANSWER_TYPE_LABELS[item.answerType];

const answerPreview = (answer) => {
  if (answer.status !== "ready") return "";
  if (answer.kind === "url") return answer.label;
  if (answer.kind === "section") return answer.text || `Takes guests to ${answer.sectionLabel}`;
  return answer.text || "";
};

/**
 * Props
 *   item, answer (resolveQaAnswer), index, total, busy, disabled
 *   onToggleVisible, onMoveUp, onMoveDown, onEdit, onDelete
 */
const QaQuestionRow = ({
  item, answer, index, total, busy, disabled, onToggleVisible, onMoveUp, onMoveDown, onEdit, onDelete,
}) => {
  const ready = answer.status === "ready";
  const live = ready && item.isVisible;
  const statusColor = ready ? (live ? BUILDER_UI.primary : BUILDER_UI.onSurfaceVar)
    : answer.status === "missing" || answer.status === "incomplete" ? ERROR_COLOR : BUILDER_UI.onSurfaceVar;
  const StatusIcon = live ? CheckCircle2 : ready ? (item.starterKey && !item.isVisible ? Sparkles : EyeOff) : AlertCircle;
  const label = item.question || "Untitled question";
  const preview = answerPreview(answer);

  return (
    <article className="rounded-lg border p-4" data-testid="qa-question-row"
      style={{ backgroundColor: BUILDER_UI.surfaceContainer, borderColor: BUILDER_UI.outline }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold break-words" style={{ color: BUILDER_UI.onSurface }}>{label}</p>
          <p className="text-[11px] font-bold uppercase tracking-widest mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
            {typeLabel(item)}
          </p>
          {preview && (
            <p className="text-xs mt-1.5 line-clamp-2 break-words" style={{ color: BUILDER_UI.onSurface }}
              data-testid="qa-answer-preview">
              {preview}
            </p>
          )}
          <p className="text-xs mt-1.5 flex items-start gap-1.5" data-testid="qa-status" style={{ color: statusColor }}>
            <StatusIcon size={13} className="flex-shrink-0 mt-px" />
            {describeQaStatus(item, answer)}
          </p>
        </div>

        {/* Show to guests */}
        <div className="flex-shrink-0 pt-0.5">
          {busy ? (
            <Loader2 size={16} className="animate-spin" style={{ color: BUILDER_UI.onSurfaceVar }} />
          ) : (
            <button
              type="button" role="switch" aria-checked={item.isVisible}
              aria-label={`Show "${label}" to guests`}
              disabled={disabled}
              onClick={onToggleVisible}
              className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: item.isVisible ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
                style={{ transform: item.isVisible ? "translateX(26px)" : "translateX(2px)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t" style={{ borderColor: BUILDER_UI.outline }}>
        <button type="button" className={iconBtn} onClick={onMoveUp} disabled={disabled || index === 0}
          aria-label={`Move "${label}" up`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <ArrowUp size={15} />
        </button>
        <button type="button" className={iconBtn} onClick={onMoveDown} disabled={disabled || index === total - 1}
          aria-label={`Move "${label}" down`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <ArrowDown size={15} />
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onEdit} disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold hover:bg-black/5 disabled:opacity-40"
          aria-label={`Edit "${label}"`} style={{ color: BUILDER_UI.primary }}>
          <Pencil size={13} /> Edit
        </button>
        <button type="button" onClick={onDelete} disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold hover:bg-black/5 disabled:opacity-40"
          aria-label={`Delete "${label}"`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </article>
  );
};

export default QaQuestionRow;
