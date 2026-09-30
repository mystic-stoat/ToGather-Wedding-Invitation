// src/components/PlaceAutocompleteInput.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Address/venue input powered by Google Places API (New).
//
// Uses the modern Maps JavaScript API surface:
//   - AutocompleteSuggestion.fetchAutocompleteSuggestions()
//   - AutocompleteSessionToken (one per typing session, ended on selection)
//   - Place.fetchFields() for displayName / formattedAddress / id / location /
//     googleMapsURI
//
// The Maps JS API script is loaded lazily and only when
// VITE_GOOGLE_MAPS_API_KEY is configured. Without a key (or if the request
// fails) this degrades to a plain text input — manual entry keeps working and
// nothing throws.
//
// Because we render our own suggestion list (not a Google widget), a
// "Powered by Google" attribution is shown inside the dropdown as required.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

// Loads the Maps JS API exactly once; resolves false when no key / load fails.
let googleMapsPromise = null;
export const loadGoogleMaps = () => {
  if (typeof window !== "undefined" && window.google?.maps?.places) {
    return Promise.resolve(true);
  }
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.resolve(false);
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  return googleMapsPromise;
};

// Street addresses plus venue-style results; biased to the US only.
const AUTOCOMPLETE_TYPES = [
  "street_address",
  "premise",
  "subpremise",
  "point_of_interest",
  "establishment",
];
const AUTOCOMPLETE_REGION = ["us"];
const DEBOUNCE_MS = 300;

const PlaceAutocompleteInput = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
}) => {
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.google?.maps?.places
  );
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const suppressFetchRef = useRef(false);

  // Lazy-load the Maps JS API on mount.
  useEffect(() => {
    let live = true;
    loadGoogleMaps().then(ok => { if (live) setReady(ok); });
    return () => { live = false; };
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const placesAvailable = () =>
    ready && typeof window !== "undefined" && !!window.google?.maps?.places;

  const fetchSuggestions = async (q) => {
    const places = window.google.maps.places;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
    setFetching(true);
    try {
      const { suggestions: results } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: AUTOCOMPLETE_REGION,
          includedPrimaryTypes: AUTOCOMPLETE_TYPES,
        });
      const preds = (results || []).filter(s => s.placePrediction);
      setSuggestions(preds);
      setSearchedEmpty(preds.length === 0);
      setHighlighted(-1);
      setOpen(true);
    } catch {
      // Google unavailable — degrade quietly to manual entry.
      setSuggestions([]);
      setSearchedEmpty(false);
      setOpen(false);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);

    if (suppressFetchRef.current) {           // value set by selection
      suppressFetchRef.current = false;
      return;
    }
    if (!placesAvailable()) return;

    clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setSuggestions([]);
      setSearchedEmpty(false);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(v), DEBOUNCE_MS);
  };

  const handleSelect = async (suggestion) => {
    const pred = suggestion.placePrediction;
    setSelecting(true);
    setOpen(false);
    try {
      const place = pred.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "id", "location", "googleMapsURI"],
      });
      const loc = place.location;
      const lat = loc ? (typeof loc.lat === "function" ? loc.lat() : loc.lat) : null;
      const lng = loc ? (typeof loc.lng === "function" ? loc.lng() : loc.lng) : null;
      sessionTokenRef.current = null;          // session ends on selection

      suppressFetchRef.current = true;
      onPlaceSelect?.({
        name: place.displayName ?? pred.mainText?.text ?? "",
        address: place.formattedAddress ?? pred.text?.text ?? "",
        placeId: place.id ?? pred.placeId ?? "",
        lat,
        lng,
        url: place.googleMapsURI ?? "",
      });
    } catch {
      // Details request failed — keep whatever the user typed.
    } finally {
      setSelecting(false);
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(i => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && (suggestions.length > 0 || searchedEmpty || fetching);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={showDropdown}
          aria-label={ariaLabel}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          className={className}
        />
        {(fetching || selecting) && (
          <Loader2
            size={16}
            className="animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-xl border border-border/60
            bg-popover shadow-lg overflow-hidden"
        >
          {fetching && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Searching Google Maps…
            </div>
          ) : (
            <>
              <ul>
                {suggestions.map((s, i) => {
                  const pred = s.placePrediction;
                  const key = pred.placeId || i;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlighted}
                        onMouseEnter={() => setHighlighted(i)}
                        onClick={() => handleSelect(s)}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left
                          transition-colors ${i === highlighted ? "bg-muted" : ""}`}
                      >
                        <MapPin size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">
                            {pred.mainText?.text ?? pred.text?.text}
                          </span>
                          {pred.secondaryText?.text && (
                            <span className="block text-xs text-muted-foreground truncate">
                              {pred.secondaryText.text}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {searchedEmpty && suggestions.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  No matching places — you can keep typing a manual address.
                </div>
              )}
            </>
          )}
          {/* Required Google attribution for self-rendered suggestion lists */}
          <div className="border-t border-border/40 px-4 py-1.5 text-right">
            <span className="text-[10px] text-muted-foreground">Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceAutocompleteInput;
