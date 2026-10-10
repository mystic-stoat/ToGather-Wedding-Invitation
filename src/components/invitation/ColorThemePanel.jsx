// src/components/invitation/ColorThemePanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The builder's "Color Theme" tab — the former Color and Font tabs combined.
// Everything here edits the INVITATION only; the panel itself is builder
// chrome and uses BUILDER_UI colors exclusively. Preset swatches and font
// previews show the invitation's own colors/fonts, never recolored.
//
// Settings live flat on the invitation doc (see src/lib/invitationTheme.js).
// Every change goes straight into the builder's `settings`, so the phone
// preview updates immediately; nothing is written until Save/Publish.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import {
  COLOR_THEMES, FONT_PAIRS, INVITATION_FONTS, THEME_SECTIONS, MAIN_BACKGROUND,
  applyColorPreset, applyFontPair, resetThemeSettings, isColorPresetCustomized,
  isFontPairCustomized, getContrastWarnings, getSectionBackground, normalizeHex,
  normalizeThemeSettings, findColorPreset, findFontPair, DEFAULT_COLOR_PRESET,
  DEFAULT_FONT_PAIR, fontStack,
} from "@/lib/invitationTheme";
import { useGoogleFonts } from "@/hooks/useGoogleFonts";

const ALL_FONT_NAMES = INVITATION_FONTS.map(f => f.name);

const headingCls = "text-xs font-bold tracking-widest uppercase mb-4";
const labelCls   = "text-xs font-bold tracking-widest uppercase mb-2 block";
const fieldStyle = { borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer };

const SectionHeading = ({ children, right }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className={headingCls.replace(" mb-4", "")} style={{ color: BUILDER_UI.onSurfaceVar }}>
      {children}
    </h3>
    {right}
  </div>
);

const CustomizedBadge = () => (
  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
    style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.primary }}>
    Customized
  </span>
);

// ── Color field: swatch picker + hex text input ───────────────────────────────
// Same swatch + text layout the old Color tab used. The text input keeps a
// local draft so half-typed values never reach the invitation; a value is
// committed as soon as it is a valid hex color.
export const ColorField = ({ label, value, onChange, description, testId }) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // Follow outside changes (preset applied, reset, saved value loaded).
  useEffect(() => { setDraft(value); setInvalid(false); }, [value]);

  const commitDraft = (next) => {
    setDraft(next);
    const hex = normalizeHex(next);
    if (hex) {
      setInvalid(false);
      if (hex !== value) onChange(hex);
    }
  };

  return (
    <div data-testid={testId}>
      <label htmlFor={`${id}-hex`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* Swatch + text reflect the invitation color; only the wrapper uses the builder palette */}
        <input type="color" value={value}
          aria-label={`${label} color picker`}
          onChange={e => commitDraft(e.target.value)}
          className="w-12 h-12 rounded-lg cursor-pointer border-0 p-1 flex-shrink-0"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer }} />
        <Input id={`${id}-hex`} value={draft}
          onChange={e => commitDraft(e.target.value)}
          onBlur={e => {
            const hex = normalizeHex(e.target.value);
            if (!hex) setInvalid(true);
            else setDraft(hex);
          }}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : description ? `${id}-desc` : undefined}
          spellCheck={false}
          className="h-11 rounded-lg border-0 border-b-2 font-mono text-sm"
          style={{ ...fieldStyle, color: BUILDER_UI.onSurface, ...(invalid ? { borderColor: ERROR_COLOR } : {}) }} />
      </div>
      {invalid ? (
        <p id={`${id}-err`} className="text-xs mt-1.5" style={{ color: ERROR_COLOR }}>
          Enter a hex color like #56642b. The last valid color is still used.
        </p>
      ) : description ? (
        <p id={`${id}-desc`} className="text-xs mt-1.5" style={{ color: BUILDER_UI.onSurfaceVar }}>
          {description}
        </p>
      ) : null}
    </div>
  );
};

