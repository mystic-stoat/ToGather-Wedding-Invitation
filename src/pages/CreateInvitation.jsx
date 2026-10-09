// src/pages/CreateInvitation.jsx
//Worked on by Chris and Kris
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PAGE DOES:
//   The invitation builder. Hosts can design their digital wedding invitation
//   by customizing sections like layout, colors, fonts, greetings, music, etc.
//   A live phone mockup preview updates in real-time as they make changes.
//
// DESIGN APPROACH
//   - Shell/nav uses ToGather's design system (sage green, Playfair Display, shadcn)
//   - Invitation canvas uses the Stitch palette (olive, gold, warm off-white)
//   - This creates a clear separation between the "tool" and the "artifact"
//
// LAYOUT:
//   Left sidebar  → section navigation (Color Theme, Music, Greetings, Venue, RSVP, etc.)
//                   (the former Privacy tab was removed — it never controlled
//                   access; publishing is the header's Publish button)
//   Center panel  → active section's controls/settings
//   Right panel   → live phone mockup preview showing real wedding data
//
// DATA FLOW:
//   1. Loads existing invitation from Firestore (couple names, date, venue)
//   2. Loads/saves invitation customization settings to Firestore
//   3. All preview updates happen locally — only saved on "Save" or "Publish"
//   4. Hero Photo + Our Story photos are uploaded to Cloud Storage on Save
//      (see src/lib/storySave.js and docs/STORY_AND_MEDIA.md). Story blocks
//      live in invitations/{weddingId}/storyEntries, NOT in `settings`.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Heart, Palette, Music, Sparkles,
  BookOpen, Calendar, Image, MapPin, BookHeart, CheckSquare,
  BookMarked, ArrowLeft, Save, ChevronRight,
  Eye, Volume2, Info, Loader2, Hotel, Plus, Trash2, Utensils, ExternalLink,
  AlertCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser, saveInvitation } from "@/lib/firestore";
import GoogleMapEmbed, { buildMapQuery, mapLinkUrl } from "@/components/GoogleMapEmbed";
import {
  normalizeMealOptions,
  cleanMealOptionsForSave,
  createMealOption,
} from "@/lib/rsvpOptions";
import {
  TRAVEL_CATEGORIES,
  TRAVEL_MESSAGE_MAX,
  getTravelCategoryLabel,
  createTravelItem,
  normalizeTravelItems,
  validateTravelItems,
  cleanTravelItemsForSave,
  getVisibleTravelItems,
  getTravelShowOnInvitation,
  shouldShowTravelSection,
} from "@/lib/travelStay";
import { CANVAS, BUILDER_UI, BUILDER_FONT, ERROR_COLOR } from "@/components/invitation/builderTheme";
import ColorThemePanel from "@/components/invitation/ColorThemePanel";
import {
  DEFAULT_THEME_SETTINGS,
  THEME_FIELDS,
  normalizeThemeSettings,
  resolveInvitationTheme,
} from "@/lib/invitationTheme";
import { useGoogleFonts } from "@/hooks/useGoogleFonts";
import HeroPhotoField from "@/components/invitation/HeroPhotoField";
import StoryPanel from "@/components/invitation/StoryPanel";
import StorySection from "@/components/invitation/StorySection";
import WeddingDaySection from "@/components/invitation/WeddingDaySection";
import {
  DEFAULT_DATE_SETTINGS,
  DATE_SETTING_FIELDS,
  normalizeDateSettings,
  parseWeddingDate,
  shouldShowWeddingDaySection,
} from "@/lib/weddingDate";
import { DEFAULT_STORY_TITLE, normalizeStoryTitle } from "@/lib/storyBlocks";
import { photoSrc } from "@/lib/imageProcessing";
import { photoImageStyle } from "@/lib/photoAdjust";
import { useInvitationMedia } from "@/hooks/useInvitationMedia";
import {
  DEFAULT_VENUE_SETTINGS,
  VENUE_SETTING_FIELDS,
  normalizeVenueSettings,
  getVenueDisplay,
} from "@/lib/venueDisplay";
import { getInviteDeadlineError } from "@/lib/rsvpDeadline";

// ── Color tokens ──────────────────────────────────────────────────────────────
// CANVAS (the invitation itself) and BUILDER_UI (the builder chrome) now live in
// src/components/invitation/builderTheme.js so the extracted Hero Photo and
// Our Story components can share them. Values are unchanged.

// ── Section definitions — left sidebar nav ────────────────────────────────────
const SECTIONS = [
  { id: "theme",     label: "Color Theme", icon: Palette },
  { id: "music",     label: "Music",     icon: Music },
  { id: "greetings", label: "Greetings", icon: BookOpen },
  { id: "date",      label: "Date",      icon: Calendar },
  { id: "venue",     label: "Venue",     icon: MapPin },
  { id: "travel",    label: "Travel & Stay", icon: Hotel },
  { id: "story",     label: "Story",     icon: BookHeart },
  { id: "rsvp",      label: "RSVP",      icon: CheckSquare },
  { id: "guestbook", label: "Guestbook", icon: BookMarked },
];

// Older links to the former Color / Font tabs open the combined Color Theme tab.
// The former Privacy tab's only working control (RSVP deadline) is now in RSVP.
const SECTION_ALIASES = { color: "theme", font: "theme", privacy: "rsvp" };

// Color theme + font pairing presets now live in src/lib/invitationTheme.js
// (shared with the guest RSVP page) — values unchanged.

// ── Center Panel: Greetings ───────────────────────────────────────────────────
// Title + welcome message + Hero Photo (moved here from the removed Layout tab).
const GreetingsPanel = ({ settings, onChange, hero, onHeroChange, heroProgress, saving }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: BUILDER_UI.onSurfaceVar }}>
        Invitation Title
      </h3>
      <Input
        value={settings.greetingTitle || ""}
        onChange={e => onChange("greetingTitle", e.target.value)}
        placeholder="Together with their families..."
        className="h-12 rounded-lg border-0 border-b-2 italic"
        style={{
          borderColor: BUILDER_UI.outline,
          backgroundColor: BUILDER_UI.surfaceContainer,
          fontFamily: settings.font1 || "Playfair Display",
          fontSize: "1.1rem",
        }}
      />
    </div>
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: BUILDER_UI.onSurfaceVar }}>
        Welcome Message
      </h3>
      <Textarea
        value={settings.greetingMessage || ""}
        onChange={e => onChange("greetingMessage", e.target.value)}
        placeholder="The stars aligned when we met, and now we're getting married! Your presence at our wedding would make our special day even more memorable."
        className="min-h-[140px] rounded-lg border-0 border-b-2 resize-none"
        style={{
          borderColor: BUILDER_UI.outline,
          backgroundColor: BUILDER_UI.surfaceContainer,
          color: BUILDER_UI.onSurface,
        }}
      />
      <p className="text-xs mt-2 text-right" style={{ color: BUILDER_UI.onSurfaceVar }}>
        {(settings.greetingMessage || "").length}/300
      </p>
    </div>
    <HeroPhotoField photo={hero} onChange={onHeroChange} progress={heroProgress} disabled={saving} />
  </div>
);

