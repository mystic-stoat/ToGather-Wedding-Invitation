// src/lib/invitationTheme.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the invitation's Color Theme: presets, defaults,
// normalization for older invitations, per-section backgrounds and WCAG
// contrast checks. Shared by the builder (CreateInvitation + ColorThemePanel),
// the phone preview and the guest RSVP page.
//
// Storage — flat fields on invitations/{weddingId}, next to the original four:
//   colorPalette1      Primary            (existing field, unchanged meaning)
//   colorPalette2      Secondary          (existing field, unchanged meaning)
//   font1 / font2      Heading / body font (existing fields, unchanged meaning)
//   colorBackground    Main invitation background
//   colorButton        Buttons and text links
//   colorAccent        Decorative ornaments (divider lines, hearts)
//   colorHeadingText   Headings, couple names, place names
//   colorBodyText      Paragraphs and small print
//   sectionBackgrounds { [sectionId]: "#rrggbb" | "main" } — only overrides.
//                      A missing key = main background, except Story, whose
//                      default is a soft tint of Secondary ("main" opts out).
//   themePreset        Name of the last color preset applied ("" = none)
//   fontPreset         Name of the last font pairing applied ("" = none)
//
// Older invitations only have the original four fields (or none). Everything
// missing is filled in by normalizeThemeSettings(), so nothing needs migrating.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed invitation colors that existed before the Color Theme tab — the
// defaults every preset starts from, so existing invitations look the same.
const DEFAULT_HEADING_TEXT = "#1a1c19";
const DEFAULT_BODY_TEXT    = "#46483c";

/** White label used on every invitation button (unchanged from before). */
export const BUTTON_LABEL_COLOR = "#ffffff";

