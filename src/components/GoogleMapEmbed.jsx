// src/components/GoogleMapEmbed.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Standard Google Maps embed for a venue/address.
//
// Uses the keyless `output=embed` URL, so no API key or custom styling is
// involved — the map renders with Google's normal appearance (roads, labels,
// POIs, controls). The query is debounced so typing in a form doesn't reload
// the iframe on every keystroke.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";

// Joins venue name + address into a single search query, skipping empty parts.
export const buildMapQuery = (name, address) =>
  [name, address].map(s => (s ?? "").trim()).filter(Boolean).join(", ");

export const mapEmbedSrc = (query) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;

export const mapLinkUrl = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const GoogleMapEmbed = ({
  query,
  linkUrl,
  heightClass = "h-64",
  showLink = false,
  interactive = true,
  title = "Venue map",
}) => {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 500);
    return () => clearTimeout(t);
  }, [query]);

  const q = (debounced ?? "").trim();

  return (
    <div className="space-y-2">
      {q ? (
        <div className={`w-full ${heightClass} rounded-xl overflow-hidden border border-border/60`}>
          <iframe
            title={title}
            src={mapEmbedSrc(q)}
            className={`w-full h-full border-0 ${interactive ? "" : "pointer-events-none"}`}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div
          className={`w-full ${heightClass} rounded-xl border border-dashed border-border/60
            flex flex-col items-center justify-center gap-2 text-muted-foreground`}
        >
          <MapPin size={20} />
          <p className="text-xs">Enter a venue address to preview the map.</p>
        </div>
      )}
      {showLink && q && (
        <a
          href={linkUrl || mapLinkUrl(q)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          View in Google Maps
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
};

export default GoogleMapEmbed;
