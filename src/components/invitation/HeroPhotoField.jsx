// src/components/invitation/HeroPhotoField.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Hero Photo controls shown in the Greetings tab (moved here from the removed
// Layout tab). One photo; preview / adjust / replace / remove; uploaded on Save.
// The editor frame has the SAME shape as the invitation's hero area
// (HERO_FRAME_ASPECT), so the position/zoom chosen here looks identical there.
// ─────────────────────────────────────────────────────────────────────────────

import ImageSlot from "@/components/invitation/ImageSlot";
import { BUILDER_UI } from "@/components/invitation/builderTheme";

// Shape of the hero area in the invitation preview: 268 × 384 px
// (phone screen width × h-96). Keep in sync if that area changes.
export const HERO_FRAME_ASPECT = "67 / 96";

const HeroPhotoField = ({ photo, onChange, progress, disabled }) => (
  <div>
    <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
      style={{ color: BUILDER_UI.onSurfaceVar }}>
      Hero Photo
    </h3>
    <p className="text-sm mb-4" style={{ color: BUILDER_UI.onSurfaceVar }}>
      The large photo at the top of your invitation. Use Adjust to drag it into
      place and zoom — the frame below matches the invitation exactly.
    </p>
    {/* Narrower than before so the taller frame (same shape as the
        invitation) still fits comfortably in the panel. */}
    <div className="max-w-[280px]">
      <ImageSlot
        photo={photo}
        onChange={onChange}
        label="Hero Photo"
        aspect={HERO_FRAME_ASPECT}
        progress={progress}
        disabled={disabled}
      />
    </div>
    <p className="text-xs mt-2" style={{ color: BUILDER_UI.onSurfaceVar }}>
      Photos are uploaded when you click Save.
    </p>
  </div>
);

export default HeroPhotoField;