// ── Color theme presets ───────────────────────────────────────────────────────
// name / primary / secondary / bg are the original six presets, unchanged.
// The remaining keys are each preset's defaults for the new settings.
// Buttons default to the preset's primary — except Blush, whose primary is
// too light for white button text (3.2:1), so its buttons use a deeper blush.
export const COLOR_THEMES = [
  { name: "Garden",   primary: "#56642b", secondary: "#8a9a5b", bg: "#fafaf5",
    button: "#56642b", accent: "#8a9a5b", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
  { name: "Rose",     primary: "#9b3a5a", secondary: "#c97a95", bg: "#fdf5f7",
    button: "#9b3a5a", accent: "#c97a95", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
  { name: "Navy",     primary: "#1e3a5f", secondary: "#4a7aa8", bg: "#f5f7fa",
    button: "#1e3a5f", accent: "#4a7aa8", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
  { name: "Blush",    primary: "#c97a7a", secondary: "#e5aeae", bg: "#fdf8f8",
    button: "#a85d5d", accent: "#e5aeae", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
  { name: "Sage",     primary: "#4a7a65", secondary: "#7aaa95", bg: "#f5faf7",
    button: "#4a7a65", accent: "#7aaa95", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
  { name: "Burgundy", primary: "#6b2737", secondary: "#9b5a65", bg: "#faf5f6",
    button: "#6b2737", accent: "#9b5a65", headingText: DEFAULT_HEADING_TEXT, bodyText: DEFAULT_BODY_TEXT },
];

export const DEFAULT_COLOR_PRESET = "Garden";

// ── Font pairing presets (unchanged) ──────────────────────────────────────────
export const FONT_PAIRS = [
  { name: "Classic",    heading: "Playfair Display", body: "DM Sans" },
  { name: "Editorial",  heading: "Noto Serif",       body: "Manrope" },
  { name: "Modern",     heading: "Cormorant Garamond", body: "Lato" },
  { name: "Romantic",   heading: "Great Vibes",      body: "Nunito" },
  { name: "Timeless",   heading: "Libre Baskerville", body: "Source Sans 3" },
];

export const DEFAULT_FONT_PAIR = "Classic";

// Every font the invitation may use (the fonts from the pairings) with a
// generic fallback. Only these names are ever put into a Google Fonts URL.
export const INVITATION_FONTS = [
  { name: "Playfair Display",   fallback: "serif" },
  { name: "Noto Serif",         fallback: "serif" },
  { name: "Cormorant Garamond", fallback: "serif" },
  { name: "Great Vibes",        fallback: "cursive" },
  { name: "Libre Baskerville",  fallback: "serif" },
  { name: "DM Sans",            fallback: "sans-serif" },
  { name: "Manrope",            fallback: "sans-serif" },
  { name: "Lato",               fallback: "sans-serif" },
  { name: "Nunito",             fallback: "sans-serif" },
  { name: "Source Sans 3",      fallback: "sans-serif" },
];

export const isInvitationFont = (name) =>
  typeof name === "string" && INVITATION_FONTS.some(f => f.name === name);

/** CSS font-family value for an invitation font, e.g. `"Lato", sans-serif`. */
export const fontStack = (name) => {
  const font = INVITATION_FONTS.find(f => f.name === name);
  return font ? `"${font.name}", ${font.fallback}` : "sans-serif";
};

// ── Invitation sections that can have their own background ────────────────────
// Order matches the phone preview, top to bottom (= the builder's tab order).
export const THEME_SECTIONS = [
  { id: "header",    label: "Header" },
  { id: "greetings", label: "Greetings" },
  { id: "date",      label: "Wedding Day" },
  { id: "music",     label: "Music" },
  { id: "story",     label: "Our Story" },
  { id: "party",     label: "Wedding Party" },
  { id: "venue",     label: "Venue" },
  { id: "travel",    label: "Travel & Stay" },
  { id: "rsvp",      label: "RSVP" },
  { id: "closure",   label: "Closing" },
];

/** sectionBackgrounds value meaning "use the main background". */
export const MAIN_BACKGROUND = "main";
/** Share of Secondary in the Story section's default soft tint. */
export const STORY_TINT_WEIGHT = 0.14;

// Every field the Color Theme tab owns on the invitation document.
export const THEME_FIELDS = [
  "colorPalette1", "colorPalette2", "colorBackground", "colorButton", "colorAccent",
  "colorHeadingText", "colorBodyText", "sectionBackgrounds",
  "font1", "font2", "themePreset", "fontPreset",
];

// Maps the setting fields to preset keys.
const COLOR_FIELD_TO_PRESET_KEY = {
  colorPalette1:    "primary",
  colorPalette2:    "secondary",
  colorBackground:  "bg",
  colorButton:      "button",
  colorAccent:      "accent",
  colorHeadingText: "headingText",
  colorBodyText:    "bodyText",
};
export const COLOR_FIELDS = Object.keys(COLOR_FIELD_TO_PRESET_KEY);

// ── Hex helpers ───────────────────────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isValidHex = (value) => typeof value === "string" && HEX_RE.test(value.trim());

/** "#ABC" / "abc" / "#aabbcc" → "#aabbcc"; anything else → null. */
export const normalizeHex = (value) => {
  if (!isValidHex(value)) return null;
  let h = value.trim().replace(/^#/, "").toLowerCase();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return `#${h}`;
};

const hexToRgb = (hex) => {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
};

const rgbToHex = (rgb) =>
  `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;

/** Mix `hex` with white; weight = share of the color. Same math as StorySection's tintColor. */
export const tintHex = (hex, weight = STORY_TINT_WEIGHT) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#fbf1ef"; // StorySection's fallback blush
  return rgbToHex(rgb.map(c => c * weight + 255 * (1 - weight)));
};

/** "#56642b" → "75 40% 28%" — the space-separated format Tailwind's hsl(var(--x)) tokens use. */
export const hexToHslTriplet = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(c => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const round1 = (n) => Math.round(n * 10) / 10;
  return `${round1(h)} ${round1(s * 100)}% ${round1(l * 100)}%`;
};

// ── WCAG 2.1 contrast ─────────────────────────────────────────────────────────
const relativeLuminance = ([r, g, b]) => {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two hex colors (1–21), or null if either is invalid. */
export const contrastRatio = (a, b) => {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const [hi, lo] = [relativeLuminance(ra), relativeLuminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** WCAG AA minimums. Headings are large text; everything else is normal text. */
export const CONTRAST_MIN = { normal: 4.5, large: 3 };

// ── Presets ───────────────────────────────────────────────────────────────────
export const findColorPreset = (name) => COLOR_THEMES.find(t => t.name === name) || null;
export const findFontPair = (name) => FONT_PAIRS.find(p => p.name === name) || null;

/** The color preset whose primary + secondary match (how older invitations are recognized). */
export const matchColorPreset = (primary, secondary) => {
  const p = normalizeHex(primary);
  const s = normalizeHex(secondary);
  return COLOR_THEMES.find(t => t.primary === p && (!s || t.secondary === s)) || null;
};

export const matchFontPair = (heading, body) =>
  FONT_PAIRS.find(p => p.heading === heading && p.body === body) || null;

/** The seven color fields a preset sets. */
export const presetColorFields = (preset) =>
  Object.fromEntries(COLOR_FIELDS.map(f => [f, preset[COLOR_FIELD_TO_PRESET_KEY[f]]]));

// ── Normalization ─────────────────────────────────────────────────────────────
const normalizeSectionBackgrounds = (value) => {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const { id } of THEME_SECTIONS) {
    const v = value[id];
    if (id === "story" && v === MAIN_BACKGROUND) {
      out[id] = MAIN_BACKGROUND; // Story opts out of its tint
      continue;
    }
    const hex = normalizeHex(v);
    if (hex) out[id] = hex;
  }
  return out;
};

/**
 * Every theme field with sensible defaults. Accepts an invitation document,
 * the builder's settings or {} — and is idempotent, so it's also used to clean
 * values right before saving.
 */
export const normalizeThemeSettings = (source = {}) => {
  const src = source && typeof source === "object" ? source : {};

  // The preset to take missing colors from: the stored one, or the one an older
  // invitation's primary/secondary match, or Garden.
  const storedPreset = findColorPreset(src.themePreset);
  const matchedPreset = matchColorPreset(src.colorPalette1, src.colorPalette2);
  const base = storedPreset || matchedPreset || findColorPreset(DEFAULT_COLOR_PRESET);

  const primary = normalizeHex(src.colorPalette1) || base.primary;
  const colors = {
    colorPalette1:    primary,
    colorPalette2:    normalizeHex(src.colorPalette2)    || base.secondary,
    colorBackground:  normalizeHex(src.colorBackground)  || base.bg,
    // Older invitations colored their buttons with Primary. Keep that unless the
    // colors are a known preset, which has its own (readable) button default.
    colorButton:      normalizeHex(src.colorButton)
                        || (storedPreset || matchedPreset ? base.button : primary),
    colorAccent:      normalizeHex(src.colorAccent)      || base.accent,
    colorHeadingText: normalizeHex(src.colorHeadingText) || base.headingText,
    colorBodyText:    normalizeHex(src.colorBodyText)    || base.bodyText,
  };

  const defaultPair = findFontPair(DEFAULT_FONT_PAIR);
  const font1 = isInvitationFont(src.font1) ? src.font1 : defaultPair.heading;
  const font2 = isInvitationFont(src.font2) ? src.font2 : defaultPair.body;

  let themePreset = "";
  if (storedPreset) themePreset = storedPreset.name;
  else if (src.themePreset === undefined && matchedPreset) themePreset = matchedPreset.name;
  else if (src.themePreset === undefined && !src.colorPalette1) themePreset = DEFAULT_COLOR_PRESET;

  let fontPreset = "";
  if (findFontPair(src.fontPreset)) fontPreset = src.fontPreset;
  else if (src.fontPreset === undefined) fontPreset = matchFontPair(font1, font2)?.name || "";

  return {
    ...colors,
    sectionBackgrounds: normalizeSectionBackgrounds(src.sectionBackgrounds),
    font1,
    font2,
    themePreset,
    fontPreset,
  };
};

/** Defaults for a brand-new invitation (Garden + Classic). */
export const DEFAULT_THEME_SETTINGS = normalizeThemeSettings({});

// ── Builder actions (each returns a partial settings update) ─────────────────
/** Apply a color preset: all seven colors (incl. background) and clear section overrides. */
export const applyColorPreset = (name) => {
  const preset = findColorPreset(name);
  if (!preset) return {};
  return { ...presetColorFields(preset), sectionBackgrounds: {}, themePreset: preset.name };
};

export const applyFontPair = (name) => {
  const pair = findFontPair(name);
  if (!pair) return {};
  return { font1: pair.heading, font2: pair.body, fontPreset: pair.name };
};

/** Reset: the selected preset's colors (Garden if none), no section overrides, the selected font pairing (Classic if none). */
export const resetThemeSettings = (settings = {}) => ({
  ...applyColorPreset(findColorPreset(settings.themePreset)?.name || DEFAULT_COLOR_PRESET),
  ...applyFontPair(findFontPair(settings.fontPreset)?.name || DEFAULT_FONT_PAIR),
});

/** True when any color differs from the selected preset (or no preset is selected). */
export const isColorPresetCustomized = (settings = {}) => {
  const preset = findColorPreset(settings.themePreset);
  if (!preset) return true;
  const fields = presetColorFields(preset);
  const colorsDiffer = COLOR_FIELDS.some(f => normalizeHex(settings[f]) !== fields[f]);
  const sections = settings.sectionBackgrounds || {};
  return colorsDiffer || Object.keys(sections).length > 0;
};

export const isFontPairCustomized = (settings = {}) => {
  const pair = findFontPair(settings.fontPreset);
  return !pair || pair.heading !== settings.font1 || pair.body !== settings.font2;
};

// ── Resolving what the guest actually sees ────────────────────────────────────
/** Effective background of one section. */
export const getSectionBackground = (theme, sectionId) => {
  const override = theme.sectionBackgrounds?.[sectionId];
  if (sectionId === "story") {
    if (override === MAIN_BACKGROUND) return theme.colorBackground;
    return normalizeHex(override) || tintHex(theme.colorPalette2);
  }
  return normalizeHex(override) || theme.colorBackground;
};

/** True when the section has its own background (Story: anything but the default tint). */
export const hasCustomSectionBackground = (theme, sectionId) =>
  Boolean(theme.sectionBackgrounds?.[sectionId]);

/**
 * Normalized settings plus everything the invitation needs to render:
 * readable names for each color, every section's background and font stacks.
 */
export const resolveInvitationTheme = (source = {}) => {
  const t = normalizeThemeSettings(source);
  return {
    ...t,
    primary:     t.colorPalette1,
    secondary:   t.colorPalette2,
    background:  t.colorBackground,
    button:      t.colorButton,
    buttonLabel: BUTTON_LABEL_COLOR,
    accent:      t.colorAccent,
    headingText: t.colorHeadingText,
    bodyText:    t.colorBodyText,
    headingFont: fontStack(t.font1),
    bodyFont:    fontStack(t.font2),
    sections: Object.fromEntries(THEME_SECTIONS.map(s => [s.id, getSectionBackground(t, s.id)])),
  };
};

// ── Contrast warnings ─────────────────────────────────────────────────────────
// Sections where button-colored text links/labels appear (Travel links and
// category labels; the guest page's "Kindly reply by" line and RSVP card).
const LINK_SECTIONS = ["header", "travel", "rsvp"];
// Sections with solid buttons (the hero RSVP button sits on the photo instead).
const BUTTON_SECTIONS = ["date", "venue", "rsvp"];

const formatRatio = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;

/**
 * Text/background pairs below WCAG AA. Sections sharing a background are
 * grouped into one warning. Returns [{ id, message, ratio, required }].
 */
export const getContrastWarnings = (source = {}) => {
  const theme = resolveInvitationTheme(source);
  const labelOf = (id) => THEME_SECTIONS.find(s => s.id === id)?.label || id;

  // Group sections by their effective background.
  const groups = new Map();
  for (const { id } of THEME_SECTIONS) {
    const bg = theme.sections[id];
    if (!groups.has(bg)) groups.set(bg, []);
    groups.get(bg).push(id);
  }
  // The main background is also the guest page background — check it even
  // when every section has its own color.
  if (!groups.has(theme.background)) groups.set(theme.background, []);

  const warnings = [];
  const check = (id, fg, bg, required, describe) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio !== null && ratio < required) {
      warnings.push({
        id, ratio, required,
        message: `${describe} has low contrast (${formatRatio(ratio)}; needs at least ${required}:1).`,
      });
    }
  };

  for (const [bg, ids] of groups) {
    const where = ids.length === THEME_SECTIONS.length
      ? "every section"
      : ids.length === 0 ? "the page (main background)" : ids.map(labelOf).join(", ");
    check(`heading-${bg}`, theme.headingText, bg, CONTRAST_MIN.large,
      `Heading text on the background of ${where}`);
    check(`body-${bg}`, theme.bodyText, bg, CONTRAST_MIN.normal,
      `Body text on the background of ${where}`);
    const linkIds = ids.filter(id => LINK_SECTIONS.includes(id));
    if (linkIds.length) {
      check(`link-${bg}`, theme.button, bg, CONTRAST_MIN.normal,
        `Button-colored links on the background of ${linkIds.map(labelOf).join(", ")}`);
    }
    // WCAG 1.4.11 (non-text contrast): a button must stand out from its section.
    const buttonIds = ids.filter(id => BUTTON_SECTIONS.includes(id));
    if (buttonIds.length) {
      check(`button-bg-${bg}`, theme.button, bg, CONTRAST_MIN.large,
        `The Button color against the background of ${buttonIds.map(labelOf).join(", ")}`);
    }
  }

  check("button-label", theme.buttonLabel, theme.button, CONTRAST_MIN.normal,
    "White button text on the Button color");

  return warnings;
};

// ── Guest RSVP page ───────────────────────────────────────────────────────────
/**
 * Inline style for the themed area of the guest RSVP page. It re-points the
 * app's Tailwind color tokens (hsl(var(--x))) at the invitation colors for that
 * subtree only, so existing classes like bg-primary / text-muted-foreground
 * pick up the theme without being rewritten. --tg-heading-font is used by
 * `.tg-invite-theme .font-heading` (see src/index.css).
 */
export const buildGuestThemeStyle = (source = {}) => {
  const t = resolveInvitationTheme(source);
  const v = (hex) => hexToHslTriplet(hex);
  return {
    "--background":         v(t.background),
    "--foreground":         v(t.headingText),
    "--card":               v(t.sections.rsvp),
    "--card-foreground":    v(t.headingText),
    "--primary":            v(t.button),
    "--primary-foreground": v(t.buttonLabel),
    "--ring":               v(t.button),
    // Soft tint, like the app's own --muted (icon tiles, plus-one boxes)
    "--muted":              v(tintHex(t.secondary, 0.18)),
    "--muted-foreground":   v(t.bodyText),
    "--border":             v(t.secondary),
    "--input":              v(t.secondary),
    "--accent-light":       v(t.accent),
    "--tg-heading-font":    t.headingFont,
    fontFamily:             t.bodyFont,
    color:                  t.bodyText,
  };
};
