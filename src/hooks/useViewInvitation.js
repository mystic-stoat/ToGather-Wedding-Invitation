// src/hooks/useViewInvitation.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   The Invitation Builder's "View Invitation" button (Phase 3). Opens the
//   couple's LAST SAVED invitation (/invitation/preview) in a new browser tab.
//
//   - No unsaved changes → opens the preview right away.
//   - Unsaved changes    → opens a dialog: Save and View / View Last Saved /
//                          Cancel.
//   - Save and View      → runs the builder's normal Save. Only when EVERYTHING
//                          saved successfully is the preview shown. If the save
//                          fails (validation, network, photos…), a tab opened
//                          for it is closed again — the couple never sees a
//                          preview that looks like it contains changes that
//                          weren't saved.
//
//   ONE preview tab: every open targets the same named window
//   (PREVIEW_WINDOW_NAME), so repeated clicks reload that tab instead of
//   piling up new ones. A lock (busyRef) ignores clicks while a Save and View
//   is running, so it can never save twice or open twice.
//
//   Popup blockers: browsers only allow window.open() during the click itself,
//   not after an `await`. So Save and View opens (or reuses) the tab
//   immediately, shows "Saving your invitation…" in it, and only points it at
//   the preview once the save has succeeded. If the browser blocks the tab
//   anyway, `popupBlocked` is set so the builder can offer a normal link.
//
//   Viewing never writes anything itself: it only reads what Save wrote.
//
//   The builder's own tab is NEVER the preview tab. A browser tab keeps its
//   window.name when it navigates within the site, so a tab that was opened
//   as the preview and then went back to the builder (the preview's "Builder"
//   button) is still called PREVIEW_WINDOW_NAME. window.open() would then
//   return the BUILDER itself and navigate it away — losing the builder and,
//   while saving, triggering the browser's "Leave site?" warning (from
//   useInvitationMedia's beforeunload guard). So the builder gives up that name
//   (releasePreviewWindowName) and never uses a "tab" that is its own window.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

export const PREVIEW_PATH = "/invitation/preview";
export const PREVIEW_WINDOW_NAME = "togather-invitation-preview";

/** The builder tab must not carry the preview tab's name (see the header). */
export const releasePreviewWindowName = () => {
  try {
    if (window.name === PREVIEW_WINDOW_NAME) window.name = "";
  } catch {
    // window.name is always writable in practice; nothing else to do
  }
};

/**
 * window.open() into the single named preview tab — but never into the
 * builder's own window. Returns the tab, or null when there is no usable tab
 * (blocked by the browser, or it would have been this window).
 */
const openPreviewWindow = (url) => {
  releasePreviewWindowName();
  const tab = window.open(url, PREVIEW_WINDOW_NAME);
  return tab && tab !== window ? tab : null;
};

/** Shown in a just-opened tab while the builder saves. */
const showSavingMessage = (tab) => {
  try {
    tab.document.title = "Saving… · ToGather";
    tab.document.body.innerHTML =
      '<p style="font-family: system-ui, sans-serif; color: #46483c; text-align: center; margin-top: 30vh;">' +
      "Saving your invitation…</p>";
  } catch {
    // Not critical — the tab is replaced by the preview (or closed) shortly.
  }
};

/** True for a brand-new empty tab (as opposed to an already-open preview). */
const isBlankTab = (tab) => {
  try {
    return tab.location.href === "about:blank";
  } catch {
    return false;
  }
};

/**
 * @param {object} p
 *   hasSavedInvitation  an invitation exists in Firestore (something to view)
 *   hasUnsavedChanges   Save would write something different right now
 *   saveChanges         async () => boolean — the builder's full save; true
 *                       only if everything was saved
 *   disabled            builder is loading or already saving
 */
export const useViewInvitation = ({ hasSavedInvitation, hasUnsavedChanges, saveChanges, disabled = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingForView, setSavingForView] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const busyRef = useRef(false);
  const tabRef = useRef(null); // the preview tab this builder opened, if still open

  const liveTab = () =>
    (tabRef.current && tabRef.current !== window && !tabRef.current.closed ? tabRef.current : null);

  // A builder opened in a former preview tab gives up that tab's name at once,
  // so no other builder tab's "View Invitation" can navigate it away either.
  useEffect(() => { releasePreviewWindowName(); }, []);

  // Open (or reload) the single preview tab with the last saved invitation.
  const openPreview = useCallback(() => {
    setPopupBlocked(false);
    const tab = openPreviewWindow(PREVIEW_PATH);
    if (!tab) {
      setPopupBlocked(true);
      return false;
    }
    tabRef.current = tab;
    tab.focus?.();
    return true;
  }, []);

  /** The View Invitation button. */
  const requestView = () => {
    if (busyRef.current || disabled) return;
    if (hasUnsavedChanges) {
      setDialogOpen(true);
      return;
    }
    if (!hasSavedInvitation) return;
    openPreview();
  };

  /** Dialog: open the preview without saving (it shows the last saved version). */
  const viewLastSaved = () => {
    setDialogOpen(false);
    if (busyRef.current || !hasSavedInvitation) return;
    openPreview();
  };

  /** Dialog: close it, change nothing. */
  const cancel = () => setDialogOpen(false);

  /** Dialog: save everything, then show the preview — only if the save worked. */
  const saveAndView = async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setDialogOpen(false);
    setSavingForView(true);
    setPopupBlocked(false);

    // Reserve the tab now (during the click). Reuse an open preview tab if
    // there is one; a brand-new tab shows "Saving…" until the save finishes.
    let tab = liveTab();
    let fresh = false;
    if (!tab) {
      tab = openPreviewWindow("");
      if (tab) {
        tabRef.current = tab;
        fresh = isBlankTab(tab);
        if (fresh) showSavingMessage(tab);
      }
    }

    let ok = false;
    try {
      ok = (await saveChanges()) === true;
    } catch (err) {
      console.error("Save and View failed:", err);
      ok = false;
    }

    if (ok) {
      if (tab && !tab.closed) {
        // replace(): the "Saving…" page doesn't stay in the tab's history
        tab.location.replace(PREVIEW_PATH);
        tab.focus?.();
      } else {
        setPopupBlocked(true); // saved — offer a link instead
      }
    } else if (tab && fresh && !tab.closed) {
      // Never leave a tab that could look like it shows the failed changes.
      // (An already-open preview tab is left alone: it still shows the last
      // SAVED version, which is accurate.)
      tab.close();
      tabRef.current = null;
    }

    busyRef.current = false;
    setSavingForView(false);
    return ok;
  };

  return {
    dialogOpen, savingForView, popupBlocked,
    requestView, saveAndView, viewLastSaved, cancel,
    dismissPopupBlocked: () => setPopupBlocked(false),
  };
};

export default useViewInvitation;