// ── One row in "Section Backgrounds" ──────────────────────────────────────────
const SectionBackgroundRow = ({ section, theme, onSetSection }) => {
  const id = useId();
  const stored = theme.sectionBackgrounds[section.id];
  const isStory = section.id === "story";
  const mode = stored === MAIN_BACKGROUND || (!stored && !isStory)
    ? "main"
    : stored ? "custom" : "tint";
  const effective = getSectionBackground(theme, section.id);

  const onModeChange = (next) => {
    if (next === "custom") onSetSection(section.id, effective);
    else if (next === "main") onSetSection(section.id, isStory ? MAIN_BACKGROUND : null);
    else onSetSection(section.id, null); // Story's default tint
  };

  return (
    <div className="p-4 rounded-lg space-y-3" data-testid={`section-bg-${section.id}`}
      style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Live swatch of the section's current background (invitation color) */}
          <span aria-hidden="true" className="w-6 h-6 rounded-full flex-shrink-0"
            style={{ backgroundColor: effective, border: `1px solid ${BUILDER_UI.outline}` }} />
          <label htmlFor={`${id}-mode`} className="text-sm font-bold truncate" style={{ color: BUILDER_UI.onSurface }}>
            {section.label}
          </label>
        </div>
        <select id={`${id}-mode`} value={mode} onChange={e => onModeChange(e.target.value)}
          className="h-9 rounded-lg px-2 text-xs font-semibold border"
          style={{ ...fieldStyle, color: BUILDER_UI.onSurface }}>
          {isStory && <option value="tint">Soft Secondary tint (default)</option>}
          <option value="main">Use Main Background</option>
          <option value="custom">Custom color</option>
        </select>
      </div>
      {mode === "custom" && (
        <ColorField label={`${section.label} background`} value={stored}
          onChange={hex => onSetSection(section.id, hex)} />
      )}
    </div>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────
const ColorThemePanel = ({ settings, onChange, onApply }) => {
  const theme = normalizeThemeSettings(settings);
  const warnings = getContrastWarnings(settings);
  const [confirmReset, setConfirmReset] = useState(false);

  // Load every pairing font so the preview cards and dropdowns render in their own fonts.
  useGoogleFonts(ALL_FONT_NAMES);

  const setSection = (sectionId, value) => {
    const next = { ...theme.sectionBackgrounds };
    if (value) next[sectionId] = value; else delete next[sectionId];
    onChange("sectionBackgrounds", next);
  };

  const colorsCustomized = isColorPresetCustomized(theme);
  const fontsCustomized = isFontPairCustomized(theme);
  const resetPreset = findColorPreset(theme.themePreset)?.name || DEFAULT_COLOR_PRESET;
  const resetPair = findFontPair(theme.fontPreset)?.name || DEFAULT_FONT_PAIR;

  return (
    <div className="space-y-10">

      {/* ── Theme presets ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeading right={colorsCustomized && <CustomizedBadge />}>Theme Presets</SectionHeading>
        <div className="grid grid-cols-3 gap-3">
          {COLOR_THEMES.map(preset => {
            const selected = theme.themePreset === preset.name;
            return (
              <button key={preset.name} type="button"
                aria-pressed={selected}
                onClick={() => onApply(applyColorPreset(preset.name))}
                className="p-4 rounded-lg border-2 transition-all text-center"
                style={{
                  // preset.bg / primary / secondary are the actual invitation
                  // preset colors — never recolored.
                  backgroundColor: preset.bg,
                  borderColor: selected ? BUILDER_UI.primary : BUILDER_UI.outline,
                }}>
                <div className="flex justify-center gap-1.5 mb-2">
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.secondary }} />
                </div>
                <p className="text-xs font-bold" style={{ color: BUILDER_UI.onSurface }}>
                  {preset.name}
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: BUILDER_UI.onSurfaceVar }}>
          A preset sets every invitation color, including the background. You can then change any color below.
        </p>
      </section>

      {/* ── Readability ───────────────────────────────────────────────────── */}
      <section aria-labelledby="theme-readability-heading">
        <h3 id="theme-readability-heading" className={headingCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
          Readability
        </h3>
        <div role="status" aria-live="polite" data-testid="contrast-status">
          {warnings.length === 0 ? (
            <div className="flex items-start gap-2 p-4 rounded-lg"
              style={{ backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurface }}>
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
              <p className="text-sm">All text meets WCAG AA contrast on its background.</p>
            </div>
          ) : (
            <div className="p-4 rounded-lg space-y-2"
              style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
              <p className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: ERROR_COLOR }} aria-hidden="true" />
                {warnings.length === 1 ? "1 readability warning" : `${warnings.length} readability warnings`}
              </p>
              <ul className="space-y-1.5 text-xs list-disc pl-5" data-testid="contrast-warnings">
                {warnings.map(w => <li key={w.id}>{w.message}</li>)}
              </ul>
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Guests may struggle to read this text. Warnings don't block saving.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Invitation colors ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading>Invitation Colors</SectionHeading>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <ColorField label="Primary" value={theme.colorPalette1} testId="color-primary"
            onChange={v => onChange("colorPalette1", v)}
            description="Ornaments and icons." />
          <ColorField label="Secondary" value={theme.colorPalette2} testId="color-secondary"
            onChange={v => onChange("colorPalette2", v)}
            description="Soft surfaces and the Our Story tint." />
          <ColorField label="Main Background" value={theme.colorBackground} testId="color-background"
            onChange={v => onChange("colorBackground", v)}
            description="Every section without its own background." />
          <ColorField label="Button" value={theme.colorButton} testId="color-button"
            onChange={v => onChange("colorButton", v)}
            description="Buttons, links and place labels." />
          <ColorField label="Accent" value={theme.colorAccent} testId="color-accent"
            onChange={v => onChange("colorAccent", v)}
            description="Divider lines and hearts." />
        </div>
      </section>

      {/* ── Section backgrounds ───────────────────────────────────────────── */}
      <section>
        <SectionHeading>Section Backgrounds</SectionHeading>
        <p className="text-xs mb-4" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Sections use the main background unless you give them their own. Our Story uses a soft tint
          of your Secondary color by default.
        </p>
        <div className="space-y-2">
          {THEME_SECTIONS.map(section => (
            <SectionBackgroundRow key={section.id} section={section} theme={theme} onSetSection={setSection} />
          ))}
        </div>
      </section>

      {/* ── Typography ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading right={fontsCustomized && <CustomizedBadge />}>Font Pairings</SectionHeading>
        <div className="space-y-3">
          {FONT_PAIRS.map(pair => {
            const selected = theme.fontPreset === pair.name;
            return (
              <button key={pair.name} type="button" aria-pressed={selected}
                onClick={() => onApply(applyFontPair(pair.name))}
                className="w-full p-5 rounded-lg border-2 text-left transition-all"
                style={{
                  backgroundColor: selected ? BUILDER_UI.selected : BUILDER_UI.surfaceContainer,
                  borderColor: selected ? BUILDER_UI.primary : "transparent",
                }}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: BUILDER_UI.onSurfaceVar }}>
                    {pair.name}
                  </p>
                  {selected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: BUILDER_UI.primary }}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <p className="text-xl mb-1" style={{ fontFamily: fontStack(pair.heading), color: BUILDER_UI.onSurface }}>
                  Sarah & Michael
                </p>
                <p className="text-xs" style={{ fontFamily: fontStack(pair.body), color: BUILDER_UI.onSurfaceVar }}>
                  {pair.heading} / {pair.body}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading>Typography</SectionHeading>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {[
            { field: "font1", label: "Heading Font", testId: "font-heading" },
            { field: "font2", label: "Body Font",    testId: "font-body" },
          ].map(({ field, label, testId }) => (
            <div key={field}>
              <label htmlFor={`theme-${field}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
                {label}
              </label>
              <select id={`theme-${field}`} data-testid={testId} value={theme[field]}
                onChange={e => onChange(field, e.target.value)}
                className="w-full h-11 rounded-lg px-3 text-sm border-0 border-b-2"
                style={{ ...fieldStyle, color: BUILDER_UI.onSurface, fontFamily: fontStack(theme[field]) }}>
                {INVITATION_FONTS.map(f => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          ))}
          <ColorField label="Heading Text" value={theme.colorHeadingText} testId="color-heading-text"
            onChange={v => onChange("colorHeadingText", v)}
            description="Titles, names and section headings." />
          <ColorField label="Body Text" value={theme.colorBodyText} testId="color-body-text"
            onChange={v => onChange("colorBodyText", v)}
            description="Messages, dates and details." />
        </div>
      </section>

      {/* ── Reset ─────────────────────────────────────────────────────────── */}
      <section className="pt-6 border-t" style={{ borderColor: BUILDER_UI.outline }}>
        {confirmReset ? (
          <div className="p-4 rounded-lg space-y-3" role="group" aria-label="Confirm theme reset"
            style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
            <p className="text-sm" style={{ color: BUILDER_UI.onSurface }}>
              Reset to the {resetPreset} colors and {resetPair} fonts? Custom colors and section
              backgrounds will be cleared. Nothing is saved until you click Save.
            </p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => { onApply(resetThemeSettings(theme)); setConfirmReset(false); }}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest"
                style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
                Reset theme
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}
                className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest"
                style={{ backgroundColor: BUILDER_UI.surfaceHigh, color: BUILDER_UI.onSurface }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-70"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            <RotateCcw size={14} /> Reset to defaults
          </button>
        )}
      </section>
    </div>
  );
};

export default ColorThemePanel;
