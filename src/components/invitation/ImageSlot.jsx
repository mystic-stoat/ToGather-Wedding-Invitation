// src/components/invitation/ImageSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One photo "slot" used by Hero Photo and every Our Story block.
//   Empty  → an "Add photo" drop target (click or drag a file onto it)
//   Filled → the photo, center-cropped to the slot's aspect ratio, with
//            Replace / Remove buttons that are always visible (touch friendly)
// Picking a file validates + compresses it right away (no upload). The photo
// is uploaded later, when the couple clicks Save.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Loader2, CloudUpload } from "lucide-react";
import { preparePhoto, photoSrc } from "@/lib/imageProcessing";
import { ACCEPT_ATTRIBUTE, MAX_ORIGINAL_PHOTO_BYTES, formatBytes } from "@/lib/mediaConfig";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";

/**
 * Props
 *   photo      saved photo | pending photo | null
 *   onChange   (newPhoto | null) => void — parent releases the old pending photo
 *   label      accessible name, e.g. "Hero Photo" or "Block 2 photo 1"
 *   aspect     CSS aspect-ratio for the slot, e.g. "4 / 5"
 *   progress   0–100 while this photo uploads during Save, else undefined
 *   disabled   true while saving
 */
const ImageSlot = ({ photo, onChange, label, aspect = "4 / 5", progress, disabled = false, hint }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

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
    onChange(res.photo);
  };

  const openPicker = () => { if (!disabled && !busy) inputRef.current?.click(); };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const src = photoSrc(photo);
  const uploading = typeof progress === "number" && progress < 100 && photo?.pending;

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

      <div
        className="relative w-full overflow-hidden rounded-lg border-2 transition-colors"
        style={{
          aspectRatio: aspect,
          borderStyle: src ? "solid" : "dashed",
          borderColor: dragOver ? BUILDER_UI.primary : BUILDER_UI.outline,
          backgroundColor: src ? BUILDER_UI.surfaceHigh : BUILDER_UI.surfaceContainer,
        }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {src ? (
          <>
            <img
              src={src}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
            {photo?.pending && !uploading && (
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

      {src && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <button type="button" onClick={openPicker} disabled={disabled || busy}
            className="flex items-center gap-1 text-xs font-bold disabled:opacity-50"
            style={{ color: BUILDER_UI.primary }} aria-label={`Replace ${label}`}>
            <RefreshCw size={12} /> Replace
          </button>
          <button type="button" onClick={() => { setError(""); onChange(null); }} disabled={disabled || busy}
            className="flex items-center gap-1 text-xs font-bold disabled:opacity-50"
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