// ── Center Panel: RSVP — deadline + host-configured meal options ─────────────
// RSVP deadline: the SAME `inviteDeadline` field Wedding Details edits (one
// value, shared validation in src/lib/rsvpDeadline.js). Moved here from the
// removed Privacy tab.
// Meal options: stored on the invitation doc as mealOptions: [{ id, name, description }].
// Zero options is valid: guests then aren't asked to choose a meal.
// Rows with an empty name are dropped when the invitation is saved.
const RsvpPanel = ({ invitation, settings, onChange, deadlineError, onDeadlineErrorClear }) => {
  const options = settings.mealOptions || [];

  const updateOption = (id, field, value) =>
    onChange("mealOptions", options.map(o => (o.id === id ? { ...o, [field]: value } : o)));

  const addOption = () => onChange("mealOptions", [...options, createMealOption()]);

  const removeOption = (id) => onChange("mealOptions", options.filter(o => o.id !== id));

  const fieldStyle = {
    borderColor: BUILDER_UI.outline,
    backgroundColor: BUILDER_UI.surfaceContainer,
    color: BUILDER_UI.onSurface,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          RSVP Deadline
        </h3>
        <Input
          type="date"
          aria-label="RSVP deadline"
          aria-invalid={deadlineError ? true : undefined}
          value={settings.inviteDeadline || ""}
          max={invitation?.weddingDate || undefined}
          onChange={e => { onChange("inviteDeadline", e.target.value); onDeadlineErrorClear?.(); }}
          className="h-12 rounded-lg border-0 border-b-2"
          style={{
            borderColor: deadlineError ? ERROR_COLOR : BUILDER_UI.outline,
            backgroundColor: BUILDER_UI.surfaceContainer,
          }}
        />
        {deadlineError ? (
          <p className="text-xs mt-2" role="alert" style={{ color: ERROR_COLOR }}>{deadlineError}</p>
        ) : (
          <p className="text-xs mt-2" style={{ color: BUILDER_UI.onSurfaceVar }}>
            Guests cannot RSVP after this date. This is the same deadline as on your{" "}
            <Link to="/wedding-details" className="underline font-semibold"
              style={{ color: BUILDER_UI.primary }}>
              Wedding Details
            </Link>{" "}
            page — changing it here updates it there when you save.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Meal Options
        </h3>
        <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Guests who accept will choose one of these meals for themselves and each
          plus-one. Leave the list empty if you aren't offering a meal choice.
          Dietary restrictions and allergies are always collected separately.
        </p>
      </div>

      {options.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed"
          style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
          <Utensils size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
          <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No meal options</p>
          <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
            Guests won't be asked to choose a meal.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={opt.id} className="p-4 rounded-lg border space-y-3"
              style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surface }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Meal {i + 1}
                </p>
                <button type="button" onClick={() => removeOption(opt.id)}
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: BUILDER_UI.onSurfaceVar }}
                  aria-label={`Remove meal ${i + 1}`}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
              <Input
                value={opt.name}
                onChange={e => updateOption(opt.id, "name", e.target.value)}
                placeholder="Meal name"
                maxLength={60}
                className="h-11 rounded-lg border-0 border-b-2"
                style={fieldStyle}
              />
              {!opt.name.trim() && (
                <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                  A meal without a name won't be saved.
                </p>
              )}
              <Input
                value={opt.description}
                onChange={e => updateOption(opt.id, "description", e.target.value)}
                placeholder="Description (optional)"
                maxLength={140}
                className="h-11 rounded-lg border-0 border-b-2"
                style={fieldStyle}
              />
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" onClick={addOption}
        className="w-full rounded-lg gap-2"
        style={{ borderColor: BUILDER_UI.outline, color: BUILDER_UI.primary }}>
        <Plus size={15} /> Add meal option
      </Button>

      <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
        Changes are saved when you click Save. Guests who already responded keep the
        meal name they chose, even if you rename or remove an option later.
      </p>
    </div>
  );
};

// ── Spotify link helper ───────────────────────────────────────────────────────
// Parses a Spotify "share" link (e.g. https://open.spotify.com/track/ID?si=...)
// and returns the track ID, or null if the link isn't a valid Spotify track URL.
// No network calls — this is pure string/URL parsing so invalid input can never
// throw or crash the page.
const parseSpotifyTrackUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null; // not a valid URL at all
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "open.spotify.com") return null;

  // Matches "/track/{id}" — ignores query params like "?si=..." since we
  // only ever read pathname, not search.
  const match = parsed.pathname.match(/^\/track\/([a-zA-Z0-9]+)\/?$/);
  if (!match) return null;

  const trackId = match[1];
  // Spotify base62 IDs are 22 characters; allow a little slack either way.
  if (!/^[a-zA-Z0-9]{10,30}$/.test(trackId)) return null;

  return trackId;
};

