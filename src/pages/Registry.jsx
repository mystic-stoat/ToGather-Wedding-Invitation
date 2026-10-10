// src/pages/Registry.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   Registry is now managed in the Invitation Builder's "Registry" tab
//   (/create-invitation?section=registry), next to a live phone preview.
//   This route (/gift-registry) only redirects there, so existing bookmarks
//   and links keep working.
//
// WHERE THE REGISTRY CODE LIVES NOW (moved from this file, same behavior):
//   src/hooks/useRegistries.js                     state + immediate-save actions
//   src/components/registry/RegistryMessageCard.jsx message + Save Message
//   src/components/registry/RegistryRow.jsx         one link: show/hide, edit, delete
//   src/components/registry/RegistryFormModal.jsx   add / edit modal
//   src/components/registry/DeleteRegistryModal.jsx delete confirmation
//   src/components/registry/RegistrySection.jsx     guest-facing section (RSVP page + preview)
//   src/components/invitation/RegistryPanel.jsx     the builder tab
//   src/lib/registry.js                             URL check + visibility rule
//
// DATA is unchanged: invitations/{weddingId}.registries / .registryMessage
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate } from "react-router-dom";

const REGISTRY_BUILDER_PATH = "/create-invitation?section=registry";

const Registry = () => <Navigate to={REGISTRY_BUILDER_PATH} replace />;

export default Registry;
