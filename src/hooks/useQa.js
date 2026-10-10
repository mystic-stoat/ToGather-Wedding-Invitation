// src/hooks/useQa.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   State and actions for the Invitation Builder's Q&A tab. Follows the
//   Registry pattern (src/hooks/useRegistries.js): every change SAVES
//   IMMEDIATELY through transaction helpers in src/lib/firestore.js that
//   return the updated qaItems array; the builder's main Save never writes
//   qaItems / qaShowOnInvitation / qaStartersCreated.
//
//   Starter questions are added the first time the Q&A tab is opened
//   (ensureStarters), exactly once per invitation — see initQaStarters.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import {
  saveInvitation, initQaStarters, addQaItem, updateQaItem, deleteQaItem, moveQaItem,
} from "@/lib/firestore";
import {
  normalizeQaItems, buildStarterItems, createQaItem, cleanQaInput, isQaSectionShown,
  moveQaItemInList, QA_MAX_ITEMS,
} from "@/lib/qa";

const NEED_WEDDING = "Please fill in your wedding details first.";

/**
 * @param {object} p
 *   userId     the signed-in host's uid
 *   weddingId  the invitation id (null/undefined until one exists)
 */
export const useQa = ({ userId, weddingId }) => {
  const [status, setStatus]                 = useState("loading"); // loading | ready | error
  const [items, setItemsState]              = useState([]);
  const [startersCreated, setStartersCreated] = useState(false);
  const [starterStatus, setStarterStatus]   = useState("idle");    // idle | creating | done | error
  const startersInFlight                    = useRef(false);

  const [showOnInvitation, setShowState]    = useState(false);     // section on/off (default OFF)
  const [showSaving, setShowSaving]         = useState(false);
  const [showError, setShowError]           = useState("");

  const [formModal, setFormModal]           = useState(null);      // null | { item: item | null }
  const [formSaving, setFormSaving]         = useState(false);
  const [formError, setFormError]           = useState("");

  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState("");

  const [busyId, setBusyId]                 = useState(null);      // row spinner (toggle/move)
  const [actionError, setActionError]       = useState("");

  const setItems = (raw) => setItemsState(normalizeQaItems(raw));

  // ── Loading (from the invitation doc the builder already read) ─────────────
  const initFromInvitation = (inv) => {
    setItems(inv?.qaItems);
    setStartersCreated(inv?.qaStartersCreated === true);
    setShowState(isQaSectionShown(inv));
    setStatus("ready");
  };

  const markLoadFailed = () => setStatus("error");

  // ── Starter questions — once per invitation, when the tab is first opened ──
  const ensureStarters = async () => {
    if (status !== "ready" || !weddingId || startersCreated || startersInFlight.current) return;
    startersInFlight.current = true;
    setStarterStatus("creating");
    try {
      // The transaction re-checks qaStartersCreated on the server, so a second
      // tab (or a stale page) can never add them twice or restore deleted ones.
      const res = await initQaStarters(weddingId, buildStarterItems());
      setItems(res.items);
      setStartersCreated(true);
      setStarterStatus("done");
    } catch (err) {
      console.error("Q&A starter questions error:", err);
      setStarterStatus("error");
    } finally {
      startersInFlight.current = false;
    }
  };

  const retryStarters = () => { setStarterStatus("idle"); ensureStarters(); };

  // ── Show Q&A on Invitation (whole section) ─────────────────────────────────
  const setShowOnInvitation = async (next) => {
    if (!weddingId) { setShowError(NEED_WEDDING); return; }
    const previous = showOnInvitation;
    setShowState(next); // optimistic — reverted if the write fails
    setShowSaving(true);
    setShowError("");
    try {
      await saveInvitation(userId, { qaShowOnInvitation: next }, weddingId);
    } catch (err) {
      console.error("Q&A visibility save error:", err);
      setShowState(previous);
      setShowError("Couldn't update the Q&A section. Please try again.");
    } finally {
      setShowSaving(false);
    }
  };

  // ── Add / edit ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (!weddingId) { setActionError(NEED_WEDDING); return; }
    if (items.length >= QA_MAX_ITEMS) {
      setActionError(`You can add up to ${QA_MAX_ITEMS} questions.`);
      return;
    }
    setActionError("");
    setFormError("");
    setFormModal({ item: null });
  };

  const openEdit = (item) => { setFormError(""); setFormModal({ item }); };
  const closeForm = () => { setFormModal(null); setFormError(""); };

  const saveItem = async (values) => {
    if (!weddingId) { setFormError(NEED_WEDDING); return; }
    const editing = formModal?.item;
    const clean = cleanQaInput(values, { autoSource: editing?.autoSource || null });
    setFormSaving(true);
    setFormError("");
    try {
      const updated = editing?.id
        ? await updateQaItem(weddingId, editing.id, clean)
        : await addQaItem(weddingId, createQaItem(clean));
      setItems(updated);
      setFormModal(null);
    } catch (err) {
      console.error("Q&A save error:", err);
      // Modal stays open with the couple's input intact
      setFormError(String(err?.message || "").startsWith("You can add up to")
        ? err.message
        : "Couldn't save this question. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  // ── Visibility of one question ─────────────────────────────────────────────
  const toggleVisible = async (item) => {
    const next = !item.isVisible;
    setBusyId(item.id);
    setActionError("");
    setItemsState(prev => prev.map(i => (i.id === item.id ? { ...i, isVisible: next } : i)));
    try {
      setItems(await updateQaItem(weddingId, item.id, { isVisible: next }));
    } catch (err) {
      console.error("Q&A visibility error:", err);
      setItemsState(prev => prev.map(i => (i.id === item.id ? { ...i, isVisible: !next } : i)));
      setActionError(`Couldn't update "${item.question}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  // ── Reorder ────────────────────────────────────────────────────────────────
  const move = async (item, delta) => {
    const before = items;
    const optimistic = moveQaItemInList(items, item.id, delta);
    if (optimistic === items) return;
    setBusyId(item.id);
    setActionError("");
    setItemsState(optimistic);
    try {
      setItems(await moveQaItem(weddingId, item.id, delta));
    } catch (err) {
      console.error("Q&A move error:", err);
      setItemsState(before);
      setActionError(`Couldn't move "${item.question}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const requestDelete = (item) => { setDeleteError(""); setDeleteTarget(item); };
  const closeDelete = () => { setDeleteTarget(null); setDeleteError(""); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      setItems(await deleteQaItem(weddingId, deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Q&A delete error:", err);
      setDeleteError("Couldn't delete this question. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return {
    status, weddingId, items, startersCreated, starterStatus,
    showOnInvitation, showSaving, showError,
    formModal, formSaving, formError,
    deleteTarget, deleting, deleteError,
    busyId, actionError,
    initFromInvitation, markLoadFailed, ensureStarters, retryStarters,
    setShowOnInvitation,
    openAdd, openEdit, closeForm, saveItem,
    toggleVisible, move,
    requestDelete, closeDelete, confirmDelete,
  };
};

export default useQa;
