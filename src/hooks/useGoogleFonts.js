// src/hooks/useGoogleFonts.js
// ─────────────────────────────────────────────────────────────────────────────
// Loads invitation fonts from Google Fonts by injecting one <link> per font
// (moved here from CreateInvitation.jsx so the guest RSVP page can share it).
// Only names from INVITATION_FONTS are loaded, so stored data can never put an
// arbitrary string into the stylesheet URL. Links are never removed — a font
// loaded once stays available for the rest of the session.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { isInvitationFont } from "@/lib/invitationTheme";

export const googleFontId = (font) => `google-font-${font.replace(/ /g, "+")}`;

export const googleFontHref = (font) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;

/** Inject a stylesheet <link> for each allowed font that isn't loaded yet. */
export const loadGoogleFonts = (fonts = []) => {
  if (typeof document === "undefined") return;
  [...new Set(fonts)].filter(isInvitationFont).forEach(font => {
    const id = googleFontId(font);
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontHref(font);
    document.head.appendChild(link);
  });
};

export const useGoogleFonts = (fonts = []) => {
  const key = fonts.filter(Boolean).join("|");
  useEffect(() => {
    loadGoogleFonts(key ? key.split("|") : []);
  }, [key]);
};

export default useGoogleFonts;
