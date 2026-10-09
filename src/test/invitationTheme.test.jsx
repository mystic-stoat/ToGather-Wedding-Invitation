// Unit tests for src/lib/invitationTheme.js — presets, defaults for older
// invitations, preset/override behavior, section backgrounds, contrast checks
// and the guest-page CSS variables.
import { describe, it, expect } from "vitest";
import {
  COLOR_THEMES, FONT_PAIRS, THEME_SECTIONS, THEME_FIELDS, MAIN_BACKGROUND,
  DEFAULT_THEME_SETTINGS, normalizeThemeSettings, applyColorPreset, applyFontPair,
  resetThemeSettings, isColorPresetCustomized, isFontPairCustomized,
  getSectionBackground, resolveInvitationTheme, getContrastWarnings, contrastRatio,
  normalizeHex, isValidHex, hexToHslTriplet, tintHex, fontStack, buildGuestThemeStyle,
  matchColorPreset,
} from "@/lib/invitationTheme";
import { tintColor } from "@/components/invitation/StorySection";

describe("presets", () => {
  it("keeps all six color presets with their original primary/secondary/bg", () => {
    expect(COLOR_THEMES.map(t => [t.name, t.primary, t.secondary, t.bg])).toEqual([
      ["Garden",   "#56642b", "#8a9a5b", "#fafaf5"],
      ["Rose",     "#9b3a5a", "#c97a95", "#fdf5f7"],
      ["Navy",     "#1e3a5f", "#4a7aa8", "#f5f7fa"],
      ["Blush",    "#c97a7a", "#e5aeae", "#fdf8f8"],
      ["Sage",     "#4a7a65", "#7aaa95", "#f5faf7"],
      ["Burgundy", "#6b2737", "#9b5a65", "#faf5f6"],
    ]);
  });

  it("keeps all five font pairings unchanged", () => {
    expect(FONT_PAIRS.map(p => [p.name, p.heading, p.body])).toEqual([
      ["Classic",   "Playfair Display",   "DM Sans"],
      ["Editorial", "Noto Serif",         "Manrope"],
      ["Modern",    "Cormorant Garamond", "Lato"],
      ["Romantic",  "Great Vibes",        "Nunito"],
      ["Timeless",  "Libre Baskerville",  "Source Sans 3"],
    ]);
  });

  it.each(COLOR_THEMES.map(t => [t.name]))("%s passes every contrast check with its defaults", (name) => {
    const settings = { ...DEFAULT_THEME_SETTINGS, ...applyColorPreset(name) };
    expect(getContrastWarnings(settings)).toEqual([]);
  });

  it("Garden's defaults are the exact colors the preview used before", () => {
    const t = resolveInvitationTheme({});
    expect(t.headingText).toBe("#1a1c19"); // CANVAS.onSurface
    expect(t.bodyText).toBe("#46483c");    // CANVAS.onSurfaceVar
    expect(t.background).toBe("#fafaf5");  // CANVAS.surface
    expect(t.button).toBe("#56642b");      // CANVAS.primary
  });
});

describe("normalizeThemeSettings — backward compatibility", () => {
  it("gives a brand-new invitation Garden + Classic", () => {
    const t = normalizeThemeSettings({});
    expect(t).toMatchObject({
      colorPalette1: "#56642b", colorPalette2: "#8a9a5b", colorBackground: "#fafaf5",
      font1: "Playfair Display", font2: "DM Sans",
      themePreset: "Garden", fontPreset: "Classic", sectionBackgrounds: {},
    });
    expect(Object.keys(t).sort()).toEqual([...THEME_FIELDS].sort());
  });

  it("recognizes an older invitation's preset from primary/secondary and fills in its defaults", () => {
    const t = normalizeThemeSettings({ colorPalette1: "#1e3a5f", colorPalette2: "#4a7aa8", font1: "Great Vibes", font2: "Nunito" });
    expect(t).toMatchObject({
      themePreset: "Navy", colorBackground: "#f5f7fa", colorButton: "#1e3a5f",
      font1: "Great Vibes", font2: "Nunito", fontPreset: "Romantic",
    });
  });

  it("keeps an older invitation's custom colors and uses Primary for its buttons", () => {
    const t = normalizeThemeSettings({ colorPalette1: "#123456", colorPalette2: "#abcdef" });
    expect(t).toMatchObject({
      colorPalette1: "#123456", colorPalette2: "#abcdef", colorButton: "#123456",
      colorBackground: "#fafaf5", themePreset: "",
    });
    expect(isColorPresetCustomized(t)).toBe(true);
  });

  it("replaces invalid stored values with defaults and drops unknown sections", () => {
    const t = normalizeThemeSettings({
      colorPalette1: "not-a-color", colorBackground: "#GGG", font1: "Comic Sans",
      font2: 42, sectionBackgrounds: { greetings: "#ABC", bogus: "#000000", rsvp: "red", venue: MAIN_BACKGROUND },
    });
    expect(t.colorPalette1).toBe("#56642b");
    expect(t.colorBackground).toBe("#fafaf5");
    expect(t.font1).toBe("Playfair Display");
    expect(t.font2).toBe("DM Sans");
    expect(t.sectionBackgrounds).toEqual({ greetings: "#aabbcc" }); // "main" only means something for Story
  });

  it("is idempotent, so saved values load back identically", () => {
    const once = normalizeThemeSettings({ ...applyColorPreset("Rose"), colorAccent: "#ABCDEF",
      sectionBackgrounds: { story: MAIN_BACKGROUND, rsvp: "#ffffff" } });
    expect(normalizeThemeSettings(once)).toEqual(once);
  });
});

