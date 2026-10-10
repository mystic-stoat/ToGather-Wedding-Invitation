// src/components/qa/DeleteQaModal.jsx
// Delete confirmation for one Q&A question (same convention as
// DeleteRegistryModal). Suggested questions are created only once, so a
// deleted suggestion does not come back — the text says so.

import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const DeleteQaModal = ({ item, onConfirm, onClose, deleting, error }) => (
  <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div role="dialog" aria-modal="true" aria-label="Delete question"
      className="bg-card rounded-2xl border border-border/50 shadow-xl p-6 w-full max-w-sm space-y-5">
      <h3 className="font-heading text-lg font-semibold text-foreground italic break-words">
        Delete “{item.question || "Untitled question"}”?
      </h3>
      <p className="text-sm text-muted-foreground">
        This question will be removed from your Q&A{item.starterKey ? " and won't be suggested again" : ""}.
        This cannot be undone.
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
        <Button variant="default"
          className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          onClick={onConfirm} disabled={deleting}>
          {deleting
            ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting...</span>
            : "Delete"}
        </Button>
      </div>
    </div>
  </div>
);

export default DeleteQaModal;
