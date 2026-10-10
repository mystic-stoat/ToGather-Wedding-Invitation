// src/lib/registry.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Pure helpers (no Firebase, no React) shared by the Registry tab in the
//   Invitation Builder, its phone preview, and the guest RSVP page.
//
// DATA (see src/lib/firestore.js "REGISTRIES"):
//   invitations/{weddingId}.registries               = [{ id, name, url, isVisible }]
//   invitations/{weddingId}.registryMessage          = string
//   invitations/{weddingId}.registryShowOnInvitation = boolean (missing = shown)
//
// VISIBILITY RULES (one set of rules everywhere):
//   - Section: invitations/{weddingId}.registryShowOnInvitation. Only an
//     explicit false hides the whole Gift Registry section (message + links);
//     older invitations without the field keep showing it. Nothing is deleted.
//   - Links: a registry link is shown to guests ONLY when isVisible === true.
//     Hidden links stay in the array and remain editable in the builder.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Only http:// and https:// links are allowed — this rejects `javascript:`,
 * `data:`, and malformed input that `new URL()` itself can't parse.
 * (Moved unchanged from src/pages/Registry.jsx.)
 */
export const isValidRegistryUrl = (value) => {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** Whether the couple shows the Gift Registry section at all (default: yes). */
export const isRegistrySectionShown = (source) => source?.registryShowOnInvitation !== false;

/** True only when guests may see this registry link. */
export const isRegistryVisible = (registry) => registry?.isVisible === true;

/** Links guests see, in the couple's order. */
export const getVisibleRegistries = (registries) =>
  (Array.isArray(registries) ? registries : []).filter(isRegistryVisible);

/** True when the guest-facing Registry section has anything to show. */
export const hasRegistryContent = (registries, registryMessage) =>
  Boolean(String(registryMessage ?? "").trim()) || getVisibleRegistries(registries).length > 0;
