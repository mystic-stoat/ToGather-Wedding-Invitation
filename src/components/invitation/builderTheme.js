// src/components/invitation/builderTheme.js
// ─────────────────────────────────────────────────────────────────────────────
// Color tokens for the Invitation Builder, moved out of CreateInvitation.jsx so
// the extracted builder components (Hero Photo, Our Story) share them.
// Values are unchanged.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stitch-inspired color palette for the invitation canvas ───────────────────
// This describes the actual wedding invitation artifact rendered in
// <PhonePreview> (hero, greetings, RSVP button, etc.) — kept separate from the
// ToGather design system tokens so the builder feels like a distinct creative
// tool AND so recoloring the app's UI never touches the invitation itself.
// Do NOT use CANVAS for the surrounding builder chrome (header/sidebar/panels)
// — use BUILDER_UI below for that.
export const CANVAS = {
  primary:        "#56642b",   // olive green — main accent
  primaryLight:   "#8a9a5b",   // sage — secondary
  primaryFixed:   "#d9eaa3",   // light green — hover/selected
  surface:        "#fafaf5",   // warm off-white — backgrounds
  surfaceContainer: "#eeeee9", // slightly darker — cards
  surfaceHigh:    "#e8e8e3",   // even darker — borders
  onSurface:      "#1a1c19",   // near-black text
  onSurfaceVar:   "#46483c",   // medium text
  outline:        "#76786b",   // borders
  secondary:      "#735c00",   // warm gold
  secondaryFixed: "#ffe088",   // light gold
};

// ── ToGather palette for the builder's own interface ───────────────────────────
// Used for everything that is NOT the invitation artifact itself: the top bar,
// left section nav, center settings panels, and Save/Publish actions. Selection
// indicators (font pairing, layout, sidebar section, etc.) use a blush-tinted
// background with a dark-green border/text instead of CANVAS's olive/lime.
//
// These are hex copies of the app theme tokens in src/index.css (inline styles
// need concrete colors). Each key mirrors one CSS variable, noted on its line.
// src/test/builderThemeSync.test.jsx fails if the two ever disagree — when you
// change a color in index.css, update the matching value here too.
export const BUILDER_UI = {
  primary:          "#3F5F47", // --primary            dark green — active states, buttons, selected borders/text
  primaryLight:     "#5F8D6B", // --secondary          softer green — hover/secondary emphasis
  selected:         "#FCEBEF", // --accent             subtle blush tint — selected card/section background
  surface:          "#FBF9F7", // --background         light warm ivory — top bar, workspace & preview stage
  sidebar:          "#F0EAE5", // --sidebar-background warm beige — left section-nav background
  surfaceContainer: "#FFFFFF", // --card               white — panel cards & input backgrounds
  surfaceHigh:      "#EEE9E2", // --muted              warm neutral — icon wells, dropzones, toggle-off track
  onSurface:        "#2C2C2C", // --foreground         charcoal — primary text
  onSurfaceVar:     "#746B63", // --muted-foreground   softer warm gray — labels/secondary text
  outline:          "#F0EAE5", // --border             general borders/dividers
  inputBorder:      "#E7DED4", // --input              form fields & outline buttons — visible on white
};

/**
 * Font for the builder's own interface. Fixed on purpose: the invitation's
 * heading/body fonts (Color Theme tab) must never change the builder chrome.
 * DM Sans is what the builder showed before with the default font pairing.
 */
export const BUILDER_FONT = '"DM Sans", system-ui, -apple-system, sans-serif';

/** Error text color already used across the builder. */
export const ERROR_COLOR = "#b3261e";
