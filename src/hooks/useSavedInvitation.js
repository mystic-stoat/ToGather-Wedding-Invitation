// src/hooks/useSavedInvitation.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   Loads the logged-in couple's LATEST SAVED invitation for the standalone
//   owner preview (/invitation/preview): the invitation document (theme,
//   texts, hero photo, Wedding Party, Registry, Q&A, visibility switches) plus
//   its Our Story entries. Uses the same owner-only reads the builder already
//   uses (getInvitationByUser + loadAllStoryEntries) — no new Firestore access
//   and no security rule changes.
//
//   It never sees the builder's unsaved edits: what you get is exactly what is
//   stored in Firestore right now.
//
// RETURNS { status, view, storyError, refreshing, reload }
//   status      "loading" | "ready" | "empty" (no invitation yet) | "error"
//   view        savedInvitationToView(...) result when status === "ready"
//   storyError  true when the invitation loaded but Our Story didn't (the
//               page still shows everything else)
//   refreshing  true while reload() runs (the current view stays on screen)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { getInvitationByUser } from "@/lib/firestore";
import { loadAllStoryEntries } from "@/lib/storyStore";
import { savedInvitationToView } from "@/lib/invitationView";

export const useSavedInvitation = (uid) => {
  const [state, setState] = useState({ status: "loading", view: null, storyError: false });
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const inv = await getInvitationByUser(uid);
        if (cancelled) return;
        if (!inv) {
          setState({ status: "empty", view: null, storyError: false });
          return;
        }
        // Our Story is a separate subcollection. If it fails, still show the
        // rest of the invitation and say so.
        let entries = [];
        let storyError = false;
        try {
          entries = await loadAllStoryEntries(inv.weddingId);
        } catch (err) {
          console.error("Preview: load story error:", err);
          storyError = true;
        }
        if (!cancelled) setState({ status: "ready", view: savedInvitationToView(inv, entries), storyError });
      } catch (err) {
        console.error("Preview: load invitation error:", err);
        if (!cancelled) setState({ status: "error", view: null, storyError: false });
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt(n => n + 1);
  }, []);

  return { ...state, refreshing, reload };
};

export default useSavedInvitation;