// ── Center Panel: Music ───────────────────────────────────────────────────────
// Simple Spotify-link integration: the host pastes a Spotify "share" link for a
// track, we extract the track ID (no Spotify API calls), and display Spotify's
// own official embed player. No custom audio player, no uploads, no autoplay.
const MusicPanel = ({ settings, onChange }) => {
  const hasSong = Boolean(settings.musicTrackId);

  // The link input is shown whenever there's no song yet, or the user clicked
  // "Change Song". The currently selected song (if any) stays selected the
  // whole time — it's only replaced once a new link validates successfully.
  const [showLinkInput, setShowLinkInput] = useState(!hasSong);
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState("");

  const handleAddSong = () => {
    const trackId = parseSpotifyTrackUrl(linkValue);
    if (!trackId) {
      setError("That doesn't look like a Spotify song link. Copy a track link from Spotify's Share menu and try again.");
      return;
    }
    onChange("musicTrackId", trackId);
    onChange("musicSpotifyUrl", linkValue.trim());
    setError("");
    setLinkValue("");
    setShowLinkInput(false);
  };

  const handleChangeSong = () => {
    // Keep the existing song selected — just reopen the input so the user
    // can paste a replacement link.
    setLinkValue("");
    setError("");
    setShowLinkInput(true);
  };

  const handleRemove = () => {
    onChange("musicTrackId", "");
    onChange("musicSpotifyUrl", "");
    // musicShowOnInvitation is intentionally left untouched.
    setLinkValue("");
    setError("");
    setShowLinkInput(true);
  };

  return (
    <div className="space-y-6">
      {/* Add from Spotify */}
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Add from Spotify
        </h3>
        <div className="rounded-lg p-6"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Volume2 size={16} style={{ color: BUILDER_UI.primary }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>
              Add from Spotify
            </p>
          </div>
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg"
            style={{ backgroundColor: BUILDER_UI.surfaceHigh }}>
            <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Find a song on Spotify, select Share, then copy and paste the song link below.
            </p>
          </div>

          {showLinkInput && (
            <>
              <label className="text-xs font-bold tracking-widest uppercase mb-2 block"
                style={{ color: BUILDER_UI.onSurfaceVar }}>
                Spotify Link
              </label>
              <div className="flex gap-3">
                <Input
                  value={linkValue}
                  onChange={e => { setLinkValue(e.target.value); if (error) setError(""); }}
                  placeholder="https://open.spotify.com/track/..."
                  className="h-11 rounded-lg border-0 border-b-2 flex-1"
                  style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer }}
                />
                <button onClick={handleAddSong}
                  className="px-6 rounded-lg text-sm font-bold uppercase tracking-widest flex-shrink-0"
                  style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
                  Add Song
                </button>
              </div>
              {error && (
                <p className="text-xs mt-2" style={{ color: "#b3261e" }}>
                  {error}
                </p>
              )}
              {hasSong && (
                <button onClick={() => { setShowLinkInput(false); setLinkValue(""); setError(""); }}
                  className="text-xs mt-3 font-semibold underline"
                  style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selected Song — Spotify's own embed player, no custom player built */}
      {hasSong && (
        <div>
          <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            Selected Song
          </h3>
          <div className="rounded-lg p-4"
            style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
            <iframe
              title="Spotify song preview"
              src={`https://open.spotify.com/embed/track/${settings.musicTrackId}`}
              width="100%"
              height="152"
              style={{ borderRadius: "12px", border: "none" }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
            <div className="flex items-center gap-4 mt-4">
              <button onClick={handleChangeSong}
                className="px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-lg"
                style={{ backgroundColor: BUILDER_UI.surfaceHigh, color: BUILDER_UI.onSurface }}>
                Change Song
              </button>
              <button onClick={handleRemove}
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: BUILDER_UI.onSurfaceVar }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playback Settings */}
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Playback Settings
        </h3>
        <div className="p-4 rounded-lg flex items-center justify-between"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div>
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>
              Show music on invitation
            </p>
            <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Guests can play this song on your invitation.
            </p>
          </div>
          <button
            onClick={() => onChange("musicShowOnInvitation", !settings.musicShowOnInvitation)}
            className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
            style={{ backgroundColor: settings.musicShowOnInvitation ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
              style={{ transform: settings.musicShowOnInvitation ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Center Panel: Travel & Stay ───────────────────────────────────────────────
// Host enters places manually (like Music's pasted Spotify link): category,
// name, a pasted Google Maps link and a description. Saved on the invitation
// doc as travelItems / travelMessage / travelShowOnInvitation on Save/Publish.
// `errors` = { [itemId]: { name?, mapUrl? } } from the parent's validation.
const TravelPanel = ({ settings, onChange, errors, setErrors }) => {
  const items = settings.travelItems || [];
  const showOnInvitation = getTravelShowOnInvitation(settings);

  const clearItemError = (id, field) =>
    setErrors(prev => {
      if (!prev[id]?.[field]) return prev;
      const { [field]: _removed, ...rest } = prev[id];
      const next = { ...prev };
      if (Object.keys(rest).length) next[id] = rest; else delete next[id];
      return next;
    });

  const updateItem = (id, field, value) => {
    onChange("travelItems", items.map(it => (it.id === id ? { ...it, [field]: value } : it)));
    clearItemError(id, field);
  };

  // Check a single place's link as soon as the host leaves the field
  const checkItemLink = (item) => {
    const itemErrors = validateTravelItems([item])[item.id];
    if (itemErrors?.mapUrl) {
      setErrors(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), mapUrl: itemErrors.mapUrl } }));
    }
  };

  const addItem = () => onChange("travelItems", [...items, createTravelItem()]);

  const removeItem = (id) => {
    onChange("travelItems", items.filter(it => it.id !== id));
    setErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const fieldStyle = { borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer };
  const labelCls = "text-xs font-bold tracking-widest uppercase mb-2 block";
  const errorText = (msg) => msg && (
    <p className="text-xs mt-1.5" style={{ color: "#b3261e" }}>{msg}</p>
  );

  return (
    <div className="space-y-8">
      {/* Visibility toggle — same control as Music's "Show music on invitation" */}
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Visibility
        </h3>
        <div className="p-4 rounded-lg flex items-center justify-between"
          style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div>
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>
              Show Travel &amp; Stay on invitation
            </p>
            <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Appears once at least one place has a name.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showOnInvitation}
            aria-label="Show Travel & Stay on invitation"
            onClick={() => onChange("travelShowOnInvitation", !showOnInvitation)}
            className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
            style={{ backgroundColor: showOnInvitation ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
              style={{ transform: showOnInvitation ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
      </div>

      {/* Intro message */}
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Introductory Message <span className="normal-case tracking-normal font-normal">(optional)</span>
        </h3>
        <Textarea
          value={settings.travelMessage || ""}
          onChange={e => onChange("travelMessage", e.target.value.slice(0, TRAVEL_MESSAGE_MAX))}
          placeholder="Here are a few places we recommend for out-of-town guests."
          className="min-h-[100px] rounded-lg border-0 border-b-2 resize-none"
          style={{ ...fieldStyle, color: BUILDER_UI.onSurface }}
        />
        <p className="text-xs mt-2 text-right" style={{ color: BUILDER_UI.onSurfaceVar }}>
          {(settings.travelMessage || "").length}/{TRAVEL_MESSAGE_MAX}
        </p>
      </div>

      {/* Places */}
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Places
        </h3>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed mb-4"
            style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
            <Hotel size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No places yet</p>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Add hotels, restaurants, airports or anything else guests may need.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {items.map((item, i) => {
              const itemErrors = errors[item.id] || {};
              return (
                <div key={item.id} className="rounded-lg p-5 space-y-4"
                  style={{ backgroundColor: BUILDER_UI.surfaceContainer, border: `1px solid ${BUILDER_UI.outline}` }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold tracking-widest uppercase"
                      style={{ color: BUILDER_UI.onSurfaceVar }}>
                      Place {i + 1}
                    </p>
                    <button type="button" onClick={() => removeItem(item.id)}
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
                      style={{ color: BUILDER_UI.onSurfaceVar }}
                      aria-label={`Remove place ${i + 1}`}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>

                  {/* Category */}
                  <div>
                    <span className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>Category</span>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Place ${i + 1} category`}>
                      {TRAVEL_CATEGORIES.map(cat => {
                        const selected = item.category === cat.value;
                        return (
                          <button key={cat.value} type="button" role="radio" aria-checked={selected}
                            onClick={() => updateItem(item.id, "category", cat.value)}
                            className="px-4 py-2 rounded-lg border-2 text-xs font-bold transition-all"
                            style={{
                              backgroundColor: selected ? BUILDER_UI.selected : BUILDER_UI.surface,
                              borderColor: selected ? BUILDER_UI.primary : "transparent",
                              color: selected ? BUILDER_UI.primary : BUILDER_UI.onSurfaceVar,
                            }}>
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label htmlFor={`travel-name-${item.id}`} className={labelCls}
                      style={{ color: BUILDER_UI.onSurfaceVar }}>
                      Place Name
                    </label>
                    <Input
                      id={`travel-name-${item.id}`}
                      value={item.name}
                      onChange={e => updateItem(item.id, "name", e.target.value)}
                      placeholder="Hyatt Regency Dallas"
                      maxLength={100}
                      className="h-11 rounded-lg border-0 border-b-2"
                      style={{ ...fieldStyle, ...(itemErrors.name ? { borderColor: "#b3261e" } : {}) }}
                    />
                    {errorText(itemErrors.name)}
                  </div>

                  {/* Google Maps link */}
                  <div>
                    <label htmlFor={`travel-link-${item.id}`} className={labelCls}
                      style={{ color: BUILDER_UI.onSurfaceVar }}>
                      Google Maps Link <span className="normal-case tracking-normal font-normal">(optional)</span>
                    </label>
                    <Input
                      id={`travel-link-${item.id}`}
                      type="url"
                      value={item.mapUrl}
                      onChange={e => updateItem(item.id, "mapUrl", e.target.value)}
                      onBlur={() => checkItemLink(item)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="h-11 rounded-lg border-0 border-b-2"
                      style={{ ...fieldStyle, ...(itemErrors.mapUrl ? { borderColor: "#b3261e" } : {}) }}
                    />
                    {errorText(itemErrors.mapUrl) || (
                      <p className="text-xs mt-1.5" style={{ color: BUILDER_UI.onSurfaceVar }}>
                        In Google Maps, open the place, select Share, then copy and paste the link.
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor={`travel-desc-${item.id}`} className={labelCls}
                      style={{ color: BUILDER_UI.onSurfaceVar }}>
                      Description <span className="normal-case tracking-normal font-normal">(optional)</span>
                    </label>
                    <Textarea
                      id={`travel-desc-${item.id}`}
                      value={item.description}
                      onChange={e => updateItem(item.id, "description", e.target.value)}
                      placeholder="This is the closest hotel to our venue and where we recommend staying."
                      maxLength={300}
                      className="min-h-[80px] rounded-lg border-0 border-b-2 resize-none"
                      style={{ ...fieldStyle, color: BUILDER_UI.onSurface }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={addItem}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-widest"
          style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
          <Plus size={15} /> Add Place
        </button>
        <p className="text-xs mt-3" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Changes are saved when you click Save. Places with no details are removed on save.
        </p>
      </div>
    </div>
  );
};

// ── Center Panel: Date ────────────────────────────────────────────────────────
// The date and ceremony time come from Wedding Details (no duplicate inputs).
// Calendar View and Countdown are independent switches, both OFF by default,
// saved as dateShowCalendar / dateShowCountdown on the invitation doc.
const DATE_OPTIONS = [
  { field: "dateShowCalendar",  label: "Calendar View", desc: "Show a mini calendar with the date highlighted" },
  { field: "dateShowCountdown", label: "Countdown",     desc: "Show a live countdown to the wedding" },
];

const DatePanel = ({ invitation, settings, onChange }) => {
  const dateSettings = normalizeDateSettings(settings);
  const hasValidDate = parseWeddingDate(invitation?.weddingDate) !== null;

  return (
  <div className="space-y-6">
    <div className="p-5 rounded-lg" style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
      <div className="flex items-center gap-2 mb-2">
        <Info size={16} style={{ color: BUILDER_UI.primary }} />
        <p className="text-xs font-bold tracking-widest uppercase"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          From Wedding Details
        </p>
      </div>
      <p className="text-sm" style={{ color: BUILDER_UI.onSurface }}>
        The date on your invitation is pulled from your Wedding Details page.
        To change it, go to{" "}
        <Link to="/wedding-details" className="underline font-semibold"
          style={{ color: BUILDER_UI.primary }}>
          Wedding Details
        </Link>.
      </p>
      {!hasValidDate && (
        <p className="text-xs mt-3 flex items-center gap-1.5" role="status" style={{ color: ERROR_COLOR }}>
          <AlertCircle size={13} className="flex-shrink-0" />
          No wedding date set yet. The Wedding Day section will show a placeholder until you add one.
        </p>
      )}
    </div>

    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
        style={{ color: BUILDER_UI.onSurfaceVar }}>
        Display Options
      </h3>
      <p className="text-sm mb-4" style={{ color: BUILDER_UI.onSurfaceVar }}>
        Turn on either option, or both, to add a Wedding Day section to your invitation.
      </p>
      {DATE_OPTIONS.map(opt => {
        const on = dateSettings[opt.field];
        return (
          <div key={opt.field} className="flex items-center justify-between p-4 rounded-lg mb-2"
            style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
            <div>
              <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>{opt.label}</p>
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>{opt.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`Show ${opt.label}`}
              onClick={() => onChange(opt.field, !on)}
              className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{ backgroundColor: on ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
                style={{ transform: on ? "translateX(26px)" : "translateX(2px)" }} />
            </button>
          </div>
        );
      })}
    </div>
  </div>
  );
};

// ── Center Panel: Venue ───────────────────────────────────────────────────────
// The venue name, address and Google Maps link come from Wedding Details and
// are shown read-only here (no duplicate inputs). The switches only control
// how the venue appears on the invitation; they are saved as
// venueShowOnInvitation / venueShowMap / venueShowAddress / venueShowDirections
// (all ON by default so older invitations look the same — src/lib/venueDisplay.js).
const VENUE_OPTIONS = [
  { field: "venueShowMap",        label: "Map",            desc: "Show a map of the venue" },
  { field: "venueShowAddress",    label: "Address",        desc: "Show the venue's address" },
  { field: "venueShowDirections", label: "Get Directions", desc: "Show a button that opens Google Maps" },
];

const SettingSwitch = ({ label, desc, on, disabled = false, onToggle }) => (
  <div className="flex items-center justify-between p-4 rounded-lg mb-2"
    style={{ backgroundColor: BUILDER_UI.surfaceContainer, opacity: disabled ? 0.5 : 1 }}>
    <div>
      <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>{label}</p>
      <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>{desc}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Show ${label}`}
      disabled={disabled}
      onClick={onToggle}
      className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:cursor-not-allowed"
      style={{ backgroundColor: on ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
        style={{ transform: on ? "translateX(26px)" : "translateX(2px)" }} />
    </button>
  </div>
);

const VenuePanel = ({ invitation, settings, onChange }) => {
  const venue = normalizeVenueSettings(settings);
  const name    = invitation?.venueName?.trim() || "";
  const address = invitation?.venueAddress?.trim() || "";
  const mapsUrl = invitation?.venueURL?.trim() || "";
  const hasVenue = Boolean(name || address);

  const detailRow = (label, value) => (
    <div>
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: BUILDER_UI.onSurfaceVar }}>
        {label}
      </p>
      <p className="text-sm break-words" style={{ color: value ? BUILDER_UI.onSurface : BUILDER_UI.onSurfaceVar }}>
        {value || "Not set"}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-lg" style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} style={{ color: BUILDER_UI.primary }} />
          <p className="text-xs font-bold tracking-widest uppercase"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            From Wedding Details
          </p>
        </div>
        <p className="text-sm mb-4" style={{ color: BUILDER_UI.onSurface }}>
          Your venue is pulled from your Wedding Details page.
          To change it, go to{" "}
          <Link to="/wedding-details" className="underline font-semibold"
            style={{ color: BUILDER_UI.primary }}>
            Wedding Details
          </Link>.
        </p>
        <div className="space-y-3" data-testid="venue-details">
          {detailRow("Venue", name)}
          {detailRow("Address", address)}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Google Maps
            </p>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm inline-flex items-center gap-1 underline break-all"
                style={{ color: BUILDER_UI.primary }}>
                Open in Google Maps <ExternalLink size={12} />
              </a>
            ) : (
              <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>
                {hasVenue ? "Directions will search Google Maps for the address." : "Not set"}
              </p>
            )}
          </div>
        </div>
        {!hasVenue && (
          <p className="text-xs mt-3 flex items-center gap-1.5" role="status" style={{ color: ERROR_COLOR }}>
            <AlertCircle size={13} className="flex-shrink-0" />
            No venue set yet. The Venue section will show a placeholder until you add one.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          Display Options
        </h3>
        <p className="text-sm mb-4" style={{ color: BUILDER_UI.onSurfaceVar }}>
          Choose which venue details guests see on your invitation.
        </p>
        <SettingSwitch
          label="Venue Section"
          desc="Show your venue on the invitation"
          on={venue.venueShowOnInvitation}
          onToggle={() => onChange("venueShowOnInvitation", !venue.venueShowOnInvitation)}
        />
        <div className="pl-4">
          {VENUE_OPTIONS.map(opt => (
            <SettingSwitch key={opt.field}
              label={opt.label}
              desc={opt.desc}
              on={venue[opt.field]}
              disabled={!venue.venueShowOnInvitation}
              onToggle={() => onChange(opt.field, !venue[opt.field])}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Phone Preview ─────────────────────────────────────────────────────────────
// Renders a live phone mockup showing the invitation with current settings.
// `hero` and `storyBlocks` are the builder's local (possibly unsaved) state, so
// photo and Story edits show up here before they are saved.
// Colors and fonts come from the Color Theme settings (resolveInvitationTheme):
// each section uses its own background or the main one. CANVAS is only used
// for neutral photo placeholders, card borders and the preview's own overlay.
const PhonePreview = ({ invitation, settings, hero, storyBlocks = [] }) => {
  const theme        = resolveInvitationTheme(settings);
  const sec          = theme.sections;
  const heroUrl      = photoSrc(hero);
  // Builder preview: show the section as soon as a block exists (empty photo
  // slots render as placeholders) unless the couple hid it.
  const showStory    = settings.storyShowOnInvitation !== false && storyBlocks.length > 0;

  // Invitation buttons: same pill shape, size and label as before, now solid
  // so the white label stays readable (the old 70% opacity fell below 4.5:1).
  const btnStyle = { backgroundColor: theme.button, color: theme.buttonLabel };

  const groomFirst = invitation?.groomName?.first || "Groom";
  const brideFirst = invitation?.brideName?.first || "Bride";
  const venueQuery = buildMapQuery(invitation?.venueName, invitation?.venueAddress);
  // Venue tab switches (all ON for older invitations)
  const venueDisplay = getVenueDisplay(settings);

  const formattedDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "Wedding Date";

  return (
    // Phone frame — dark body with rounded corners
    <div className="relative w-[300px] h-[600px] rounded-[3rem] p-3 shadow-2xl border-4 flex-shrink-0"
      style={{ backgroundColor: "#1a1c19", borderColor: "#2f312e" }}>

      {/* Speaker slit — subtle centered bar in the top bezel */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full z-20"
        style={{ backgroundColor: "#3a3d3a" }} />

      {/* Screen */}
      <div className="w-full h-full rounded-[2.5rem] overflow-hidden" data-testid="invitation-preview"
        style={{ backgroundColor: theme.background, fontFamily: theme.bodyFont, color: theme.bodyText }}>
        <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Hero header */}
          <div className="p-6 text-center" data-section="header" style={{ backgroundColor: sec.header }}>
            <p className="text-[9px] uppercase tracking-widest mb-1"
              style={{ color: theme.bodyText }}>
              {settings.greetingTitle || "Together with their families"}
            </p>
            <h1 className="text-2xl mb-1"
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              {groomFirst} & {brideFirst}
            </h1>
            <p className="text-[9px] uppercase tracking-widest"
              style={{ color: theme.bodyText }}>
              {formattedDate}
              {venueDisplay.section && invitation?.venueName && ` · ${invitation.venueName}`}
            </p>
          </div>

          {/* Hero image — fills the frame using the couple's position/zoom
              (same style as the editor); placeholder until one is added */}
          <div className="relative w-full h-48 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: CANVAS.surfaceHigh }}>
            {heroUrl ? (
              <img src={heroUrl} alt="Hero" decoding="async" draggable={false}
                className="absolute inset-0 w-full h-full" style={photoImageStyle(hero)} />
            ) : (
              <div className="text-center">
                <Image size={28} style={{ color: CANVAS.outline, margin: "0 auto 8px" }} />
                <p className="text-[9px]" style={{ color: CANVAS.outline }}>Hero Photo</p>
              </div>
            )}
            {/* RSVP overlay button */}
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <button className="w-full py-2 rounded-full text-white text-[9px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${theme.button}cc`, color: theme.buttonLabel }}>
                RSVP
              </button>
            </div>
          </div>

          {/* Greetings */}
          <div className="p-8 text-center" data-section="greetings" style={{ backgroundColor: sec.greetings }}>
            <h2 className="text-base mb-3"
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              Greetings
            </h2>
            <p className="text-[9px] leading-relaxed" style={{ color: theme.bodyText }}>
              {settings.greetingMessage ||
                "The stars aligned when we met, and now we're getting married! Your presence at our wedding would make our special day even more memorable."}
            </p>
          </div>

          {/* Our Story — after Greetings, before Wedding Day */}
          {showStory && (
            <StorySection
              title={settings.storyTitle}
              blocks={storyBlocks}
              headingFont={theme.headingFont}
              bodyFont={theme.bodyFont}
              accentColor={theme.secondary}
              backgroundColor={sec.story}
              textColor={theme.headingText}
              mutedColor={theme.bodyText}
              showPlaceholders
            />
          )}

          {/* Music player — only shown once a real Spotify song is selected
              AND the host has "Show music on invitation" enabled. No fake
              placeholder song info is ever displayed. */}
          {settings.musicTrackId && settings.musicShowOnInvitation && (
            <div className="p-6 text-center" data-section="music" style={{ backgroundColor: sec.music }}>
              <h2 className="text-base mb-4"
                style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
                Music
              </h2>
              <iframe
                title="Spotify song"
                src={`https://open.spotify.com/embed/track/${settings.musicTrackId}`}
                width="100%"
                height="80"
                style={{ borderRadius: "12px", border: "none" }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          )}

          {/* Wedding Day — only when Calendar View and/or Countdown is on (Date tab).
              The hero date above is always shown regardless of these settings. */}
          {shouldShowWeddingDaySection(settings) && (
            <WeddingDaySection invitation={invitation} settings={settings}
              theme={theme} backgroundColor={sec.date} />
          )}

          {/* Venue — name/address/link from Wedding Details; which parts show
              is controlled by the Venue tab (src/lib/venueDisplay.js) */}
          {venueDisplay.section && (
            <div className="p-6 text-center" data-section="venue" style={{ backgroundColor: sec.venue }}>
              <h2 className="text-base mb-4"
                style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
                Wedding Venue
              </h2>
              {venueDisplay.map && (
                <div className="mb-3" data-testid="venue-map">
                  <GoogleMapEmbed query={venueQuery} heightClass="h-28" interactive={false}
                    title="Venue map preview" />
                </div>
              )}
              <p className="text-[10px] font-bold" style={{ color: theme.headingText }}>
                {invitation?.venueName || "Venue Name"}
              </p>
              {venueDisplay.address && (
                <p className="text-[9px]" data-testid="venue-address" style={{ color: theme.bodyText }}>
                  {invitation?.venueAddress || "Venue Address"}
                </p>
              )}
              {venueDisplay.directions && (venueQuery ? (
                <a
                  href={invitation?.venueURL || mapLinkUrl(venueQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full mt-3 py-2 rounded-full text-white text-[9px] font-bold"
                  style={btnStyle}
                >
                  Get directions
                </a>
              ) : (
                <button className="w-full mt-3 py-2 rounded-full text-white text-[9px] font-bold"
                  style={btnStyle}>
                  Get directions
                </button>
              ))}
            </div>
          )}

          {/* Travel & Stay — only when the toggle is on AND at least one place
              has a name. Links are re-checked so only http(s) URLs render. */}
          {shouldShowTravelSection(settings) && (
            <div className="p-6" data-section="travel" style={{ backgroundColor: sec.travel }}>
              <h2 className="text-base mb-2 text-center"
                style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
                Travel &amp; Stay
              </h2>
              {settings.travelMessage?.trim() && (
                <p className="text-[9px] leading-relaxed text-center mb-4" style={{ color: theme.bodyText }}>
                  {settings.travelMessage.trim()}
                </p>
              )}
              <div className="space-y-3">
                {getVisibleTravelItems(settings.travelItems).map(item => (
                  <div key={item.id} className="rounded-xl p-3 text-left"
                    style={{ border: `1px solid ${CANVAS.outline}` }}>
                    <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5"
                      style={{ color: theme.button }}>
                      {getTravelCategoryLabel(item.category)}
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: theme.headingText }}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-[9px] leading-relaxed mt-1" style={{ color: theme.bodyText }}>
                        {item.description}
                      </p>
                    )}
                    {item.mapUrl && (
                      <a
                        href={item.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold"
                        style={{ color: theme.button }}
                      >
                        View on Google Maps <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RSVP section */}
          <div className="p-6 text-center" data-section="rsvp" style={{ backgroundColor: sec.rsvp }}>
            <h2 className="text-base mb-4"
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              RSVP
            </h2>
            <p className="text-[9px] mb-4" style={{ color: theme.bodyText }}>
              {settings.inviteDeadline
                ? `Kindly reply by ${new Date(settings.inviteDeadline + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                : "Kindly reply at your earliest convenience"}
            </p>
            <button className="w-full py-2 rounded-full text-white text-[9px] font-bold"
              style={btnStyle}>
              RSVP Now
            </button>
          </div>

          {/* Closure */}
          <div className="p-10 text-center" data-section="closure" style={{ backgroundColor: sec.closure }}>
            <h2 className="text-base mb-3"
              style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
              {settings.closureTitle || "We can't wait to celebrate with you"}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="h-px w-10" style={{ backgroundColor: theme.accent }} />
              <Heart size={12} style={{ color: theme.primary }} />
              <div className="h-px w-10" style={{ backgroundColor: theme.accent }} />
            </div>
          </div>

        </div>

        {/* Floating vellum overlay — zoom/rotate controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80%] p-3 rounded-xl flex justify-between items-center z-30"
          style={{ backdropFilter: "blur(20px)", backgroundColor: "rgba(227,227,222,0.7)" }}>
          <Eye size={16} style={{ color: theme.primary }} />
          <div className="flex gap-3">
            <span className="text-[10px] font-bold" style={{ color: CANVAS.onSurfaceVar }}>Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main CreateInvitation Component ───────────────────────────────────────────
const CreateInvitation = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [invitation, setInvitation]     = useState(null);  // from Firestore
  const [weddingId, setWeddingId]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  // ?section=travel (e.g. from the dashboard sidebar) opens that section
  // directly; anything unknown falls back to the default "greetings" section.
  // ?section=color / ?section=font (the former tabs) open Color Theme.
  const [searchParams] = useSearchParams();
  const rawSection = searchParams.get("section");
  const requestedSection = SECTION_ALIASES[rawSection] || rawSection;
  const [activeSection, setActiveSection] = useState(
    SECTIONS.some(s => s.id === requestedSection) ? requestedSection : "greetings"
  );

  // Settings state — these are the invitation customization options
  // They are saved back to the `invitations` Firestore doc on Save/Publish
  const [settings, setSettings] = useState({
    // Color Theme: colorPalette1/2 (primary/secondary), font1/2 (heading/body)
    // plus background, button, accent, text colors and section backgrounds.
    // Garden + Classic until the saved invitation loads.
    ...DEFAULT_THEME_SETTINGS,
    // layoutStyle was removed with the Layout tab. Existing invitation docs keep
    // their stored value untouched (updateDoc never deletes unlisted fields).
    greetingTitle:    "",
    greetingMessage:  "",
    musicTrackId:          "",
    musicSpotifyUrl:       "",
    musicShowOnInvitation: true,
    isPublished:      false,
    inviteDeadline:   "",
    closureTitle:     "",
    mealOptions:      [], // [{ id, name, description }] — filled from Firestore on load
    // Travel & Stay — filled from Firestore on load
    travelItems:            [], // [{ id, category, name, mapUrl, description }]
    travelMessage:          "",
    travelShowOnInvitation: true,
    // Our Story section settings (the blocks live in useInvitationMedia)
    storyTitle:             DEFAULT_STORY_TITLE,
    storyShowOnInvitation:  true,
    // Date tab: Calendar View / Countdown — both OFF by default
    ...DEFAULT_DATE_SETTINGS,
    // Venue tab: section / map / address / directions — all ON by default
    ...DEFAULT_VENUE_SETTINGS,
  });

  // True only once the saved invitation has been read successfully (or we
  // confirmed there isn't one yet). Until then mealOptions is NOT written on
  // save, so a failed load can never overwrite the host's saved meals with [].
  const [mealOptionsLoaded, setMealOptionsLoaded] = useState(false);
  // Per-place validation errors for Travel & Stay: { [itemId]: { name?, mapUrl? } }
  const [travelErrors, setTravelErrors] = useState({});

  // True only once the saved invitation was read successfully (or we confirmed
  // there isn't one yet). Until then the travel fields are NOT written on save,
  // so a failed load can never overwrite saved places with empty defaults.
  const [travelLoaded, setTravelLoaded] = useState(false);
  // Same guard for storyTitle / storyShowOnInvitation.
  const [storySettingsLoaded, setStorySettingsLoaded] = useState(false);
  // Same guard for the Color Theme fields (colors, fonts, section backgrounds).
  const [themeLoaded, setThemeLoaded] = useState(false);
  // Same guard for the Date tab's Calendar View / Countdown switches.
  const [dateSettingsLoaded, setDateSettingsLoaded] = useState(false);
  // Same guard for the Venue tab's display switches.
  const [venueSettingsLoaded, setVenueSettingsLoaded] = useState(false);
  // RSVP deadline validation message (RSVP tab), same rule as Wedding Details
  const [deadlineError, setDeadlineError] = useState("");

  // Notice shown when photos/Story couldn't be saved (local edits are kept)
  const [saveNotice, setSaveNotice] = useState(null); // { kind: "error" | "warning", text }

  // ── Hero Photo + Our Story state, loading and saving ───────────────────────
  // See src/hooks/useInvitationMedia.js — kept out of `settings` on purpose.
  const media = useInvitationMedia({ saving });

  // ── Load existing invitation data on mount ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const inv = await getInvitationByUser(user.uid);
        if (inv) {
          setInvitation(inv);
          setWeddingId(inv.weddingId);
          // Pre-fill settings from saved invitation
          setSettings(prev => ({
            ...prev,
            // Color Theme — older invitations only have colorPalette1/2 and
            // font1/2 (or nothing); every missing setting gets a default.
            ...normalizeThemeSettings(inv),
            greetingMessage: inv.greetingMessage || prev.greetingMessage,
            greetingTitle:   inv.greetingTitle   || prev.greetingTitle,
            inviteDeadline:  inv.inviteDeadline  || prev.inviteDeadline,
            musicTrackId:          inv.musicTrackId          || prev.musicTrackId,
            musicSpotifyUrl:       inv.musicSpotifyUrl       || prev.musicSpotifyUrl,
            musicShowOnInvitation: inv.musicShowOnInvitation ?? prev.musicShowOnInvitation,
            isPublished:     inv.isPublished     || false,
            // Older invitations have no mealOptions → [] (no meal choice)
            mealOptions:     normalizeMealOptions(inv.mealOptions),
            // Older invitations have no travel fields → [], "", true
            travelItems:            normalizeTravelItems(inv.travelItems),
            travelMessage:          typeof inv.travelMessage === "string" ? inv.travelMessage : "",
            travelShowOnInvitation: getTravelShowOnInvitation(inv),
            // Older invitations have no story fields → "Our Story", shown
            storyTitle: typeof inv.storyTitle === "string" && inv.storyTitle.trim()
              ? inv.storyTitle : DEFAULT_STORY_TITLE,
            storyShowOnInvitation: inv.storyShowOnInvitation !== false,
            // Older invitations have no date settings → both OFF
            ...normalizeDateSettings(inv),
            // Older invitations have no venue settings → everything shown
            ...normalizeVenueSettings(inv),
          }));
        }
        // Hero Photo + Story entries (older invitations have neither)
        media.initFromInvitation(inv);
        setMealOptionsLoaded(true);
        setTravelLoaded(true);
        setStorySettingsLoaded(true);
        setThemeLoaded(true);
        setDateSettingsLoaded(true);
        setVenueSettingsLoaded(true);
      } catch (err) {
        console.error("Load invitation error:", err);
        media.markLoadFailed();
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Load the invitation's Google Fonts (preview) + the builder's own font ──
  useGoogleFonts([settings.font1, settings.font2, "DM Sans"]);

  // ── Update a single settings field ────────────────────────────────────────
  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // ── Update several settings fields at once (theme presets, reset) ─────────
  const handleApply = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = async (publish = false) => {
    if (!user) return;

    // Travel & Stay: block the save if a place is missing its name or has an
    // unsafe link, and jump to that section so the host can fix it.
    const travelValidation = validateTravelItems(settings.travelItems);
    if (Object.keys(travelValidation).length > 0) {
      setTravelErrors(travelValidation);
      setActiveSection("travel");
      alert("Please fix the highlighted Travel & Stay places before saving.");
      return;
    }

    // RSVP deadline: same rule as Wedding Details (on or before the wedding
    // date). A deadline that was already saved can't be cleared here (Wedding
    // Details requires one); invitations that never had one still save.
    const deadlineProblem = getInviteDeadlineError(
      settings.inviteDeadline, invitation?.weddingDate,
      { required: Boolean(invitation?.inviteDeadline) },
    );
    if (deadlineProblem) {
      setDeadlineError(deadlineProblem);
      setActiveSection("rsvp");
      alert("Please fix the RSVP deadline before saving.");
      return;
    }

    setSaveNotice(null);
    setSaving(true);
    try {
      const dataToSave = {
        ...settings,
        isPublished: publish ? true : settings.isPublished,
        groomName:    invitation?.groomName    || { first: "", middle: "", last: "" },
        brideName:    invitation?.brideName    || { first: "", middle: "", last: "" },
        weddingDate:  invitation?.weddingDate  || "",
        ceremonyTime: invitation?.ceremonyTime || "",
        venueName:    invitation?.venueName    || "",
        venueAddress: invitation?.venueAddress || "",
      };

      // Meal options: trim, drop unnamed rows. Skip the field entirely if the
      // saved invitation never loaded, so stored meals can't be wiped.
      const cleanedMealOptions = cleanMealOptionsForSave(settings.mealOptions);
      if (mealOptionsLoaded) {
        dataToSave.mealOptions = cleanedMealOptions;
      } else {
        delete dataToSave.mealOptions;
      }
      
      // Travel & Stay: trimmed, empty places dropped. Skipped entirely if the
      // saved invitation never loaded, so stored places can't be wiped.
      const cleanedTravelItems = cleanTravelItemsForSave(settings.travelItems);
      if (travelLoaded) {
        dataToSave.travelItems = cleanedTravelItems;
        dataToSave.travelMessage = (settings.travelMessage || "").trim();
        dataToSave.travelShowOnInvitation = getTravelShowOnInvitation(settings);
      } else {
        delete dataToSave.travelItems;
        delete dataToSave.travelMessage;
        delete dataToSave.travelShowOnInvitation;
      }

      // Color Theme — cleaned (valid hex, known fonts/sections) and only
      // written after a successful load, so stored colors can't be wiped.
      if (themeLoaded) {
        Object.assign(dataToSave, normalizeThemeSettings(settings));
      } else {
        THEME_FIELDS.forEach(field => delete dataToSave[field]);
      }

      // Our Story section settings — same "only after a successful load" guard.
      if (storySettingsLoaded) {
        dataToSave.storyTitle = normalizeStoryTitle(settings.storyTitle);
        dataToSave.storyShowOnInvitation = settings.storyShowOnInvitation !== false;
      } else {
        delete dataToSave.storyTitle;
        delete dataToSave.storyShowOnInvitation;
      }

      // Date tab switches — strict booleans, same "only after a successful load" guard.
      if (dateSettingsLoaded) {
        Object.assign(dataToSave, normalizeDateSettings(settings));
      } else {
        DATE_SETTING_FIELDS.forEach(field => delete dataToSave[field]);
      }

      // Venue tab switches — strict booleans, same "only after a successful load" guard.
      if (venueSettingsLoaded) {
        Object.assign(dataToSave, normalizeVenueSettings(settings));
      } else {
        VENUE_SETTING_FIELDS.forEach(field => delete dataToSave[field]);
      }

      const id = await saveInvitation(user.uid, dataToSave, weddingId);
      if (travelLoaded) setSettings(prev => ({ ...prev, travelItems: cleanedTravelItems }));
      if (!weddingId) setWeddingId(id);
      if (publish) setSettings(prev => ({ ...prev, isPublished: true }));
      if (mealOptionsLoaded) setSettings(prev => ({ ...prev, mealOptions: cleanedMealOptions }));
      if (storySettingsLoaded) setSettings(prev => ({ ...prev, storyTitle: dataToSave.storyTitle }));

      // Photos + Story: uploads happen here, on Save.
      const mediaResult = await media.save(id);
      if (!mediaResult.ok) {
        setSaveNotice(mediaResult.notice);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Save error:", err);
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render the active section's center panel ───────────────────────────────
  const renderPanel = () => {
    switch (activeSection) {
      case "theme":     return <ColorThemePanel settings={settings} onChange={handleChange} onApply={handleApply} />;
      case "music":     return <MusicPanel     settings={settings} onChange={handleChange} />;
      case "greetings": return <GreetingsPanel settings={settings} onChange={handleChange}
                                 hero={media.hero} onHeroChange={media.setHeroPhoto} saving={saving}
                                 heroProgress={media.hero?.pending ? media.uploadProgress?.byKey?.[media.hero.localId] : undefined} />;
      case "story":     return <StoryPanel     settings={settings} onSettingChange={handleChange}
                                 blocks={media.storyBlocks} setBlocks={media.setStoryBlocks}
                                 status={media.storyStatus} loadedCount={media.storyLoadedCount}
                                 onRetryLoad={media.retryLoad}
                                 mediaBytes={media.mediaBytes} progressByKey={media.uploadProgress?.byKey}
                                 disabled={saving} />;
      case "rsvp":      return <RsvpPanel      invitation={invitation} settings={settings} onChange={handleChange}
                                 deadlineError={deadlineError} onDeadlineErrorClear={() => setDeadlineError("")} />;
      case "venue":     return <VenuePanel     invitation={invitation} settings={settings} onChange={handleChange} />;
      case "date":      return <DatePanel      invitation={invitation} settings={settings} onChange={handleChange} />;
      case "travel":    return <TravelPanel    settings={settings} onChange={handleChange}
                                 errors={travelErrors} setErrors={setTravelErrors} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Sparkles size={32} className="mb-3" style={{ color: BUILDER_UI.outline }} />
            <p className="font-bold" style={{ color: BUILDER_UI.onSurface }}>
              {SECTIONS.find(s => s.id === activeSection)?.label} settings
            </p>
            <p className="text-sm mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Coming soon
            </p>
          </div>
        );
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BUILDER_UI.surface }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: BUILDER_UI.primary }} />
          <p className="text-sm" style={{ color: BUILDER_UI.onSurfaceVar }}>Loading your invitation...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: BUILDER_UI.surface, fontFamily: BUILDER_FONT }}>

      {/* ── Top App Bar — ToGather style ── */}
      <header className="w-full flex-shrink-0 sticky top-0 z-50 flex justify-between items-center px-8 h-16 border-b"
        style={{ backgroundColor: BUILDER_UI.surface, borderColor: BUILDER_UI.outline }}>
        <div className="flex items-center gap-6">
          {/* Back to dashboard */}
          <Link to="/dashboard"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: BUILDER_UI.onSurfaceVar }}>
            <ArrowLeft size={16} />
            Dashboard
          </Link>

          <div className="h-5 w-px" style={{ backgroundColor: BUILDER_UI.outline }} />

          {/* Branding */}
          <span className="font-heading text-xl font-semibold" style={{ color: BUILDER_UI.primary }}>
            ToGather
          </span>

          {/* Section tabs */}
          <nav className="hidden md:flex gap-6">
            {["Preview", "Share", "Settings"].map(tab => (
              <a key={tab} href="#"
                className="font-heading italic text-lg tracking-tight transition-colors"
                style={{ color: tab === "Settings" ? BUILDER_UI.primary : `${BUILDER_UI.primary}60` }}>
                {tab}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Draft saved indicator */}
          {saved && (
            <span className="text-xs font-semibold" style={{ color: BUILDER_UI.primary }}>
              Saved ✓
            </span>
          )}

          {/* Save button */}
          <button onClick={() => handleSave(false)}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold transition-colors hover:opacity-80 flex items-center gap-2"
            style={{ color: BUILDER_UI.primary }}>
            {saving
              ? <><Loader2 size={14} className="animate-spin" />
                  {media.uploadProgress && media.uploadProgress.total > 0
                    ? `Uploading ${Math.min(media.uploadProgress.done + 1, media.uploadProgress.total)}/${media.uploadProgress.total} · ${media.uploadProgress.percent}%`
                    : "Saving..."}</>
              : <><Save size={14} /> Save</>}
          </button>

          {/* Publish button */}
          <button onClick={() => handleSave(true)}
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${BUILDER_UI.primary} 0%, ${BUILDER_UI.primaryLight} 100%)`,
            }}>
            {settings.isPublished ? "Published ✓" : "Publish"}
          </button>
        </div>
      </header>

      {/* ── Main Layout: Sidebar + Panel + Preview ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar — section navigation */}
        <aside className="w-64 flex-shrink-0 flex flex-col py-6 overflow-y-auto border-r"
          style={{
            backgroundColor: BUILDER_UI.sidebar,
            borderColor: BUILDER_UI.outline,
            height: "calc(100vh - 4rem)",
            position: "sticky",
            top: "4rem",
          }}>

          {/* Project info */}
          <div className="px-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${BUILDER_UI.primary}20` }}>
                <Sparkles size={16} style={{ color: BUILDER_UI.primary }} />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: BUILDER_UI.onSurface }}>
                  Invitation Builder
                </p>
                <p className="text-[9px] uppercase tracking-tight"
                  style={{ color: `${BUILDER_UI.onSurfaceVar}70` }}>
                  {invitation?.groomName?.first && invitation?.brideName?.first
                    ? `${invitation.groomName.first} & ${invitation.brideName.first}`
                    : "Your Wedding"}
                </p>
              </div>
            </div>
          </div>

          {/* Section nav */}
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map(sec => {
              const Icon    = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className="px-6 py-3 flex items-center gap-3 text-left transition-all text-xs font-bold tracking-widest uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5F47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EAE5]"
                  style={{
                    backgroundColor: isActive ? BUILDER_UI.selected : "transparent",
                    color: isActive ? BUILDER_UI.primary : `${BUILDER_UI.primary}50`,
                    borderRadius: isActive ? "0 2rem 2rem 0" : undefined,
                    marginLeft: isActive ? "1rem" : undefined,
                    paddingLeft: isActive ? "1rem" : undefined,
                  }}>
                  <Icon size={16} />
                  {sec.label}
                  {isActive && <ChevronRight size={12} className="ml-auto" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center workspace — active section controls */}
        <main className="flex-1 overflow-y-auto p-10"
          style={{ backgroundColor: BUILDER_UI.surface }}>
          <div className="max-w-2xl mx-auto">

            {/* Save problems (photos/Story) — local edits are kept */}
            {saveNotice && (
              <div role="alert" className="mb-6 flex items-start gap-3 p-4 rounded-lg text-sm"
                style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0"
                  style={{ color: saveNotice.kind === "error" ? ERROR_COLOR : BUILDER_UI.primary }} />
                <p className="flex-1">{saveNotice.text}</p>
                <button type="button" onClick={() => setSaveNotice(null)} aria-label="Dismiss message"
                  className="flex-shrink-0 hover:opacity-70" style={{ color: BUILDER_UI.onSurfaceVar }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Section header */}
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-semibold mb-1"
                  style={{ color: BUILDER_UI.onSurface }}>
                  {SECTIONS.find(s => s.id === activeSection)?.label || "Settings"}
                </h2>
                <p className="text-xs uppercase tracking-widest font-bold"
                  style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Configuration Panel
                </p>
              </div>
              {saved && (
                <span className="text-xs font-bold" style={{ color: BUILDER_UI.primary }}>
                  Draft Saved ✓
                </span>
              )}
            </div>

            {/* Active panel content */}
            {renderPanel()}
          </div>
        </main>

        {/* Right side — phone preview. This surrounding "stage" area is builder
            chrome; the <PhonePreview> component itself keeps the invitation's
            own CANVAS / user-selected colors untouched. */}
        <aside className="w-[400px] flex-shrink-0 flex items-center justify-center border-l"
          style={{
            backgroundColor: BUILDER_UI.surface,
            borderColor: BUILDER_UI.outline,
            height: "calc(100vh - 4rem)",
            position: "sticky",
            top: "4rem",
          }}>
          <PhonePreview invitation={invitation} settings={settings} hero={media.hero} storyBlocks={media.storyBlocks} />
        </aside>

      </div>
    </div>
  );
};

export default CreateInvitation;