describe("presets and overrides", () => {
  it("applying a preset sets every color, including the background, and clears section overrides", () => {
    const update = applyColorPreset("Burgundy");
    expect(update).toEqual({
      colorPalette1: "#6b2737", colorPalette2: "#9b5a65", colorBackground: "#faf5f6",
      colorButton: "#6b2737", colorAccent: "#9b5a65", colorHeadingText: "#1a1c19",
      colorBodyText: "#46483c", sectionBackgrounds: {}, themePreset: "Burgundy",
    });
    expect(applyColorPreset("Nope")).toEqual({});
  });

  it("a single override is kept and marks the preset as customized", () => {
    const s = { ...DEFAULT_THEME_SETTINGS, ...applyColorPreset("Sage") };
    expect(isColorPresetCustomized(s)).toBe(false);
    const overridden = { ...s, colorButton: "#000000" };
    expect(isColorPresetCustomized(overridden)).toBe(true);
    expect(normalizeThemeSettings(overridden).colorButton).toBe("#000000");
    expect(normalizeThemeSettings(overridden).colorPalette1).toBe("#4a7a65");
    expect(isColorPresetCustomized({ ...s, sectionBackgrounds: { rsvp: "#ffffff" } })).toBe(true);
  });

  it("font pairings and individual fonts", () => {
    const s = { ...DEFAULT_THEME_SETTINGS, ...applyFontPair("Timeless") };
    expect(s).toMatchObject({ font1: "Libre Baskerville", font2: "Source Sans 3", fontPreset: "Timeless" });
    expect(isFontPairCustomized(s)).toBe(false);
    expect(isFontPairCustomized({ ...s, font2: "Lato" })).toBe(true);
  });

  it("reset restores the selected preset and pairing and clears overrides", () => {
    const s = { ...DEFAULT_THEME_SETTINGS, ...applyColorPreset("Navy"), ...applyFontPair("Modern"),
      colorBodyText: "#ff0000", font1: "Great Vibes", sectionBackgrounds: { header: "#000000" } };
    expect({ ...s, ...resetThemeSettings(s) }).toMatchObject({
      ...applyColorPreset("Navy"), ...applyFontPair("Modern"), sectionBackgrounds: {},
    });
    // No preset selected → Garden + Classic
    expect(resetThemeSettings({ themePreset: "", fontPreset: "" }))
      .toEqual({ ...applyColorPreset("Garden"), ...applyFontPair("Classic") });
  });

  it("matches presets case-insensitively by hex", () => {
    expect(matchColorPreset("#56642B", "#8A9A5B")?.name).toBe("Garden");
    expect(matchColorPreset("#000000", "#8a9a5b")).toBeNull();
  });
});

