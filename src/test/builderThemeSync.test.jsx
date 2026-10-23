// src/test/builderThemeSync.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Guard test: the Invitation Builder chrome (BUILDER_UI in builderTheme.js) uses
// hex copies of the app theme tokens in src/index.css, because inline styles
// need concrete colors. This test fails if a color is changed in one place but
// not the other, so the builder can never drift from the rest of the app.
//
// It also pins the RSVP status tokens to their established colors so the
// semantic Accepted / Declined / Pending colors are not changed by accident.
//
// The couple's invitation colors (CANVAS, invitationTheme.js) are intentionally
// NOT checked here — they are independent of the app theme.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILDER_UI, BUILDER_UI_TOKENS } from "@/components/invitation/builderTheme";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

/** Light-theme tokens only: the first `:root { … }` block. */
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/)[1];

/** "--primary" → "135 20.3% 31%" (null if missing). */
const tokenValue = (name) => {
  const m = rootBlock.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

/** "135 20.3% 31%" → [63, 95, 71] — the same conversion the browser does. */
const hslToRgb = (triplet) => {
  const [h, s, l] = triplet.split(/[\s,]+/).map(v => parseFloat(v));
  const S = s / 100, L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
};

const hexToRgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** Allow ±1 per channel for HSL rounding; anything larger is a real mismatch. */
const expectSameColor = (actualRgb, expectedRgb, label) => {
  actualRgb.forEach((v, i) => {
    expect(Math.abs(v - expectedRgb[i]), `${label} channel ${i}: ${actualRgb} vs ${expectedRgb}`)
      .toBeLessThanOrEqual(1);
  });
};

describe("BUILDER_UI stays in sync with the app theme (src/index.css)", () => {
  it("maps every BUILDER_UI key to a theme token", () => {
    expect(Object.keys(BUILDER_UI_TOKENS).sort()).toEqual(Object.keys(BUILDER_UI).sort());
  });

  it.each(Object.entries(BUILDER_UI_TOKENS))("BUILDER_UI.%s matches %s", (key, token) => {
    const value = tokenValue(token);
    expect(value, `${token} is not defined in :root`).not.toBeNull();
    expect(value, `${token} must use the space-separated "H S% L%" format`).not.toMatch(/,/);
    expectSameColor(hexToRgb(BUILDER_UI[key]), hslToRgb(value), `BUILDER_UI.${key} vs ${token}`);
  });
});

describe("RSVP status tokens keep their established colors", () => {
  const STATUS = {
    "--status-accepted":    "#3F5F47",
    "--status-accepted-bg": "#E7F0EA",
    "--status-declined":    "#C9666E",
    "--status-declined-bg": "#F7E6E6",
    "--status-pending":     "#D09B45",
    "--status-pending-bg":  "#FDF3E1",
  };

  it.each(Object.entries(STATUS))("%s is %s", (token, hex) => {
    const value = tokenValue(token);
    expect(value, `${token} is not defined in :root`).not.toBeNull();
    expectSameColor(hslToRgb(value), hexToRgb(hex), token);
  });
});

// Teammate check (kept from dev): BUILDER_UI exposes every key the builder uses.
describe("builderThemeSync", () => {
  it("BUILDER_UI has required tokens", () => {
    expect(BUILDER_UI.surface).toBeDefined();
    expect(BUILDER_UI.sidebar).toBeDefined();
    expect(BUILDER_UI.surfaceContainer).toBeDefined();
    expect(BUILDER_UI.surfaceHigh).toBeDefined();
    expect(BUILDER_UI.onSurface).toBeDefined();
    expect(BUILDER_UI.onSurfaceVar).toBeDefined();
    expect(BUILDER_UI.outline).toBeDefined();
    expect(BUILDER_UI.inputBorder).toBeDefined();
  });
});
