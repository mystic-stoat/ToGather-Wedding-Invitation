// src/components/invitation/StoryBlockEditor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Editor card for ONE Our Story block: drag handle, Move Up / Move Down,
// delete, collapse, layout picker, optional title/description, photo slots.
// The slot arrangement mirrors the chosen layout so the editor reads like the
// invitation. All state lives in the parent (StoryPanel).
// ─────────────────────────────────────────────────────────────────────────────

import { GripVertical, ArrowUp, ArrowDown, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageSlot from "@/components/invitation/ImageSlot";
import StoryLayoutPicker from "@/components/invitation/StoryLayoutPicker";
import { BUILDER_UI } from "@/components/invitation/builderTheme";
import {
  getLayout, layoutShowsText, countPhotosHiddenBy, getVisibleSlots,
  STORY_BLOCK_TITLE_MAX, STORY_BLOCK_DESCRIPTION_MAX,
} from "@/lib/storyBlocks";

const iconBtn = "w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5F47]";

const StoryBlockEditor = ({
  block, index, total, disabled, collapsed, onToggleCollapsed,
  onFieldChange, onPhotoChange, onRequestLayout, onMoveUp, onMoveDown, onDelete,
  progressByKey = {}, dragHandle, isDragging,
}) => {
  const n = index + 1;
  const layout = getLayout(block.layout);
  const showsText = layoutShowsText(block.layout);
  const hasText = Boolean(block.title.trim() || block.description.trim());
  const hiddenPhotos = countPhotosHiddenBy(block, block.layout);
  const fieldStyle = { borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurface };
  const labelCls = "text-xs font-bold tracking-widest uppercase mb-2 block";

  const slot = (i, aspect, slotLabel) => {
    const photo = block.images[i];
    return (
      <ImageSlot
        key={i}
        photo={photo}
        onChange={p => onPhotoChange(i, p)}
        label={`Block ${n} ${slotLabel}`}
        aspect={aspect}
        progress={photo?.pending ? progressByKey[photo.localId] : undefined}
        disabled={disabled}
      />
    );
  };

  const textFields = (
    <div className="space-y-4 min-w-0">
      <div>
        <label htmlFor={`story-title-${block.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
          Title <span className="normal-case tracking-normal font-normal">(optional)</span>
        </label>
        <Input
          id={`story-title-${block.id}`}
          value={block.title}
          onChange={e => onFieldChange("title", e.target.value)}
          placeholder="How we met"
          maxLength={STORY_BLOCK_TITLE_MAX}
          disabled={disabled}
          className="h-11 rounded-lg border-0 border-b-2"
          style={fieldStyle}
        />
      </div>
      <div>
        <label htmlFor={`story-desc-${block.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
          Description <span className="normal-case tracking-normal font-normal">(optional)</span>
        </label>
        <Textarea
          id={`story-desc-${block.id}`}
          value={block.description}
          onChange={e => onFieldChange("description", e.target.value)}
          placeholder="We sat next to each other in Data Structures and never stopped talking."
          maxLength={STORY_BLOCK_DESCRIPTION_MAX}
          disabled={disabled}
          className="min-h-[110px] rounded-lg border-0 border-b-2 resize-y"
          style={fieldStyle}
        />
        <p className="text-xs mt-1 text-right" style={{ color: BUILDER_UI.onSurfaceVar }}>
          {block.description.length}/{STORY_BLOCK_DESCRIPTION_MAX}
        </p>
      </div>
    </div>
  );

  const body = () => {
    switch (block.layout) {
      case "photoLeft":
        return <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">{slot(0, "4 / 5", "photo")}{textFields}</div>;
      case "photoRight":
        return <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">{textFields}{slot(0, "4 / 5", "photo")}</div>;
      case "twoPhotos":
        return <div className="grid grid-cols-2 gap-3">{slot(0, "4 / 5", "photo 1")}{slot(1, "4 / 5", "photo 2")}</div>;
      case "fullWidth":
        return slot(0, "3 / 2", "photo");
      case "textOnly":
        return textFields;
      case "collage":
        return (
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
            {/* 8 / 11 ≈ the collage's tall photo in the invitation (its height
                matches the two stacked squares), so adjustments line up. */}
            {slot(0, "8 / 11", "large photo")}
            <div className="grid gap-3 content-start">
              {slot(1, "1 / 1", "top photo")}
              {slot(2, "1 / 1", "bottom photo")}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const filledCount = getVisibleSlots(block).filter(Boolean).length;

  return (
    <div
      className="rounded-lg border"
      style={{
        backgroundColor: BUILDER_UI.surfaceContainer,
        borderColor: isDragging ? BUILDER_UI.primary : BUILDER_UI.outline,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
      }}
      data-testid="story-block-editor"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b" style={{ borderColor: BUILDER_UI.outline }}>
        <button
          type="button"
          ref={dragHandle?.ref}
          {...(dragHandle?.attributes || {})}
          {...(dragHandle?.listeners || {})}
          aria-label={`Drag to reorder block ${n}`}
          disabled={disabled}
          className={`${iconBtn} cursor-grab active:cursor-grabbing`}
          style={{ color: BUILDER_UI.onSurfaceVar, touchAction: "none" }}
        >
          <GripVertical size={16} />
        </button>

        <button type="button" onClick={onToggleCollapsed}
          className="flex-1 min-w-0 flex items-center gap-2 text-left px-1"
          aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} block ${n}`}>
          <span className="text-xs font-bold tracking-widest uppercase flex-shrink-0" style={{ color: BUILDER_UI.onSurfaceVar }}>
            Block {n}
          </span>
          <span className="text-xs truncate" style={{ color: BUILDER_UI.onSurface }}>
            {layout.short}{block.title.trim() ? ` · ${block.title.trim()}` : ""}
            {collapsed && layout.slots > 0 ? ` · ${filledCount}/${layout.slots} photos` : ""}
          </span>
          {collapsed ? <ChevronDown size={14} className="ml-auto flex-shrink-0" /> : <ChevronUp size={14} className="ml-auto flex-shrink-0" />}
        </button>

        <button type="button" onClick={onMoveUp} disabled={disabled || index === 0}
          className={iconBtn} style={{ color: BUILDER_UI.onSurfaceVar }} aria-label={`Move block ${n} up`}>
          <ArrowUp size={15} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={disabled || index === total - 1}
          className={iconBtn} style={{ color: BUILDER_UI.onSurfaceVar }} aria-label={`Move block ${n} down`}>
          <ArrowDown size={15} />
        </button>
        <button type="button" onClick={onDelete} disabled={disabled}
          className={iconBtn} style={{ color: BUILDER_UI.onSurfaceVar }} aria-label={`Delete block ${n}`}>
          <Trash2 size={15} />
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-5">
          <div>
            <span className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>Layout</span>
            <StoryLayoutPicker value={block.layout} onChange={onRequestLayout}
              label={`Block ${n} layout`} disabled={disabled} />
          </div>

          {body()}

          {!showsText && (
            <p className="flex items-start gap-2 text-xs p-3 rounded-lg"
              style={{ backgroundColor: BUILDER_UI.surfaceHigh, color: BUILDER_UI.onSurfaceVar }}>
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              {hasText
                ? "This layout doesn't show text. Your title and description are kept and will reappear if you switch to a layout with text."
                : "Photo-only layout — no text is shown on the invitation."}
            </p>
          )}

          {hiddenPhotos > 0 && (
            <p className="flex items-start gap-2 text-xs p-3 rounded-lg" role="status"
              style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              {hiddenPhotos === 1 ? "1 photo doesn't" : `${hiddenPhotos} photos don't`} fit this layout and
              will be removed when you save. Switch back to a larger layout before saving to keep {hiddenPhotos === 1 ? "it" : "them"}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default StoryBlockEditor;
