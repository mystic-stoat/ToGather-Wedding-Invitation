// src/components/invitation/StoryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Story" tab of the Invitation Builder: section title, Show/Hide toggle,
// photo-storage meter, and the list of story blocks.
//
// Reordering: drag a block by its grip handle (mouse, touch with a short press,
// or keyboard: focus the handle, Space, arrow keys, Space) — powered by
// @dnd-kit — OR use the Move Up / Move Down buttons, which are always shown.
//
// Nothing here talks to Firebase: edits only change local state, the phone
// preview updates live, and everything is saved when the couple clicks Save.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, BookHeart, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import StoryBlockEditor from "@/components/invitation/StoryBlockEditor";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import {
  createStoryBlock, changeBlockLayout, countPhotosHiddenBy, moveItem, isBlockEmpty,
  getLayout, STORY_TITLE_SUGGESTIONS, STORY_SECTION_TITLE_MAX, DEFAULT_STORY_TITLE,
} from "@/lib/storyBlocks";
import { releasePhoto, releaseIfReplaced } from "@/lib/imageProcessing";
import { WEDDING_MEDIA_QUOTA_BYTES, formatBytes } from "@/lib/mediaConfig";

// ── One sortable row ─────────────────────────────────────────────────────────
const SortableBlock = ({ block, ...props }) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: block.id, disabled: props.disabled });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }}>
      <StoryBlockEditor
        block={block}
        isDragging={isDragging}
        dragHandle={{ ref: setActivatorNodeRef, attributes, listeners }}
        {...props}
      />
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    onClick={() => onChange(!checked)}
    className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-60"
    style={{ backgroundColor: checked ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
      style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }} />
  </button>
);

/**
 * Props
 *   settings, onSettingChange(field, value) — storyTitle / storyShowOnInvitation
 *   blocks, setBlocks(nextArray)
 *   status        "loading" | "ready" | "error"
 *   loadedCount   blocks loaded so far (while loading)
 *   onRetryLoad
 *   mediaBytes    estimated photo storage incl. Hero (for the meter)
 *   progressByKey { [localId]: percent } while saving
 *   disabled      true while saving
 */
