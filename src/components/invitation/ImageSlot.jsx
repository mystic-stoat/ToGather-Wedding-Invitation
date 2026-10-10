// src/components/invitation/ImageSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One photo "slot" used by Hero Photo and every Our Story block.
//   Empty  → an "Add photo" drop target (click or drag a file onto it)
//   Filled → the photo inside its frame, with Adjust / Replace / Remove buttons
//            that are always visible (touch friendly)
//   Adjust → drag the photo to reposition it (mouse, touch or pen), zoom with
//            the slider, Reset to center, Done to finish. Keyboard: arrow keys
//            move (Shift = bigger steps), + / − zoom, 0 resets.
// Picking a file validates + compresses it right away (no upload). The photo
// is uploaded later, when the couple clicks Save. Position/zoom are stored on
// the photo as `adjust` (src/lib/photoAdjust.js) and saved on Save as well.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import {
  ImagePlus, RefreshCw, Trash2, Loader2, CloudUpload, Move, ZoomIn, ZoomOut, RotateCcw, Check,
} from "lucide-react";
import { preparePhoto, photoSrc } from "@/lib/imageProcessing";
import { ACCEPT_ATTRIBUTE, MAX_ORIGINAL_PHOTO_BYTES, formatBytes } from "@/lib/mediaConfig";
import {
  photoImageStyle, panAdjust, zoomAdjust, nudgeAdjust, normalizeAdjust, isDefaultAdjust,
  DEFAULT_ADJUST, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP,
} from "@/lib/photoAdjust";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";

/**
 * Props
 *   photo      saved photo | pending photo | null
 *   onChange   (newPhoto | null) => void — a new photo, null (removed), or the
 *              same photo with a new `adjust`. The parent releases the old
 *              preview only when the photo was really replaced (releaseIfReplaced).
 *   label      accessible name, e.g. "Hero Photo" or "Block 2 photo 1"
 *   aspect     CSS aspect-ratio of the frame — must match the invitation frame
 *   progress   0–100 while this photo uploads during Save, else undefined
 *   disabled   true while saving
 */
