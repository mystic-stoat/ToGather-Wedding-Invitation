// src/components/invitation/StorySection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders the "Our Story" section of the invitation (visual reference: the
// team's Our Story prototype — centered title, soft tinted background, photo
// and text side by side). Used by the builder's phone preview today and meant
// to be reused by the published invitation page later.
//
// Text is shown only for layouts that support it (photo left/right, text
// only). Photo-only layouts keep their text in the data but don't display it.
// ─────────────────────────────────────────────────────────────────────────────

import { ChevronDown, Image as ImageIcon } from "lucide-react";
import { getLayout, getVisibleSlots, blockHasVisibleContent, normalizeStoryTitle } from "@/lib/storyBlocks";
import { photoSrc } from "@/lib/imageProcessing";
import { photoImageStyle } from "@/lib/photoAdjust";
import "./storySection.css";

/** Mix a hex color with white (weight = share of the color). Falls back to a soft blush. */
export const tintColor = (hex, weight = 0.14) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "#FBF1EF";
  let h = m[1];
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = c => Math.round(c * weight + 255 * (1 - weight));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

const Photo = ({ photo, shape, alt, showPlaceholder, className = "" }) => {
  const src = photoSrc(photo);
  if (!src && !showPlaceholder) return null;
  return (
    <div className={`tg-story__photo tg-story__photo--${shape} ${className}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" style={photoImageStyle(photo)}
          width={photo?.width || undefined} height={photo?.height || undefined} />
      ) : (
        <div className="tg-story__placeholder" aria-hidden="true">
          <ImageIcon size={16} />
        </div>
      )}
    </div>
  );
};

const Text = ({ block, headingFont, textColor, mutedColor }) => {
  const title = block.title.trim();
  const description = block.description.trim();
  if (!title && !description) return null;
  return (
    <div className="min-w-0">
      {title && <h3 className="tg-story__title" style={{ fontFamily: headingFont, color: textColor }}>{title}</h3>}
      {description && <p className="tg-story__text" style={{ color: mutedColor }}>{description}</p>}
    </div>
  );
};

const StoryBlock = ({ block, index, showPlaceholders, ...style }) => {
  const slots = getVisibleSlots(block);
  const alt = (n) => block.title.trim() ? `${block.title.trim()} — photo ${n}` : `Story photo ${index + 1}.${n}`;
  const p = (i, shape, className) => (
    <Photo key={i} photo={slots[i]} shape={shape} alt={alt(i + 1)} showPlaceholder={showPlaceholders} className={className} />
  );

  switch (block.layout) {
    case "photoLeft":
    case "photoRight": {
      const hasText = Boolean(block.title.trim() || block.description.trim());
      const hasPhoto = Boolean(photoSrc(slots[0])) || showPlaceholders;
      const text = <Text block={block} {...style} />;
      const photo = p(0, "portrait");
      // Fall back to a single column when one side is empty.
      if (!hasText) return <div data-layout={block.layout}>{photo}</div>;
      if (!hasPhoto) return <div className="tg-story__text-only" data-layout={block.layout}>{text}</div>;
      return (
        <div className="tg-story__split" data-layout={block.layout}>
          {block.layout === "photoLeft" ? <>{photo}{text}</> : <>{text}{photo}</>}
        </div>
      );
    }
    case "twoPhotos":
      return <div className="tg-story__pair" data-layout="twoPhotos">{p(0, "portrait")}{p(1, "portrait")}</div>;
    case "fullWidth":
      return <div data-layout="fullWidth">{p(0, "landscape")}</div>;
    case "textOnly":
      return <div className="tg-story__text-only" data-layout="textOnly"><Text block={block} {...style} /></div>;
    case "collage": {
      if (!showPlaceholders) {
        // Rebalance when some slots are empty so the collage never has holes.
        const filled = slots.filter(Boolean);
        if (filled.length === 1) return <div data-layout="collage"><Photo photo={filled[0]} shape="landscape" alt={alt(1)} /></div>;
        if (filled.length === 2) {
          return (
            <div className="tg-story__pair" data-layout="collage">
              {filled.map((ph, i) => <Photo key={i} photo={ph} shape="portrait" alt={alt(i + 1)} />)}
            </div>
          );
        }
      }
      return (
        <div className="tg-story__collage" data-layout="collage">
          {p(0, "portrait", "tg-story__collage-main")}
          <div className="tg-story__collage-side">{p(1, "square")}{p(2, "square")}</div>
        </div>
      );
    }
    default:
      return null;
  }
};

/**
 * Props
 *   title            section title ("Our Story" by default)
 *   blocks           local or saved blocks, in order
 *   headingFont / bodyFont
 *   accentColor      invitation color used to tint the background
 *   textColor / mutedColor
 *   showPlaceholders builder preview: show empty photo slots so the layout is visible
 */
const StorySection = ({
  title, blocks = [], headingFont, bodyFont, accentColor,
  textColor = "#1a1c19", mutedColor = "#46483c", showPlaceholders = false,
}) => {
  const visible = blocks.filter(b => showPlaceholders || blockHasVisibleContent(b));
  if (!visible.length) return null;
  const style = { headingFont, textColor, mutedColor };

  return (
    <section className="tg-story" aria-label={normalizeStoryTitle(title)}
      style={{ backgroundColor: tintColor(accentColor), fontFamily: bodyFont, padding: "1.75rem 1rem" }}>
      <div className="tg-story__inner">
        <h2 className="tg-story__heading" style={{ fontFamily: headingFont, color: textColor }}>
          {normalizeStoryTitle(title)}
        </h2>
        {visible.map((block, i) => (
          <div key={block.id} data-testid="story-block-preview" data-layout-label={getLayout(block.layout).label}>
            <StoryBlock block={block} index={i} showPlaceholders={showPlaceholders} {...style} />
          </div>
        ))}
        <div className="tg-story__chevron" aria-hidden="true" style={{ color: textColor }}>
          <ChevronDown size={16} />
        </div>
      </div>
    </section>
  );
};

export default StorySection;