describe("section backgrounds", () => {
  const base = { ...DEFAULT_THEME_SETTINGS, colorBackground: "#112233", colorPalette2: "#8a9a5b" };

  it("sections without an override follow the main background", () => {
    const t = resolveInvitationTheme(base);
    for (const { id } of THEME_SECTIONS.filter(s => s.id !== "story")) {
      expect(t.sections[id]).toBe("#112233");
    }
    // Changing the main background moves all of them
    const t2 = resolveInvitationTheme({ ...base, colorBackground: "#445566", sectionBackgrounds: { rsvp: "#ffffff" } });
    expect(t2.sections.greetings).toBe("#445566");
    expect(t2.sections.rsvp).toBe("#ffffff");
  });

  it("Story defaults to the soft Secondary tint, can use the main background or a custom color", () => {
    expect(getSectionBackground(base, "story")).toBe(tintHex("#8a9a5b"));
    expect(getSectionBackground({ ...base, sectionBackgrounds: { story: MAIN_BACKGROUND } }, "story")).toBe("#112233");
    expect(getSectionBackground({ ...base, sectionBackgrounds: { story: "#fedcba" } }, "story")).toBe("#fedcba");
  });

  it("the tint matches StorySection's own tintColor", () => {
    const [r, g, b] = tintColor("#8a9a5b").match(/\d+/g).map(Number);
    const hex = tintHex("#8a9a5b");
    expect([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))).toEqual([r, g, b]);
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("nope", "#ffffff")).toBeNull();
  });

  it("warns about unreadable body and heading text, grouped by background", () => {
    const warnings = getContrastWarnings({ ...DEFAULT_THEME_SETTINGS, colorBodyText: "#eeeeee", colorHeadingText: "#f0f0f0" });
    const ids = warnings.map(w => w.id);
    expect(ids).toContain("body-#fafaf5");
    expect(ids).toContain("heading-#fafaf5");
    const body = warnings.find(w => w.id === "body-#fafaf5");
    expect(body.required).toBe(4.5);
    expect(body.message).toMatch(/Body text/);
    expect(body.message).toMatch(/needs at least 4.5:1/);
  });

  it("uses the large-text minimum (3:1) for headings", () => {
    // #8a8a8a on white ≈ 3.45:1 — fine for headings, too low for body text
    const s = { ...DEFAULT_THEME_SETTINGS, colorBackground: "#ffffff", colorHeadingText: "#8a8a8a", colorBodyText: "#8a8a8a",
      sectionBackgrounds: { story: MAIN_BACKGROUND } };
    const ids = getContrastWarnings(s).map(w => w.id);
    expect(ids).toContain("body-#ffffff");
    expect(ids).not.toContain("heading-#ffffff");
  });

  it("warns when white button text is hard to read, and for a dark custom section", () => {
    const ids = getContrastWarnings({ ...DEFAULT_THEME_SETTINGS, colorButton: "#e5aeae",
      sectionBackgrounds: { venue: "#111111" } }).map(w => w.id);
    expect(ids).toContain("button-label");
    expect(ids).toContain("body-#111111");
    expect(ids).toContain("heading-#111111");
  });

  it("warns when buttons blend into a section's background (non-text contrast)", () => {
    const ids = getContrastWarnings({ ...applyColorPreset("Navy"), sectionBackgrounds: { venue: "#1e3a5f" } })
      .map(w => w.id);
    expect(ids).toContain("button-bg-#1e3a5f");
    // Sections without buttons don't get this warning
    const ids2 = getContrastWarnings({ ...applyColorPreset("Navy"), colorHeadingText: "#ffffff", colorBodyText: "#ffffff",
      sectionBackgrounds: { music: "#1e3a5f" } }).map(w => w.id);
    expect(ids2).not.toContain("button-bg-#1e3a5f");
  });

  it("checks the main background even when every section has its own", () => {
    const all = Object.fromEntries(THEME_SECTIONS.map(s => [s.id, "#ffffff"]));
    const ids = getContrastWarnings({ ...DEFAULT_THEME_SETTINGS, colorBackground: "#000000", sectionBackgrounds: all })
      .map(w => w.id);
    expect(ids).toContain("body-#000000");
  });
});

describe("helpers", () => {
  it("validates and normalizes hex colors", () => {
    expect(isValidHex("#abc")).toBe(true);
    expect(isValidHex("abcdef")).toBe(true);
    expect(isValidHex("#abcd")).toBe(false);
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
    expect(normalizeHex("javascript:alert(1)")).toBeNull();
  });

  it("converts hex to Tailwind's HSL triplet format", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#ff0000")).toBe("0 100% 50%");
    expect(hexToHslTriplet("#56642b")).toBe("74.7 39.9% 28%");
  });

  it("builds font stacks only for known fonts", () => {
    expect(fontStack("Great Vibes")).toBe('"Great Vibes", cursive');
    expect(fontStack("Lato")).toBe('"Lato", sans-serif');
    expect(fontStack("evil\"; }")).toBe("sans-serif");
  });

  it("builds the guest page's scoped CSS variables", () => {
    const style = buildGuestThemeStyle({ ...applyColorPreset("Navy"), font1: "Noto Serif", font2: "Manrope",
      sectionBackgrounds: { rsvp: "#ffffff" } });
    expect(style["--primary"]).toBe(hexToHslTriplet("#1e3a5f"));
    expect(style["--background"]).toBe(hexToHslTriplet("#f5f7fa"));
    expect(style["--card"]).toBe("0 0% 100%");
    expect(style["--muted-foreground"]).toBe(hexToHslTriplet("#46483c"));
    expect(style["--tg-heading-font"]).toBe('"Noto Serif", serif');
    expect(style.fontFamily).toBe('"Manrope", sans-serif');
  });
});
