// src/components/qa/qaNavigation.js
// ─────────────────────────────────────────────────────────────────────────────
// Scrolling for Q&A "link to section" answers. Answers never open the builder:
//   - Builder phone preview → scrollToSectionWithin(previewScrollBox, id)
//     finds the preview section ([data-section="…"], Our Story = section.tg-story)
//     and scrolls only the phone screen.
//   - Guest RSVP page       → scrollToGuestSection(id) scrolls the page to the
//     element with id="tg-section-<id>".
// ─────────────────────────────────────────────────────────────────────────────

/** The element for a Q&A section id inside the builder preview (or null). */
export const findPreviewSection = (root, sectionId) => {
  if (!root || !sectionId) return null;
  if (sectionId === "story") return root.querySelector("section.tg-story");
  return root.querySelector(`[data-section="${sectionId}"]`);
};

/** Scroll the preview's own scroll box so that section is at the top. */
export const scrollToSectionWithin = (container, sectionId) => {
  const el = findPreviewSection(container, sectionId);
  if (!el || !container) return false;
  const top = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top;
  if (typeof container.scrollTo === "function") container.scrollTo({ top, behavior: "smooth" });
  else container.scrollTop = top;
  return true;
};

/** Id used for guest-page scroll targets, e.g. "tg-section-rsvp". */
export const guestSectionId = (sectionId) => `tg-section-${sectionId}`;

/** Scroll the guest page to a section (if it exists on the page). */
export const scrollToGuestSection = (sectionId) => {
  const el = typeof document !== "undefined" ? document.getElementById(guestSectionId(sectionId)) : null;
  if (!el) return false;
  if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
};
