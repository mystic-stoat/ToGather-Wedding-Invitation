// src/components/qa/QaFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Question modal (same fixed-overlay convention as the Registry
// form modal). The couple writes the question and picks an answer type:
//   - Auto-fill     (suggested questions with a data source only) — shows the
//                   answer derived from current invitation data, or
//                   "Information needed"
//   - Custom text
//   - Link to section (+ optional short note)
//   - External link   (+ optional label)
// Switching types keeps what was typed for the other types.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ANSWER_TYPES, ANSWER_TYPE_LABELS, AUTO_SOURCES, QA_SECTIONS, getAutoAnswer, validateQaInput,
  QA_QUESTION_MAX, QA_TEXT_MAX, QA_NOTE_MAX, QA_URL_MAX, QA_LINK_LABEL_MAX,
} from "@/lib/qa";

/**
 * Props
 *   item       null when adding, or the question being edited
 *   autoData   invitation data for auto-fill previews
 *   onSave(values), onClose, saving, error
 */
const QaFormModal = ({ item, autoData, onSave, onClose, saving, error }) => {
  const isEditing = Boolean(item);
  const autoSource = item?.autoSource || null;
  const [values, setValues] = useState(() => ({
    question: item?.question || "",
    answerType: item?.answerType || ANSWER_TYPES.TEXT,
    text: item?.text || "",
    section: item?.section || "",
    note: item?.note || "",
    url: item?.url || "",
    linkLabel: item?.linkLabel || "",
    // New custom questions start visible; edited ones keep their switch.
    isVisible: item ? item.isVisible === true : true,
  }));
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (field, value) => {
    setValues(v => ({ ...v, [field]: value }));
    setFieldErrors(e => ({ ...e, [field]: undefined }));
  };

  const types = [
    ...(autoSource ? [ANSWER_TYPES.AUTO] : []),
    ANSWER_TYPES.TEXT, ANSWER_TYPES.SECTION, ANSWER_TYPES.URL,
  ];
  const auto = autoSource ? getAutoAnswer(autoSource, autoData) : null;

  const handleSubmit = () => {
    const errs = validateQaInput(values);
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(values);
  };

  const labelCls = "text-sm font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label={isEditing ? "Edit Question" : "Add Question"}
        className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-lg font-semibold text-foreground italic">
            {isEditing ? "Edit Question" : "Add Question"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Question */}
        <div className="space-y-1.5">
          <label htmlFor="qa-question" className={labelCls}>Question *</label>
          <Input id="qa-question" value={values.question} autoFocus maxLength={QA_QUESTION_MAX}
            placeholder="e.g. What's the dress code?"
            onChange={e => set("question", e.target.value)}
            className="h-11 border-border/60 rounded-xl" />
          <div className="flex justify-between">
            {fieldErrors.question ? <p className="text-xs text-destructive">{fieldErrors.question}</p> : <span />}
            <span className="text-xs text-muted-foreground">{values.question.length}/{QA_QUESTION_MAX}</span>
          </div>
        </div>

        {/* Answer type */}
        <div className="space-y-2">
          <p className={labelCls} id="qa-type-label">Answer type</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="qa-type-label">
            {types.map(t => {
              const selected = values.answerType === t;
              return (
                <button key={t} type="button" role="radio" aria-checked={selected}
                  onClick={() => set("answerType", t)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    selected ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"}`}>
                  {ANSWER_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Answer fields for the chosen type */}
        {values.answerType === ANSWER_TYPES.AUTO && auto && (
          <div className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm" data-testid="qa-auto-preview">
            <p className="text-xs text-muted-foreground mb-1">
              Filled in from {AUTO_SOURCES[autoSource].from} — it updates automatically when that changes.
            </p>
            {auto.status === "ready" ? (
              <p className="text-foreground">{auto.text}</p>
            ) : auto.status === "hidden" ? (
              <p className="text-muted-foreground">Not shown — your Venue section (or its address) is hidden on the invitation.</p>
            ) : (
              <p className="text-destructive font-medium">
                Information needed — add the {AUTO_SOURCES[autoSource].label.toLowerCase()} in {AUTO_SOURCES[autoSource].from}.
              </p>
            )}
          </div>
        )}

        {values.answerType === ANSWER_TYPES.TEXT && (
          <div className="space-y-1.5">
            <label htmlFor="qa-text" className={labelCls}>Answer *</label>
            <Textarea id="qa-text" value={values.text} maxLength={QA_TEXT_MAX}
              placeholder="e.g. Cocktail attire. Comfortable shoes recommended for the garden."
              onChange={e => set("text", e.target.value)}
              className="min-h-[96px] bg-background border-border/60 rounded-xl resize-y" />
            <div className="flex justify-between">
              {fieldErrors.text ? <p className="text-xs text-destructive">{fieldErrors.text}</p> : <span />}
              <span className="text-xs text-muted-foreground">{values.text.length}/{QA_TEXT_MAX}</span>
            </div>
          </div>
        )}

        {values.answerType === ANSWER_TYPES.SECTION && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="qa-section" className={labelCls}>Section *</label>
              <select id="qa-section" value={values.section}
                onChange={e => set("section", e.target.value)}
                className="h-11 w-full border border-border/60 rounded-xl bg-background px-3 text-sm">
                <option value="">Choose a section…</option>
                {QA_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {fieldErrors.section && <p className="text-xs text-destructive">{fieldErrors.section}</p>}
              <p className="text-xs text-muted-foreground">
                Guests tap the answer to jump to that part of your invitation. If the section is hidden
                or empty, this question isn't shown.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="qa-note" className={labelCls}>Short note (optional)</label>
              <Input id="qa-note" value={values.note} maxLength={QA_NOTE_MAX}
                placeholder="e.g. We've reserved a room block nearby."
                onChange={e => set("note", e.target.value)}
                className="h-11 border-border/60 rounded-xl" />
            </div>
          </div>
        )}

        {values.answerType === ANSWER_TYPES.URL && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="qa-url" className={labelCls}>Website *</label>
              <Input id="qa-url" type="url" value={values.url} maxLength={QA_URL_MAX}
                placeholder="https://www.example.com/parking"
                onChange={e => set("url", e.target.value)}
                className="h-11 border-border/60 rounded-xl" />
              {fieldErrors.url && <p className="text-xs text-destructive">{fieldErrors.url}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="qa-link-label" className={labelCls}>Link text (optional)</label>
              <Input id="qa-link-label" value={values.linkLabel} maxLength={QA_LINK_LABEL_MAX}
                placeholder="e.g. Parking map"
                onChange={e => set("linkLabel", e.target.value)}
                className="h-11 border-border/60 rounded-xl" />
            </div>
          </div>
        )}

        {/* Visibility */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={labelCls}>Show to guests</p>
            <p className="text-xs text-muted-foreground/70">Only complete answers are ever shown.</p>
          </div>
          <Switch checked={values.isVisible} onCheckedChange={v => set("isVisible", v)} aria-label="Show to guests" />
        </div>

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
              : isEditing ? "Save Changes" : "Add Question"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QaFormModal;
