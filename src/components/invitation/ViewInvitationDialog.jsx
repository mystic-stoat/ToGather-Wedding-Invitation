// src/components/invitation/ViewInvitationDialog.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when the couple clicks "View Invitation" with unsaved changes.
//   Save and View     → save everything, then open the preview (only if the
//                       save succeeded)
//   View Last Saved   → open the preview of what is saved now; edits stay in
//                       the builder, unsaved (hidden if nothing is saved yet)
//   Cancel            → close, nothing happens
// The logic lives in src/hooks/useViewInvitation.js; this is only the UI,
// styled with the builder's own colors (BUILDER_UI).
// ─────────────────────────────────────────────────────────────────────────────

import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { BUILDER_UI, BUILDER_FONT } from "@/components/invitation/builderTheme";

const ViewInvitationDialog = ({
  open, canViewLastSaved = true, savesRegistryMessage = false,
  onSaveAndView, onViewLastSaved, onCancel,
}) => (
  <AlertDialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
    <AlertDialogContent style={{ fontFamily: BUILDER_FONT, backgroundColor: BUILDER_UI.surface }}>
      <AlertDialogHeader>
        <AlertDialogTitle style={{ color: BUILDER_UI.onSurface }}>
          You have unsaved changes
        </AlertDialogTitle>
        <AlertDialogDescription style={{ color: BUILDER_UI.onSurfaceVar }}>
          The invitation preview only shows what is saved. Save your changes first to see
          them, or view the version you last saved.
          {savesRegistryMessage && " Save and View also saves your Registry message."}
          {!canViewLastSaved && " Nothing has been saved yet, so there is no earlier version to view."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel onClick={onCancel}
          style={{ borderColor: BUILDER_UI.inputBorder, color: BUILDER_UI.onSurface }}>
          Cancel
        </AlertDialogCancel>
        {canViewLastSaved && (
          <button type="button" onClick={onViewLastSaved}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md border text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ borderColor: BUILDER_UI.primary, color: BUILDER_UI.primary, backgroundColor: "transparent" }}>
            View Last Saved
          </button>
        )}
        <button type="button" onClick={onSaveAndView}
          className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-semibold text-white shadow-sm transition-all active:scale-95"
          style={{ background: `linear-gradient(135deg, ${BUILDER_UI.primary} 0%, ${BUILDER_UI.primaryLight} 100%)` }}>
          Save and View
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ViewInvitationDialog;
