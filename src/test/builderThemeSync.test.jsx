import { describe, it, expect } from "vitest";
import { BUILDER_UI } from "@/components/invitation/builderTheme";

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
