// src/hooks/useRegistries.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   The Registry state and actions that used to live in src/pages/Registry.jsx,
//   now used by the Invitation Builder's Registry tab (and its phone preview).
//
// SAVING — IMMEDIATE, exactly like the former Registry page:
//   - Add / edit / delete / show-hide a link → written right away through the
//     existing transaction helpers in src/lib/firestore.js (addRegistry,
//     updateRegistry, deleteRegistry). Each returns the updated array.
//   - Registry message → written when the couple clicks "Save Message",
//     via saveInvitation(uid, { registryMessage }, weddingId) — a partial
//     update that touches no other invitation field.
//   - "Show Registry on Invitation" → written as soon as it's switched, the
//     same partial way (registryShowOnInvitation). Off hides the whole
//     section from guests; the message and links are kept.
//   The builder's main Save button never writes `registries`,
//   `registryMessage` or `registryShowOnInvitation` (see handleSave in
//   src/pages/CreateInvitation.jsx).
//
// DATA: invitations/{weddingId}.registries / .registryMessage /
//       .registryShowOnInvitation (missing = shown)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { saveInvitation, addRegistry, updateRegistry, deleteRegistry } from "@/lib/firestore";
import { isRegistryVisible, isRegistrySectionShown } from "@/lib/registry";

const NEED_WEDDING = "Please fill in your wedding details first.";

/**
 * @param {object} p
 *   userId     the signed-in host's uid
 *   weddingId  the invitation id (null/undefined until one exists)
 */
export const useRegistries = ({ userId, weddingId }) => {
  const [status, setStatus]                 = useState("loading"); // loading | ready | error
  const [registries, setRegistries]         = useState([]);

  const [message, setMessage]               = useState("");   // what's in the textarea
  const [savedMessage, setSavedMessage]     = useState("");   // what's stored
  const [messageSaving, setMessageSaving]   = useState(false);
  const [messageSaved, setMessageSaved]     = useState(false);
  const [messageError, setMessageError]     = useState("");

  const [formModal, setFormModal]           = useState(null); // null | { registry: entry | null }
  const [formSaving, setFormSaving]         = useState(false);
  const [formError, setFormError]           = useState("");

  const [deleteTarget, setDeleteTarget]     = useState(null); // entry pending confirmation
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState("");

  const [busyId, setBusyId]                 = useState(null); // row-level spinner for toggle

  const [showOnInvitation, setShowOnInvitationState] = useState(true); // section on/off
  const [showSaving, setShowSaving]         = useState(false);
  const [showError, setShowError]           = useState("");

  // ── Loading (from the invitation doc the builder already read) ─────────────
  /** Call once the invitation was read (with null when there is none yet). */
  const initFromInvitation = (inv) => {
    // Registries are embedded on the invitation doc — no second query needed
    setRegistries(Array.isArray(inv?.registries) ? inv.registries : []);
    const text = typeof inv?.registryMessage === "string" ? inv.registryMessage : "";
    setMessage(text);
    setSavedMessage(text);
    // Older invitations have no setting → the section stays shown
    setShowOnInvitationState(isRegistrySectionShown(inv));
    setStatus("ready");
  };

  const markLoadFailed = () => setStatus("error");

  // ── Show Registry on Invitation (whole section) ────────────────────────────
  const setShowOnInvitation = async (next) => {
    if (!weddingId) {
      setShowError(NEED_WEDDING);
      return;
    }
    const previous = showOnInvitation;
    setShowOnInvitationState(next); // optimistic — reverted below if the write fails
    setShowSaving(true);
    setShowError("");
    try {
      await saveInvitation(userId, { registryShowOnInvitation: next }, weddingId);
    } catch (err) {
      console.error("Registry visibility save error:", err);
      setShowOnInvitationState(previous);
      setShowError("Couldn't update the Registry section. Please try again.");
    } finally {
      setShowSaving(false);
    }
  };

  // ── Registry message ───────────────────────────────────────────────────────
  const changeMessage = (text) => {
    setMessage(text);
    setMessageSaved(false);
    setMessageError("");
  };

  const saveMessage = async () => {
    if (!weddingId) {
      setMessageError(NEED_WEDDING);
      return;
    }
    setMessageSaving(true);
    setMessageError("");
    setMessageSaved(false);
    const text = message;
    try {
      await saveInvitation(userId, { registryMessage: text }, weddingId);
      setSavedMessage(text);
      setMessageSaved(true);
    } catch (err) {
      console.error("Registry message save error:", err);
      // `message` state is untouched — the user's text stays in the textarea
      setMessageError("Couldn't save your message. Please try again.");
    } finally {
      setMessageSaving(false);
    }
  };

  // ── Add / edit ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (!weddingId) {
      alert(NEED_WEDDING);
      return;
    }
    setFormError("");
    setFormModal({ registry: null });
  };

  const openEdit = (registry) => {
    setFormError("");
    setFormModal({ registry });
  };

  const closeForm = () => {
    setFormModal(null);
    setFormError("");
  };

  const saveRegistry = async ({ name, url, isVisible }) => {
    if (!weddingId) {
      setFormError(NEED_WEDDING);
      return;
    }
    setFormSaving(true);
    setFormError("");
    try {
      // Each helper returns the updated registries array from the transaction
      const updated = formModal?.registry?.id
        ? await updateRegistry(weddingId, formModal.registry.id, { name, url, isVisible })
        : await addRegistry(weddingId, { name, url, isVisible });
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
  const toggleVisible = async (registry) => {
    const next = !isRegistryVisible(registry);
    setBusyId(registry.id);
    // Optimistic update — reverted below if the write fails
    setRegistries(prev => prev.map(r =>
      r.id === registry.id ? { ...r, isVisible: next } : r
    ));
    try {
      setRegistries(await updateRegistry(weddingId, registry.id, { isVisible: next }));
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  const requestDelete = (registry) => {
    setDeleteError("");
    setDeleteTarget(registry);
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      setRegistries(await deleteRegistry(weddingId, deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Registry delete error:", err);
      setDeleteError(`Couldn't delete "${deleteTarget.name}". Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  return {
    status, weddingId, registries,
    message, savedMessage, messageDirty: message !== savedMessage,
    messageSaving, messageSaved, messageError,
    formModal, formSaving, formError,
    deleteTarget, deleting, deleteError,
    busyId,
    showOnInvitation, showSaving, showError, setShowOnInvitation,
    initFromInvitation, markLoadFailed,
    changeMessage, saveMessage,
    openAdd, openEdit, closeForm, saveRegistry,
    toggleVisible,
    requestDelete, closeDelete, confirmDelete,
  };
};

export default useRegistries;
