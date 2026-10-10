// src/components/invitation/StoryLayoutPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Six-option layout chooser for a Story block. Each option shows a tiny
// diagram of the layout. Implemented as a radio group (arrow keys work).
// ─────────────────────────────────────────────────────────────────────────────

import { STORY_LAYOUTS } from "@/lib/storyBlocks";
import { BUILDER_UI } from "@/components/invitation/builderTheme";

// Mini diagram: P = photo box, T = text lines
const Glyph = ({ layout, color }) => {
  const photo = (style) => <div className="rounded-[2px]" style={{ backgroundColor: color, opacity: 0.55, ...style }} />;
  const text = (
    <div className="flex flex-col justify-center gap-[3px] w-full">
      <div className="h-[3px] rounded" style={{ backgroundColor: color, width: "80%" }} />
      <div className="h-[2px] rounded" style={{ backgroundColor: color, opacity: 0.5, width: "100%" }} />
      <div className="h-[2px] rounded" style={{ backgroundColor: color, opacity: 0.5, width: "70%" }} />
    </div>
  );
  const box = "w-12 h-9 p-1 flex gap-1";
  switch (layout) {
    case "photoLeft":  return <div className={box}>{photo({ width: "45%" })}{text}</div>;
    case "photoRight": return <div className={box}>{text}{photo({ width: "45%", flexShrink: 0 })}</div>;
    case "twoPhotos":  return <div className={box}>{photo({ flex: 1 })}{photo({ flex: 1 })}</div>;
    case "fullWidth":  return <div className={box}>{photo({ flex: 1 })}</div>;
    case "textOnly":   return <div className={`${box} items-center px-2`}>{text}</div>;
    case "collage":
      return (
        <div className={box}>
          {photo({ flex: 3 })}
          <div className="flex flex-col gap-1" style={{ flex: 2 }}>{photo({ flex: 1 })}{photo({ flex: 1 })}</div>
        </div>
      );
    default: return null;
  }
};

const StoryLayoutPicker = ({ value, onChange, label = "Layout", disabled }) => {
  const index = STORY_LAYOUTS.findIndex(l => l.id === value);

  const onKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = STORY_LAYOUTS[(index + delta + STORY_LAYOUTS.length) % STORY_LAYOUTS.length];
    onChange(next.id);
    // Move focus with the selection (roving tabindex)
    const group = e.currentTarget;
    requestAnimationFrame(() => group.querySelector(`[data-layout-id="${next.id}"]`)?.focus());
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown}
      className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {STORY_LAYOUTS.map(l => {
        const selected = l.id === value;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (index === -1 && l.id === STORY_LAYOUTS[0].id) ? 0 : -1}
            data-layout-id={l.id}
            disabled={disabled}
            onClick={() => onChange(l.id)}
            className="flex items-center gap-2 p-2 rounded-lg border-2 text-left transition-all disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5F47]"
            style={{
              backgroundColor: selected ? BUILDER_UI.selected : BUILDER_UI.surfaceContainer,
              borderColor: selected ? BUILDER_UI.primary : BUILDER_UI.outline,
            }}
          >
            <span className="flex-shrink-0 rounded" style={{ backgroundColor: BUILDER_UI.surface }}>
              <Glyph layout={l.id} color={selected ? BUILDER_UI.primary : BUILDER_UI.onSurfaceVar} />
            </span>
            <span className="text-[11px] font-bold leading-tight min-w-0"
              style={{ color: selected ? BUILDER_UI.primary : BUILDER_UI.onSurface }}>
              {l.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default StoryLayoutPicker;