const ImageSlot = ({ photo, onChange, label, aspect = "4 / 5", progress, disabled = false, hint }) => {
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null); // { pointerId, startX, startY, start: adjust }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    if (!file || disabled) return;
    setBusy(true);
    setError("");
    const res = await preparePhoto(file);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdjusting(false);
    onChange(res.photo); // a new photo starts centered (no adjust)
  };

  const openPicker = () => { if (!disabled && !busy) inputRef.current?.click(); };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (adjusting) return;
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const src = photoSrc(photo);
  const uploading = typeof progress === "number" && progress < 100 && photo?.pending;
  const adjust = normalizeAdjust(photo?.adjust);
  const canAdjust = Boolean(src) && !disabled && !busy;
  const isAdjusting = adjusting && canAdjust;

  const setAdjust = (next) => onChange({ ...photo, adjust: normalizeAdjust(next) });

  // Size of the photo itself: the stored dimensions, or the loaded image's.
  const imageSize = () => ({
    width: photo?.width || imgRef.current?.naturalWidth || 0,
    height: photo?.height || imgRef.current?.naturalHeight || 0,
  });

  // ── Dragging (Pointer Events = mouse, touch and pen) ──────────────────────
  const onPointerDown = (e) => {
    if (!isAdjusting || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    try { frameRef.current?.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, start: adjust };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || (d.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== d.pointerId)) return;
    e.preventDefault();
    const rect = frameRef.current.getBoundingClientRect();
    setAdjust(panAdjust(d.start, e.clientX - d.startX, e.clientY - d.startY,
      { width: rect.width, height: rect.height }, imageSize()));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // ── Keyboard (frame is focusable while adjusting) ──────────────────────────
  const onKeyDown = (e) => {
    if (!isAdjusting) return;
    const step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setAdjust(nudgeAdjust(adjust, ...moves[e.key]));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setAdjust(zoomAdjust(adjust, adjust.zoom + 0.1));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setAdjust(zoomAdjust(adjust, adjust.zoom - 0.1));
    } else if (e.key === "0") {
      e.preventDefault();
      setAdjust(DEFAULT_ADJUST);
    } else if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      setAdjusting(false);
    }
  };

  const iconTextBtn = "flex items-center gap-1 text-xs font-bold disabled:opacity-50";

  return (
    <div className="w-full min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        aria-label={`Choose ${label}`}
        data-testid={`file-input-${label}`}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* The border lives on this wrapper so the photo area inside has EXACTLY
          the frame's aspect ratio (a border inside an aspect-ratio box would
          make it slightly off and the invitation crop would not match). */}
      <div
        className="w-full overflow-hidden rounded-lg border-2 transition-colors"
        style={{
          borderStyle: src ? "solid" : "dashed",
          borderColor: dragOver || isAdjusting ? BUILDER_UI.primary : BUILDER_UI.outline,
        }}
      >
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden select-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-4"
        style={{
          aspectRatio: aspect,
          backgroundColor: src ? BUILDER_UI.surfaceHigh : BUILDER_UI.surfaceContainer,
          // While adjusting, a finger drag moves the photo instead of scrolling the page.
          touchAction: isAdjusting ? "none" : undefined,
          cursor: isAdjusting ? (dragging ? "grabbing" : "grab") : undefined,
        }}
        data-testid={`photo-frame-${label}`}
        role={isAdjusting ? "group" : undefined}
        aria-label={isAdjusting ? `${label} position. Drag, or use the arrow keys to move and plus or minus to zoom.` : undefined}
        tabIndex={isAdjusting ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDragOver={e => { e.preventDefault(); if (!disabled && !isAdjusting) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {src ? (
          <>
            <img
              ref={imgRef}
              src={src}
              alt={label}
              draggable={false}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={photoImageStyle(photo)}
              loading="lazy"
              decoding="async"
            />
            {isAdjusting && (
              <>
                {/* Rule-of-thirds guide */}
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.45) 1px, transparent 1px)",
                    backgroundSize: "33.333% 33.333%",
                    backgroundPosition: "-1px -1px",
                  }} />
                {!dragging && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold pointer-events-none whitespace-nowrap"
                    style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}>
                    <Move size={11} /> Drag to reposition
                  </span>
                )}
              </>
            )}
            {photo?.pending && !uploading && !isAdjusting && (
              <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: "rgba(255,255,255,0.92)", color: BUILDER_UI.primary }}>
                <CloudUpload size={11} /> Uploads on save
              </span>
            )}
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 p-2" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                role="progressbar" aria-label={`Uploading ${label}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.35)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: "#fff" }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled || busy}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center disabled:cursor-not-allowed"
            aria-label={`Add ${label}`}
          >
            {busy
              ? <Loader2 size={20} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
              : <ImagePlus size={20} style={{ color: BUILDER_UI.primary }} />}
            <span className="text-xs font-bold" style={{ color: BUILDER_UI.onSurface }}>
              {busy ? "Preparing…" : "Add photo"}
            </span>
            <span className="text-[10px] leading-tight hidden sm:block" style={{ color: BUILDER_UI.onSurfaceVar }}>
              {hint || `JPEG, PNG or WebP · up to ${formatBytes(MAX_ORIGINAL_PHOTO_BYTES)}`}
            </span>
          </button>
        )}
        {busy && src && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
          </div>
        )}
      </div>
      </div>

      {/* Adjust controls: zoom slider, Reset, Done */}
      {src && isAdjusting && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className="p-1.5 rounded-md hover:bg-black/5" aria-label={`Zoom out ${label}`}
              onClick={() => setAdjust(zoomAdjust(adjust, adjust.zoom - 0.1))} style={{ color: BUILDER_UI.onSurfaceVar }}>
              <ZoomOut size={14} />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={adjust.zoom}
              onChange={e => setAdjust(zoomAdjust(adjust, Number(e.target.value)))}
              aria-label={`Zoom ${label}`}
              aria-valuetext={`${Math.round(adjust.zoom * 100)}%`}
              className="flex-1 min-w-0 h-6 cursor-pointer"
              style={{ accentColor: BUILDER_UI.primary, touchAction: "pan-y" }}
            />
            <button type="button" className="p-1.5 rounded-md hover:bg-black/5" aria-label={`Zoom in ${label}`}
              onClick={() => setAdjust(zoomAdjust(adjust, adjust.zoom + 0.1))} style={{ color: BUILDER_UI.onSurfaceVar }}>
              <ZoomIn size={14} />
            </button>
            <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: BUILDER_UI.onSurfaceVar }}>
              {Math.round(adjust.zoom * 100)}%
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" className={iconTextBtn} style={{ color: BUILDER_UI.onSurfaceVar }}
              disabled={isDefaultAdjust(photo?.adjust)} onClick={() => setAdjust(DEFAULT_ADJUST)}
              aria-label={`Reset ${label} position and zoom`}>
              <RotateCcw size={12} /> Reset
            </button>
            <button type="button" className={iconTextBtn} style={{ color: BUILDER_UI.primary }}
              onClick={() => setAdjusting(false)} aria-label={`Done adjusting ${label}`}>
              <Check size={12} /> Done
            </button>
          </div>
        </div>
      )}

      {src && !isAdjusting && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <button type="button" onClick={() => { setAdjusting(true); setTimeout(() => frameRef.current?.focus(), 0); }}
            disabled={!canAdjust} className={iconTextBtn}
            style={{ color: BUILDER_UI.primary }} aria-label={`Adjust ${label}`}>
            <Move size={12} /> Adjust
          </button>
          <button type="button" onClick={openPicker} disabled={disabled || busy}
            className={iconTextBtn}
            style={{ color: BUILDER_UI.primary }} aria-label={`Replace ${label}`}>
            <RefreshCw size={12} /> Replace
          </button>
          <button type="button" onClick={() => { setError(""); onChange(null); }} disabled={disabled || busy}
            className={iconTextBtn}
            style={{ color: BUILDER_UI.onSurfaceVar }} aria-label={`Remove ${label}`}>
            <Trash2 size={12} /> Remove
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs mt-1.5" role="alert" style={{ color: ERROR_COLOR }}>{error}</p>
      )}
    </div>
  );
};

export default ImageSlot;