const StoryPanel = ({
  settings, onSettingChange, blocks, setBlocks, status = "ready", loadedCount = 0,
  onRetryLoad, mediaBytes = 0, progressByKey, disabled = false,
}) => {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [pendingLayout, setPendingLayout] = useState(null);   // { blockId, layout, hidden }
  const [pendingDelete, setPendingDelete] = useState(null);   // blockId
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const indexOf = (id) => blocks.findIndex(b => b.id === id);
  const updateBlock = (id, fn) => setBlocks(blocks.map(b => (b.id === id ? fn(b) : b)));

  const move = (from, to) => {
    const next = moveItem(blocks, from, to);
    if (next === blocks) return;
    setBlocks(next);
    setAnnouncement(`Block moved to position ${to + 1} of ${blocks.length}.`);
  };

  const addBlock = () => {
    const block = createStoryBlock();
    setBlocks([...blocks, block]);
    setAnnouncement(`Block ${blocks.length + 1} added.`);
  };

  const setPhoto = (id, slotIndex, photo) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    // Free the old preview if it was never saved — but not when this is the
    // same photo with a new position/zoom.
    releaseIfReplaced(block.images[slotIndex], photo);
    updateBlock(id, b => ({ ...b, images: b.images.map((p, i) => (i === slotIndex ? photo : p)) }));
  };

  const requestLayout = (id, layout) => {
    const block = blocks.find(b => b.id === id);
    if (!block || block.layout === layout) return;
    const hidden = countPhotosHiddenBy(block, layout) - countPhotosHiddenBy(block, block.layout);
    if (hidden > 0) setPendingLayout({ blockId: id, layout, hidden });
    else updateBlock(id, b => changeBlockLayout(b, layout));
  };

  const deleteBlock = (id) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    block.images.forEach(releasePhoto);
    setBlocks(blocks.filter(b => b.id !== id));
    setAnnouncement("Block deleted.");
  };

  const requestDelete = (id) => {
    const block = blocks.find(b => b.id === id);
    if (block && isBlockEmpty(block) && !block.images.some(Boolean)) deleteBlock(id);
    else setPendingDelete(id);
  };

  const toggleCollapsed = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(indexOf(active.id), indexOf(over.id));
  };

  const blockName = (id) => `block ${indexOf(id) + 1}`;
  const accessibility = {
    screenReaderInstructions: {
      draggable: "To reorder, press Space to pick up the block, use the arrow keys to move it, then press Space again to drop it. Press Escape to cancel. You can also use the Move up and Move down buttons.",
    },
    announcements: {
      onDragStart: ({ active }) => `Picked up ${blockName(active.id)}.`,
      onDragOver: ({ active, over }) => over ? `${blockName(active.id)} is over position ${indexOf(over.id) + 1}.` : undefined,
      onDragEnd: ({ active, over }) => over ? `Dropped ${blockName(active.id)} at position ${indexOf(over.id) + 1}.` : "Dropped.",
      onDragCancel: ({ active }) => `Cancelled moving ${blockName(active.id)}.`,
    },
  };

  const title = settings.storyTitle ?? DEFAULT_STORY_TITLE;
  const show = settings.storyShowOnInvitation !== false;
  const usagePct = Math.min(100, Math.round((mediaBytes / WEDDING_MEDIA_QUOTA_BYTES) * 100));
  const overQuota = mediaBytes > WEDDING_MEDIA_QUOTA_BYTES;
  const fieldStyle = { borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer };
  const sectionHeading = "text-xs font-bold tracking-widest uppercase mb-4";
  const editingLocked = disabled || status !== "ready";

  return (
    <div className="space-y-8 min-w-0">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {/* Section settings */}
      <div>
        <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>Section</h3>
        <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div>
            <label htmlFor="story-section-title" className="text-xs font-bold tracking-widest uppercase mb-2 block"
              style={{ color: BUILDER_UI.onSurfaceVar }}>
              Section Title
            </label>
            <Input
              id="story-section-title"
              value={title}
              onChange={e => onSettingChange("storyTitle", e.target.value)}
              onBlur={() => { if (!title.trim()) onSettingChange("storyTitle", DEFAULT_STORY_TITLE); }}
              maxLength={STORY_SECTION_TITLE_MAX}
              placeholder={DEFAULT_STORY_TITLE}
              disabled={disabled}
              className="h-11 rounded-lg border-0 border-b-2"
              style={{ ...fieldStyle, fontFamily: settings.font1 || "Playfair Display" }}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {STORY_TITLE_SUGGESTIONS.map(s => (
                <button key={s} type="button" disabled={disabled}
                  onClick={() => onSettingChange("storyTitle", s)}
                  className="px-3 py-1 rounded-full border text-xs font-bold transition-all"
                  style={{
                    backgroundColor: title === s ? BUILDER_UI.selected : BUILDER_UI.surface,
                    borderColor: title === s ? BUILDER_UI.primary : BUILDER_UI.outline,
                    color: title === s ? BUILDER_UI.primary : BUILDER_UI.onSurfaceVar,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: BUILDER_UI.outline }}>
            <div>
              <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Show story on invitation</p>
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Hidden stories stay saved — turn this back on anytime.
              </p>
            </div>
            <Toggle checked={show} onChange={v => onSettingChange("storyShowOnInvitation", v)}
              label="Show story on invitation" disabled={disabled} />
          </div>
        </div>
      </div>

      {/* Storage meter */}
      <div>
        <div className="flex justify-between text-xs mb-1.5" style={{ color: BUILDER_UI.onSurfaceVar }}>
          <span className="font-bold tracking-widest uppercase">Photo storage</span>
          <span style={{ color: overQuota ? ERROR_COLOR : undefined }}>
            {formatBytes(mediaBytes)} of {formatBytes(WEDDING_MEDIA_QUOTA_BYTES)} (includes Hero Photo)
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: BUILDER_UI.surfaceHigh }}
          role="meter" aria-label="Photo storage used" aria-valuenow={usagePct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${usagePct}%`, backgroundColor: overQuota ? ERROR_COLOR : usagePct > 90 ? "#b7791f" : BUILDER_UI.primary }} />
        </div>
        {overQuota && (
          <p className="text-xs mt-1.5" style={{ color: ERROR_COLOR }}>
            You're over the photo limit. Remove or replace some photos before saving.
          </p>
        )}
      </div>

      {/* Blocks */}
      <div>
        <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>Story Blocks</h3>

        {status === "loading" && (
          <div className="flex items-center gap-2 p-4 rounded-lg mb-4 text-sm" role="status"
            style={{ backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurfaceVar }}>
            <Loader2 size={16} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
            Loading your story{loadedCount ? ` — ${loadedCount} block${loadedCount === 1 ? "" : "s"} so far` : ""}…
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 p-4 rounded-lg mb-4 text-sm" role="alert"
            style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: ERROR_COLOR }} />
            <div>
              <p>Your story couldn't be loaded, so Story and photo changes can't be saved right now.</p>
              {onRetryLoad && (
                <button type="button" onClick={onRetryLoad} className="mt-2 text-xs font-bold underline"
                  style={{ color: BUILDER_UI.primary }}>
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {status === "ready" && blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed mb-4"
            style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
            <BookHeart size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No story blocks yet</p>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Add a block for each chapter — how you met, the proposal, favorite memories.
            </p>
          </div>
        )}

        {status === "ready" && blocks.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 mb-4">
                {blocks.map((block, i) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    index={i}
                    total={blocks.length}
                    disabled={editingLocked}
                    collapsed={collapsed.has(block.id)}
                    onToggleCollapsed={() => toggleCollapsed(block.id)}
                    onFieldChange={(field, value) => updateBlock(block.id, b => ({ ...b, [field]: value }))}
                    onPhotoChange={(slot, photo) => setPhoto(block.id, slot, photo)}
                    onRequestLayout={layout => requestLayout(block.id, layout)}
                    onMoveUp={() => move(i, i - 1)}
                    onMoveDown={() => move(i, i + 1)}
                    onDelete={() => requestDelete(block.id)}
                    progressByKey={progressByKey}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <button type="button" onClick={addBlock} disabled={editingLocked}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-widest disabled:opacity-60"
          style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
          <Plus size={15} /> Add Story Block
        </button>
        <p className="text-xs mt-3" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Changes and photos are saved when you click Save. Empty blocks are removed on save.
        </p>
      </div>

      {/* Confirm: layout change that hides photos */}
      <AlertDialog open={Boolean(pendingLayout)} onOpenChange={open => { if (!open) setPendingLayout(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingLayout ? getLayout(pendingLayout.layout).label : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLayout?.hidden === 1 ? "1 photo doesn't" : `${pendingLayout?.hidden} photos don't`} fit this
              layout. {pendingLayout?.hidden === 1 ? "It stays" : "They stay"} until you save, so you can switch back
              to keep {pendingLayout?.hidden === 1 ? "it" : "them"}. When you save, {pendingLayout?.hidden === 1 ? "it" : "they"} will
              be removed. Your text is always kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current layout</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLayout) updateBlock(pendingLayout.blockId, b => changeBlockLayout(b, pendingLayout.layout));
                setPendingLayout(null);
              }}>
              Switch layout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete a block that has content */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete ? blockName(pendingDelete) : "block"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its text and photos will be removed from your story when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDelete) deleteBlock(pendingDelete); setPendingDelete(null); }}>
              Delete block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoryPanel;
