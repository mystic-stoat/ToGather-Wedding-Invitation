// src/lib/guestInvitation.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Data access for the GUEST invitation website (/rsvp/:inviteeId/:token,
//   Phase 4). Pages call ONLY these two functions:
//
//     fetchGuestInvitation(inviteeId, token)
//       → { status: "ok", guest, view }        valid link
//       → { status: "invalid" }                unknown guest, wrong token, or
//                                              the invitation is gone
//     submitGuestRsvp({ inviteeId, token, response })
//       → { success: true } | { success: false, error }
//
//   and render only what they return:
//     guest  — the guest's OWN details (name, email, plus-one limit, whether
//              and how they already replied). Never the token or any other
//              guest's data.
//     view   — savedInvitationToView() of a GUEST-SAFE copy of the invitation
//              (toGuestInvitation below): only what the invitation displays.
//              No userId, isPublished, media bookkeeping, hidden registry
//              links, hidden Q&A, or data of sections the couple switched off.
//
// ⚠️ SECURITY — DO NOT DEPLOY THE GUEST WEBSITE UNTIL PHASE 5 IS DONE.
//   Phase 4 still reads Firestore from the browser, exactly like the former
//   RSVP page: the token is compared HERE, in the browser, which is NOT a
//   security check. Today's rules let anyone read (and list) invitee and
//   invitation documents, so the full documents still travel over the
//   network even though the page only renders the guest-safe parts.
//   Phase 5 replaces the bodies of these two functions with callable Cloud
//   Functions that check the token on the server and return this SAME shape
//   (toGuestInvitation is the spec for what the server may return), and
//   tightens the rules. The pages don't change. See docs/INVITATION_WEBSITE.md.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { submitRSVP } from "@/lib/firestore";
import { loadAllStoryEntries } from "@/lib/storyStore";
import { THEME_FIELDS } from "@/lib/invitationTheme";
import { DATE_SETTING_FIELDS } from "@/lib/weddingDate";
import { VENUE_SETTING_FIELDS } from "@/lib/venueDisplay";
import { PARTY_SETTING_FIELDS, normalizePartyMembers, toStoredPartyMember } from "@/lib/weddingParty";
import { getTravelShowOnInvitation } from "@/lib/travelStay";
import { isRegistrySectionShown, isRegistryVisible } from "@/lib/registry";
import { isQaSectionShown, normalizeQaItems } from "@/lib/qa";
import { savedInvitationToView } from "@/lib/invitationView";

// Invitation fields a guest's invitation may show (besides those built below).
const GUEST_FIELDS = [
  ...THEME_FIELDS, ...DATE_SETTING_FIELDS, ...VENUE_SETTING_FIELDS, ...PARTY_SETTING_FIELDS,
  "greetingTitle", "greetingMessage", "closureTitle",
  "weddingDate", "ceremonyTime", "venueName", "venueAddress", "venueURL",
  "inviteDeadline", "mealOptions", "heroImage",
  "musicTrackId", "musicShowOnInvitation",
  "travelItems", "travelMessage", "travelShowOnInvitation",
  "storyTitle", "storyShowOnInvitation",
  "registryMessage", "registryShowOnInvitation",
  "qaShowOnInvitation",
];

const firstNameOnly = (name) => ({ first: typeof name?.first === "string" ? name.first : "" });

/**
 * toGuestInvitation
 * A guest-safe copy of an invitations/{weddingId} document: only the fields
 * the invitation displays, and nothing from sections the couple hid.
 * (Phase 5: the Cloud Function returns exactly this.)
 */
export const toGuestInvitation = (inv) => {
  if (!inv) return null;
  const out = {};
  for (const key of GUEST_FIELDS) if (inv[key] !== undefined) out[key] = inv[key];

  out.groomName = firstNameOnly(inv.groomName);
  out.brideName = firstNameOnly(inv.brideName);

  // Sections switched off → their content isn't sent at all
  if (!(inv.musicShowOnInvitation ?? true)) out.musicTrackId = "";
  if (!getTravelShowOnInvitation(inv)) { out.travelItems = []; out.travelMessage = ""; }
  out.partyMembers = inv.partyShowOnInvitation === false
    ? []
    // public member fields only (contacts appear only where the couple chose)
    : normalizePartyMembers(inv.partyMembers).map(m => toStoredPartyMember(m));
  out.registries = isRegistrySectionShown(inv) && Array.isArray(inv.registries)
    ? inv.registries.filter(isRegistryVisible).map(({ id, name, url, isVisible }) => ({ id, name, url, isVisible }))
    : [];
  if (!isRegistrySectionShown(inv)) out.registryMessage = "";
  out.qaItems = isQaSectionShown(inv) ? normalizeQaItems(inv.qaItems).filter(q => q.isVisible) : [];
  return out;
};

/**
 * toGuestDetails
 * The guest's OWN details from their invitee document — what the RSVP form
 * pre-fills and what "you already replied" shows. Never the token.
 */
export const toGuestDetails = (invitee) => {
  const parts = (typeof invitee?.guestName === "string" ? invitee.guestName : "").trim().split(/\s+/).filter(Boolean);
  const respondedAt = invitee?.respondedAt?.toDate ? invitee.respondedAt.toDate() : null;
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
    email: typeof invitee?.email === "string" ? invitee.email : "",
    plusOneLimit: Number.isInteger(invitee?.plusOneLimit) ? invitee.plusOneLimit : 0,
    responded: invitee?.tokenUsed === true,
    rsvpStatus: invitee?.rsvpStatus === "Accepted" || invitee?.rsvpStatus === "Declined" ? invitee.rsvpStatus : "",
    respondedAt: respondedAt && !Number.isNaN(respondedAt.getTime()) ? respondedAt.toISOString() : "",
  };
};

/**
 * fetchGuestInvitation — see the header. Phase 4: browser reads (NOT secure).
 * Our Story is only loaded when the couple shows it; if the rules don't let
 * guests read it (e.g. an unpublished invitation), it is simply left out.
 */
export const fetchGuestInvitation = async (inviteeId, token) => {
  if (!inviteeId || !token) return { status: "invalid" };

  const inviteeSnap = await getDoc(doc(db, "invitee", inviteeId));
  if (!inviteeSnap.exists()) return { status: "invalid" };
  const invitee = inviteeSnap.data();
  // ⚠️ Browser-side comparison — a convenience, not protection (Phase 5).
  if (!invitee || invitee.token !== token || !invitee.weddingId) return { status: "invalid" };

  const invSnap = await getDoc(doc(db, "invitations", invitee.weddingId));
  if (!invSnap.exists()) return { status: "invalid" };
  const invitation = toGuestInvitation({ weddingId: invSnap.id, ...invSnap.data() });

  let storyEntries = [];
  if (invitation.storyShowOnInvitation !== false) {
    try {
      storyEntries = await loadAllStoryEntries(invSnap.id);
    } catch (err) {
      // Not readable for guests (rules) or failed — the invitation still shows
      console.warn("Guest invitation: Our Story not available", err?.code || err?.message);
      storyEntries = [];
    }
  }

  return {
    status: "ok",
    guest: toGuestDetails(invitee),
    view: savedInvitationToView(invitation, storyEntries),
  };
};

/**
 * submitGuestRsvp — Phase 4: the existing submitRSVP (unchanged behavior:
 * finds the guest by token, refuses a used token, sets tokenUsed). Phase 5:
 * a callable Cloud Function that verifies the token on the server.
 */
export const submitGuestRsvp = async ({ token, response }) => submitRSVP(token, response);
