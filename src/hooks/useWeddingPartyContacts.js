// src/hooks/useWeddingPartyContacts.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS HOOK DOES:
//   Loads and saves Wedding Party members' PRIVATE contact details
//   (invitations/{weddingId}/private/weddingPartyContacts, owner-only).
//
//   - Loads lazily, the first time the Wedding Party tab is opened, and merges
//     phone/email into the members held by useInvitationMedia.
//   - Until it has loaded, contact fields are read-only in the builder and
//     save() writes nothing — so a failed or skipped load can never wipe the
//     stored contacts (same "only after a successful load" rule the builder
//     uses for its other settings).
//   - save() only writes when something changed.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { loadPartyContacts, savePartyContacts } from "@/lib/weddingPartyStore";
import { mergePrivateContacts, toPrivateContacts, sameContacts } from "@/lib/weddingParty";

/**
 * @param {object} p
 *   weddingId          current invitation id (null before the first save)
 *   invitationLoaded   true once the invitation was read (or there is none)
 *   active             true while the Wedding Party tab is open
 *   setMembers         setter from useInvitationMedia (functional updates)
 * @returns {{ status: "idle"|"loading"|"ready"|"error", retry, save }}
 */
export const useWeddingPartyContacts = ({ weddingId, invitationLoaded, active, setMembers }) => {
  const [status, setStatus] = useState("idle");
  const savedRef = useRef({}); // contacts as stored

  const load = async (wid) => {
    if (!wid) {
      // No invitation yet → nothing stored; contacts are saved after the first save.
      savedRef.current = {};
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      const contacts = await loadPartyContacts(wid);
      savedRef.current = contacts;
      setMembers(prev => mergePrivateContacts(prev, contacts));
      setStatus("ready");
    } catch (err) {
      console.error("Load wedding party contacts error:", err);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (active && invitationLoaded && status === "idle") load(weddingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, invitationLoaded, status, weddingId]);

  const retry = () => load(weddingId);

  /**
   * Save after the members were saved. `members` = the members as saved.
   * Resolves { ok: true } or { ok: false, notice }.
   */
  const save = async (wid, members) => {
    if (status !== "ready" || !Array.isArray(members)) return { ok: true };
    const next = toPrivateContacts(members);
    if (sameContacts(next, savedRef.current)) return { ok: true };
    try {
      await savePartyContacts(wid, next);
      savedRef.current = next;
      return { ok: true };
    } catch (err) {
      console.error("Save wedding party contacts error:", err);
      return {
        ok: false,
        notice: {
          kind: "error",
          text: "Your other changes were saved, but wedding party phone numbers and emails couldn't be saved. Please click Save to try again.",
        },
      };
    }
  };

  return { status, retry, save };
};

export default useWeddingPartyContacts;
