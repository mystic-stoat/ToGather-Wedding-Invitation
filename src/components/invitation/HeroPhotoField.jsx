// src/components/invitation/HeroPhotoField.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Hero Photo controls shown in the Greetings tab (moved here from the removed
// Layout tab). One photo; preview / replace / remove; uploaded on Save.
// The photo is center-cropped to fill the hero area of the invitation.
// ─────────────────────────────────────────────────────────────────────────────

import ImageSlot from "@/components/invitation/ImageSlot";
import { BUILDER_UI } from "@/components/invitation/builderTheme";

const HeroPhotoField = ({ photo, onChange, progress, disabled }) => (
  <div>
    <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
      style={{ color: BUILDER_UI.onSurfaceVar }}>
      Hero Photo
    </h3>
    <p className="text-sm mb-4" style={{ color: BUILDER_UI.onSurfaceVar }}>
      The large photo at the top of your invitation. It's cropped from the center
      to fit, so keep the two of you near the middle.
    </p>
    <div className="max-w-md">
      <ImageSlot
        photo={photo}
        onChange={onChange}
        label="Hero Photo"
        aspect="3 / 2"
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
