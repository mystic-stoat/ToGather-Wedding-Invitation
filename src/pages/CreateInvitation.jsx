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
//   Left sidebar  → section navigation (Privacy, Color, Font, Music, Layout, etc.)
//   Center panel  → active section's controls/settings
//   Right panel   → live phone mockup preview showing real wedding data
//
// DATA FLOW:
//   1. Loads existing invitation from Firestore (couple names, date, venue)
//   2. Loads/saves invitation customization settings to Firestore
//   3. All preview updates happen locally — only saved on "Save" or "Publish"
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart, Lock, Palette, Type, Music, Sparkles, LayoutDashboard,
  BookOpen, Calendar, Image, MapPin, BookHeart, CheckSquare,
  BookMarked, ArrowLeft, Save, Globe, Upload, ChevronRight,
  Eye, Volume2, Pause, Play, Info, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser, saveInvitation } from "@/lib/firestore";

// ── Stitch-inspired color palette for the invitation canvas ───────────────────
// These are kept separate from the ToGather design system tokens
// so the builder feels like a distinct creative tool
const CANVAS = {
  primary:        "#56642b",   // olive green — main accent
  primaryLight:   "#8a9a5b",   // sage — secondary
  primaryFixed:   "#d9eaa3",   // light green — hover/selected
  surface:        "#fafaf5",   // warm off-white — backgrounds
  surfaceContainer: "#eeeee9", // slightly darker — cards
  surfaceHigh:    "#e8e8e3",   // even darker — borders
  onSurface:      "#1a1c19",   // near-black text
  onSurfaceVar:   "#46483c",   // medium text
  outline:        "#76786b",   // borders
  secondary:      "#735c00",   // warm gold
  secondaryFixed: "#ffe088",   // light gold
};

// ── Section definitions — left sidebar nav ────────────────────────────────────
const SECTIONS = [
  { id: "privacy",   label: "Privacy",   icon: Lock },
  { id: "color",     label: "Color",     icon: Palette },
  { id: "font",      label: "Font",      icon: Type },
  { id: "music",     label: "Music",     icon: Music },
  { id: "animation", label: "Animation", icon: Sparkles },
  { id: "layout",    label: "Layout",    icon: LayoutDashboard },
  { id: "greetings", label: "Greetings", icon: BookOpen },
  { id: "date",      label: "Date",      icon: Calendar },
  { id: "gallery",   label: "Gallery",   icon: Image },
  { id: "venue",     label: "Venue",     icon: MapPin },
  { id: "story",     label: "Story",     icon: BookHeart },
  { id: "rsvp",      label: "RSVP",      icon: CheckSquare },
  { id: "guestbook", label: "Guestbook", icon: BookMarked },
];

// ── Color theme presets ───────────────────────────────────────────────────────
const COLOR_THEMES = [
  { name: "Garden",   primary: "#56642b", secondary: "#8a9a5b", bg: "#fafaf5" },
  { name: "Rose",     primary: "#9b3a5a", secondary: "#c97a95", bg: "#fdf5f7" },
  { name: "Navy",     primary: "#1e3a5f", secondary: "#4a7aa8", bg: "#f5f7fa" },
  { name: "Blush",    primary: "#c97a7a", secondary: "#e5aeae", bg: "#fdf8f8" },
  { name: "Sage",     primary: "#4a7a65", secondary: "#7aaa95", bg: "#f5faf7" },
  { name: "Burgundy", primary: "#6b2737", secondary: "#9b5a65", bg: "#faf5f6" },
];

// ── Font pairing presets ──────────────────────────────────────────────────────
const FONT_PAIRS = [
  { name: "Classic",    heading: "Playfair Display", body: "DM Sans" },
  { name: "Editorial",  heading: "Noto Serif",       body: "Manrope" },
  { name: "Modern",     heading: "Cormorant Garamond", body: "Lato" },
  { name: "Romantic",   heading: "Great Vibes",      body: "Nunito" },
  { name: "Timeless",   heading: "Libre Baskerville", body: "Source Sans 3" },
];

// ── Center Panel: Privacy ─────────────────────────────────────────────────────
const PrivacyPanel = ({ settings, onChange }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-1"
        style={{ color: CANVAS.onSurfaceVar }}>
        Visibility
      </h3>
      <p className="text-sm mb-6" style={{ color: CANVAS.onSurfaceVar }}>
        Control who can access your invitation link.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {["Public", "Private"].map(opt => (
          <button key={opt}
            onClick={() => onChange("privacy", opt.toLowerCase())}
            className="p-6 rounded-lg border-2 text-left transition-all"
            style={{
              backgroundColor: settings.privacy === opt.toLowerCase()
                ? CANVAS.primaryFixed : CANVAS.surfaceContainer,
              borderColor: settings.privacy === opt.toLowerCase()
                ? CANVAS.primary : "transparent",
              color: CANVAS.onSurface,
            }}>
            <div className="flex items-center gap-3 mb-3">
              {opt === "Public"
                ? <Globe size={20} style={{ color: CANVAS.primary }} />
                : <Lock size={20} style={{ color: CANVAS.primary }} />}
            </div>
            <p className="font-bold text-sm">{opt}</p>
            <p className="text-xs mt-1" style={{ color: CANVAS.onSurfaceVar }}>
              {opt === "Public"
                ? "Anyone with the link can view"
                : "Only invited guests can view"}
            </p>
          </button>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        RSVP Deadline
      </h3>
      <Input
        type="date"
        value={settings.inviteDeadline || ""}
        onChange={e => onChange("inviteDeadline", e.target.value)}
        className="h-12 rounded-lg border-0 border-b-2"
        style={{ borderColor: CANVAS.outline, backgroundColor: CANVAS.surfaceContainer }}
      />
      <p className="text-xs mt-2" style={{ color: CANVAS.onSurfaceVar }}>
        Guests cannot RSVP after this date.
      </p>
    </div>
  </div>
);

// ── Center Panel: Color ───────────────────────────────────────────────────────
const ColorPanel = ({ settings, onChange }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Theme Presets
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {COLOR_THEMES.map(theme => (
          <button key={theme.name}
            onClick={() => {
              onChange("colorPalette1", theme.primary);
              onChange("colorPalette2", theme.secondary);
            }}
            className="p-4 rounded-lg border-2 transition-all text-center"
            style={{
              backgroundColor: theme.bg,
              borderColor: settings.colorPalette1 === theme.primary
                ? CANVAS.primary : CANVAS.surfaceHigh,
            }}>
            <div className="flex justify-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-full"
                style={{ backgroundColor: theme.primary }} />
              <div className="w-5 h-5 rounded-full"
                style={{ backgroundColor: theme.secondary }} />
            </div>
            <p className="text-xs font-bold" style={{ color: CANVAS.onSurface }}>
              {theme.name}
            </p>
          </button>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Custom Colors
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold tracking-widest uppercase mb-2 block"
            style={{ color: CANVAS.onSurfaceVar }}>
            Primary
          </label>
          <div className="flex items-center gap-3">
            <input type="color" value={settings.colorPalette1 || "#56642b"}
              onChange={e => onChange("colorPalette1", e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 p-1"
              style={{ backgroundColor: CANVAS.surfaceContainer }} />
            <Input value={settings.colorPalette1 || "#56642b"}
              onChange={e => onChange("colorPalette1", e.target.value)}
              className="h-11 rounded-lg border-0 border-b-2 font-mono text-sm"
              style={{ borderColor: CANVAS.outline, backgroundColor: CANVAS.surfaceContainer }} />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold tracking-widest uppercase mb-2 block"
            style={{ color: CANVAS.onSurfaceVar }}>
            Secondary
          </label>
          <div className="flex items-center gap-3">
            <input type="color" value={settings.colorPalette2 || "#8a9a5b"}
              onChange={e => onChange("colorPalette2", e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 p-1"
              style={{ backgroundColor: CANVAS.surfaceContainer }} />
            <Input value={settings.colorPalette2 || "#8a9a5b"}
              onChange={e => onChange("colorPalette2", e.target.value)}
              className="h-11 rounded-lg border-0 border-b-2 font-mono text-sm"
              style={{ borderColor: CANVAS.outline, backgroundColor: CANVAS.surfaceContainer }} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Center Panel: Font ────────────────────────────────────────────────────────
const FontPanel = ({ settings, onChange }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Font Pairings
      </h3>
      <div className="space-y-3">
        {FONT_PAIRS.map(pair => (
          <button key={pair.name}
            onClick={() => {
              onChange("font1", pair.heading);
              onChange("font2", pair.body);
            }}
            className="w-full p-5 rounded-lg border-2 text-left transition-all"
            style={{
              backgroundColor: settings.font1 === pair.heading
                ? CANVAS.primaryFixed : CANVAS.surfaceContainer,
              borderColor: settings.font1 === pair.heading
                ? CANVAS.primary : "transparent",
            }}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold tracking-widest uppercase"
                style={{ color: CANVAS.onSurfaceVar }}>
                {pair.name}
              </p>
              {settings.font1 === pair.heading && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: CANVAS.primary }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>
            <p className="text-xl mb-1" style={{ fontFamily: pair.heading, color: CANVAS.onSurface }}>
              Sarah & Michael
            </p>
            <p className="text-xs" style={{ fontFamily: pair.body, color: CANVAS.onSurfaceVar }}>
              {pair.heading} / {pair.body}
            </p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ── Center Panel: Layout ──────────────────────────────────────────────────────
const LayoutPanel = ({ settings, onChange }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Layout Style
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {[
          { id: "poster",   label: "Poster",   desc: "Clean, high-impact with centralized typography" },
          { id: "editorial",label: "Editorial", desc: "Magazine-style with dynamic photo placement" },
        ].map(opt => (
          <button key={opt.id}
            onClick={() => onChange("layoutStyle", opt.id)}
            className="p-6 rounded-lg border-2 text-left transition-all"
            style={{
              backgroundColor: settings.layoutStyle === opt.id
                ? CANVAS.primaryFixed : CANVAS.surfaceContainer,
              borderColor: settings.layoutStyle === opt.id
                ? CANVAS.primary : "transparent",
              color: CANVAS.onSurface,
            }}>
            <LayoutDashboard size={24} className="mb-3"
              style={{ color: CANVAS.primary }} />
            <p className="font-bold text-sm mb-1">{opt.label}</p>
            <p className="text-xs" style={{ color: CANVAS.onSurfaceVar }}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Hero Image
      </h3>
      <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center text-center"
        style={{ borderColor: CANVAS.outline, backgroundColor: CANVAS.surfaceContainer }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: CANVAS.surfaceHigh }}>
          <Upload size={22} style={{ color: CANVAS.primary }} />
        </div>
        <p className="font-bold mb-1" style={{ color: CANVAS.onSurface }}>Upload Hero Image</p>
        <p className="text-xs mb-5" style={{ color: CANVAS.onSurfaceVar }}>
          High-resolution JPEG recommended
        </p>
        <button className="px-8 py-2 text-sm font-bold uppercase tracking-widest"
          style={{ backgroundColor: CANVAS.onSurface, color: CANVAS.surface }}>
          Select File
        </button>
      </div>
    </div>
  </div>
);

// ── Center Panel: Greetings ───────────────────────────────────────────────────
const GreetingsPanel = ({ settings, onChange }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Invitation Title
      </h3>
      <Input
        value={settings.greetingTitle || ""}
        onChange={e => onChange("greetingTitle", e.target.value)}
        placeholder="Together with their families..."
        className="h-12 rounded-lg border-0 border-b-2 italic"
        style={{
          borderColor: CANVAS.outline,
          backgroundColor: CANVAS.surfaceContainer,
          fontFamily: settings.font1 || "Playfair Display",
          fontSize: "1.1rem",
        }}
      />
    </div>
    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Welcome Message
      </h3>
      <Textarea
        value={settings.greetingMessage || ""}
        onChange={e => onChange("greetingMessage", e.target.value)}
        placeholder="The stars aligned when we met, and now we're getting married! Your presence at our wedding would make our special day even more memorable."
        className="min-h-[140px] rounded-lg border-0 border-b-2 resize-none"
        style={{
          borderColor: CANVAS.outline,
          backgroundColor: CANVAS.surfaceContainer,
          color: CANVAS.onSurface,
        }}
      />
      <p className="text-xs mt-2 text-right" style={{ color: CANVAS.onSurfaceVar }}>
        {(settings.greetingMessage || "").length}/300
      </p>
    </div>
  </div>
);

// ── Center Panel: Music ───────────────────────────────────────────────────────
const MusicPanel = ({ settings, onChange }) => {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: CANVAS.onSurfaceVar }}>
          Background Music
        </h3>
        <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center text-center"
          style={{ borderColor: CANVAS.outline, backgroundColor: CANVAS.surfaceContainer }}>
          <Music size={28} className="mb-3" style={{ color: CANVAS.primary }} />
          <p className="font-bold mb-1" style={{ color: CANVAS.onSurface }}>Upload Music</p>
          <p className="text-xs mb-4" style={{ color: CANVAS.onSurfaceVar }}>MP3 or WAV, max 10MB</p>
          <button className="px-6 py-2 text-sm font-bold uppercase tracking-widest"
            style={{ backgroundColor: CANVAS.onSurface, color: CANVAS.surface }}>
            Select File
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: CANVAS.onSurfaceVar }}>
          Playback Settings
        </h3>
        <div className="p-4 rounded-lg flex items-center gap-4"
          style={{ backgroundColor: CANVAS.surfaceContainer }}>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: CANVAS.surfaceHigh }}>
            <Music size={20} style={{ color: CANVAS.primary }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: CANVAS.onSurface }}>
              {settings.musicTitle || "No song selected"}
            </p>
            <p className="text-xs" style={{ color: CANVAS.onSurfaceVar }}>
              {settings.musicArtist || "Upload a song above"}
            </p>
          </div>
          <button onClick={() => setPlaying(!playing)}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: CANVAS.primary }}>
            {playing
              ? <Pause size={18} className="text-white" />
              : <Play size={18} className="text-white" />}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest uppercase"
            style={{ color: CANVAS.onSurfaceVar }}>
            Auto-play
          </span>
          <button
            onClick={() => onChange("musicAutoplay", !settings.musicAutoplay)}
            className="w-12 h-6 rounded-full transition-colors relative"
            style={{ backgroundColor: settings.musicAutoplay ? CANVAS.primary : CANVAS.surfaceHigh }}>
            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
              style={{ transform: settings.musicAutoplay ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Center Panel: Date ────────────────────────────────────────────────────────
const DatePanel = ({ invitation }) => (
  <div className="space-y-6">
    <div className="p-5 rounded-lg" style={{ backgroundColor: CANVAS.surfaceContainer }}>
      <div className="flex items-center gap-2 mb-2">
        <Info size={16} style={{ color: CANVAS.primary }} />
        <p className="text-xs font-bold tracking-widest uppercase"
          style={{ color: CANVAS.onSurfaceVar }}>
          From Wedding Details
        </p>
      </div>
      <p className="text-sm" style={{ color: CANVAS.onSurface }}>
        The date on your invitation is pulled from your Wedding Details page.
        To change it, go to{" "}
        <Link to="/wedding-details" className="underline font-semibold"
          style={{ color: CANVAS.primary }}>
          Wedding Details
        </Link>.
      </p>
    </div>

    <div>
      <h3 className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: CANVAS.onSurfaceVar }}>
        Display Options
      </h3>
      {[
        { id: "calendar", label: "Calendar View", desc: "Show a mini calendar with the date highlighted" },
        { id: "text",     label: "Text View",     desc: "Show date as elegant text" },
        { id: "countdown",label: "Countdown",     desc: "Show a countdown timer to the wedding" },
      ].map(opt => (
        <div key={opt.id} className="flex items-center justify-between p-4 rounded-lg mb-2"
          style={{ backgroundColor: CANVAS.surfaceContainer }}>
          <div>
            <p className="text-sm font-bold" style={{ color: CANVAS.onSurface }}>{opt.label}</p>
            <p className="text-xs" style={{ color: CANVAS.onSurfaceVar }}>{opt.desc}</p>
          </div>
          <div className="w-5 h-5 rounded border-2"
            style={{ borderColor: CANVAS.primary, backgroundColor: CANVAS.primaryFixed }} />
        </div>
      ))}
    </div>
  </div>
);

// ── Phone Preview ─────────────────────────────────────────────────────────────
// Renders a live phone mockup showing the invitation with current settings
const PhonePreview = ({ invitation, settings }) => {
  const primaryColor = settings.colorPalette1 || CANVAS.primary;
  const headingFont  = settings.font1 || "Playfair Display";

  const groomFirst = invitation?.groomName?.first || "Groom";
  const brideFirst = invitation?.brideName?.first || "Bride";

  const formattedDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "Wedding Date";

  return (
    // Phone frame — dark body with rounded corners
    <div className="relative w-[300px] h-[600px] rounded-[3rem] p-3 shadow-2xl border-4 flex-shrink-0"
      style={{ backgroundColor: "#1a1c19", borderColor: "#2f312e" }}>

      {/* iPhone notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-2xl z-20"
        style={{ backgroundColor: "#1a1c19" }} />

      {/* Screen */}
      <div className="w-full h-full rounded-[2.5rem] overflow-hidden"
        style={{ backgroundColor: CANVAS.surface }}>
        <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Hero header */}
          <div className="p-6 text-center" style={{ backgroundColor: CANVAS.surface }}>
            <p className="text-[9px] uppercase tracking-widest mb-1"
              style={{ color: CANVAS.onSurfaceVar }}>
              {settings.greetingTitle || "Together with their families"}
            </p>
            <h1 className="text-2xl mb-1"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              {groomFirst} & {brideFirst}
            </h1>
            <p className="text-[9px] uppercase tracking-widest"
              style={{ color: CANVAS.onSurfaceVar }}>
              {formattedDate}
              {invitation?.venueName && ` · ${invitation.venueName}`}
            </p>
          </div>

          {/* Hero image placeholder */}
          <div className="relative w-full h-48 flex items-center justify-center"
            style={{ backgroundColor: CANVAS.surfaceHigh }}>
            <div className="text-center">
              <Image size={28} style={{ color: CANVAS.outline, margin: "0 auto 8px" }} />
              <p className="text-[9px]" style={{ color: CANVAS.outline }}>Hero Photo</p>
            </div>
            {/* RSVP overlay button */}
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <button className="w-full py-2 rounded-full text-white text-[9px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${primaryColor}cc` }}>
                RSVP
              </button>
            </div>
          </div>

          {/* Greetings */}
          <div className="p-8 text-center" style={{ backgroundColor: "#ffffff" }}>
            <h2 className="text-base mb-3"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              Greetings
            </h2>
            <p className="text-[9px] leading-relaxed" style={{ color: CANVAS.onSurfaceVar }}>
              {settings.greetingMessage ||
                "The stars aligned when we met, and now we're getting married! Your presence at our wedding would make our special day even more memorable."}
            </p>
          </div>

          {/* Music player */}
          <div className="p-6 text-center" style={{ backgroundColor: CANVAS.surface }}>
            <h2 className="text-base mb-4"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              Music
            </h2>
            <div className="rounded-xl p-3 flex items-center gap-3 border"
              style={{ backgroundColor: CANVAS.surfaceContainer, borderColor: `${CANVAS.outline}30` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: CANVAS.surfaceHigh }}>
                <Music size={14} style={{ color: primaryColor }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[9px] font-bold" style={{ color: CANVAS.onSurface }}>Song title</p>
                <p className="text-[8px]" style={{ color: CANVAS.onSurfaceVar }}>Artist</p>
              </div>
              <Play size={14} style={{ color: primaryColor }} />
            </div>
          </div>

          {/* Wedding date */}
          <div className="p-6 text-center" style={{ backgroundColor: "#ffffff" }}>
            <h2 className="text-base mb-2"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              Wedding Day
            </h2>
            <p className="text-[9px] mb-4" style={{ color: CANVAS.onSurfaceVar }}>
              {formattedDate}
              {invitation?.ceremonyTime && ` · ${invitation.ceremonyTime}`}
            </p>
            <button className="w-full py-2 rounded-full text-white text-[9px] font-bold"
              style={{ backgroundColor: `${primaryColor}b3` }}>
              Add to calendar
            </button>
          </div>

          {/* Venue */}
          <div className="p-6 text-center" style={{ backgroundColor: CANVAS.surface }}>
            <h2 className="text-base mb-4"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              Wedding Venue
            </h2>
            <div className="rounded-xl h-24 flex items-center justify-center mb-3"
              style={{ backgroundColor: CANVAS.surfaceHigh }}>
              <MapPin size={20} style={{ color: CANVAS.outline }} />
            </div>
            <p className="text-[10px] font-bold" style={{ color: CANVAS.onSurface }}>
              {invitation?.venueName || "Venue Name"}
            </p>
            <p className="text-[9px]" style={{ color: CANVAS.onSurfaceVar }}>
              {invitation?.venueAddress || "Venue Address"}
            </p>
            <button className="w-full mt-3 py-2 rounded-full text-white text-[9px] font-bold"
              style={{ backgroundColor: `${primaryColor}b3` }}>
              Get directions
            </button>
          </div>

          {/* RSVP section */}
          <div className="p-6 text-center" style={{ backgroundColor: "#ffffff" }}>
            <h2 className="text-base mb-4"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              RSVP
            </h2>
            <p className="text-[9px] mb-4" style={{ color: CANVAS.onSurfaceVar }}>
              {invitation?.inviteDeadline
                ? `Kindly reply by ${new Date(invitation.inviteDeadline + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                : "Kindly reply at your earliest convenience"}
            </p>
            <button className="w-full py-2 rounded-full text-white text-[9px] font-bold"
              style={{ backgroundColor: primaryColor }}>
              RSVP Now
            </button>
          </div>

          {/* Closure */}
          <div className="p-10 text-center" style={{ backgroundColor: CANVAS.surface }}>
            <h2 className="text-base mb-3"
              style={{ fontFamily: headingFont, color: CANVAS.onSurface }}>
              {settings.closureTitle || "We can't wait to celebrate with you"}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="h-px w-10" style={{ backgroundColor: CANVAS.outline }} />
              <Heart size={12} style={{ color: primaryColor }} />
              <div className="h-px w-10" style={{ backgroundColor: CANVAS.outline }} />
            </div>
          </div>

        </div>

        {/* Floating vellum overlay — zoom/rotate controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80%] p-3 rounded-xl flex justify-between items-center z-30"
          style={{ backdropFilter: "blur(20px)", backgroundColor: "rgba(227,227,222,0.7)" }}>
          <Eye size={16} style={{ color: primaryColor }} />
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
  const [activeSection, setActiveSection] = useState("layout");

  // Settings state — these are the invitation customization options
  // They are saved back to the `invitations` Firestore doc on Save/Publish
  const [settings, setSettings] = useState({
    privacy:          "private",
    colorPalette1:    "#56642b",
    colorPalette2:    "#8a9a5b",
    font1:            "Playfair Display",
    font2:            "DM Sans",
    layoutStyle:      "poster",
    greetingTitle:    "",
    greetingMessage:  "",
    musicTitle:       "",
    musicArtist:      "",
    musicAutoplay:    false,
    isPublished:      false,
    inviteDeadline:   "",
    closureTitle:     "",
  });

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
            privacy:         inv.isPublished ? "public" : "private",
            colorPalette1:   inv.colorPalette1   || prev.colorPalette1,
            colorPalette2:   inv.colorPalette2   || prev.colorPalette2,
            font1:           inv.font1           || prev.font1,
            font2:           inv.font2           || prev.font2,
            greetingMessage: inv.greetingMessage || prev.greetingMessage,
            greetingTitle:   inv.greetingTitle   || prev.greetingTitle,
            inviteDeadline:  inv.inviteDeadline  || prev.inviteDeadline,
            isPublished:     inv.isPublished     || false,
          }));
        }
      } catch (err) {
        console.error("Load invitation error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Dynamically load Google Fonts when font changes ──────────────────────
  // The app only loads Playfair Display + DM Sans by default.
  // When the user picks a different font pairing, we inject a <link> tag
  // so the browser can actually render the new font in the preview.
  useEffect(() => {
    const fontsToLoad = [settings.font1, settings.font2].filter(Boolean);
    fontsToLoad.forEach(font => {
      const fontSlug = font.replace(/ /g, "+");
      const id = `google-font-${fontSlug}`;
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id   = id;
        link.rel  = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${fontSlug}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, [settings.font1, settings.font2]);

  // ── Update a single settings field ────────────────────────────────────────
  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = async (publish = false) => {
    if (!user) return;
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

      const id = await saveInvitation(user.uid, dataToSave, weddingId);
      if (!weddingId) setWeddingId(id);
      if (publish) setSettings(prev => ({ ...prev, isPublished: true }));

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
      case "privacy":   return <PrivacyPanel   settings={settings} onChange={handleChange} />;
      case "color":     return <ColorPanel     settings={settings} onChange={handleChange} />;
      case "font":      return <FontPanel      settings={settings} onChange={handleChange} />;
      case "music":     return <MusicPanel     settings={settings} onChange={handleChange} />;
      case "layout":    return <LayoutPanel    settings={settings} onChange={handleChange} />;
      case "greetings": return <GreetingsPanel settings={settings} onChange={handleChange} />;
      case "date":      return <DatePanel      invitation={invitation} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Sparkles size={32} className="mb-3" style={{ color: CANVAS.outline }} />
            <p className="font-bold" style={{ color: CANVAS.onSurface }}>
              {SECTIONS.find(s => s.id === activeSection)?.label} settings
            </p>
            <p className="text-sm mt-1" style={{ color: CANVAS.onSurfaceVar }}>
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
        style={{ backgroundColor: CANVAS.surface }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: CANVAS.primary }} />
          <p className="text-sm" style={{ color: CANVAS.onSurfaceVar }}>Loading your invitation...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: CANVAS.surface, fontFamily: settings.font2 || "DM Sans" }}>

      {/* ── Top App Bar — ToGather style ── */}
      <header className="w-full sticky top-0 z-50 flex justify-between items-center px-8 h-16 border-b"
        style={{ backgroundColor: CANVAS.surface, borderColor: `${CANVAS.outline}20` }}>
        <div className="flex items-center gap-6">
          {/* Back to dashboard */}
          <Link to="/dashboard"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: CANVAS.onSurfaceVar }}>
            <ArrowLeft size={16} />
            Dashboard
          </Link>

          <div className="h-5 w-px" style={{ backgroundColor: CANVAS.surfaceHigh }} />

          {/* Branding */}
          <span className="font-heading text-xl font-semibold" style={{ color: CANVAS.primary }}>
            ToGather
          </span>

          {/* Section tabs */}
          <nav className="hidden md:flex gap-6">
            {["Preview", "Share", "Settings"].map(tab => (
              <a key={tab} href="#"
                className="font-heading italic text-lg tracking-tight transition-colors"
                style={{ color: tab === "Settings" ? CANVAS.primary : `${CANVAS.primary}60` }}>
                {tab}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Draft saved indicator */}
          {saved && (
            <span className="text-xs font-semibold" style={{ color: CANVAS.primary }}>
              Saved ✓
            </span>
          )}

          {/* Save button */}
          <button onClick={() => handleSave(false)}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold transition-colors hover:opacity-80 flex items-center gap-2"
            style={{ color: CANVAS.primary }}>
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : <><Save size={14} /> Save</>}
          </button>

          {/* Publish button */}
          <button onClick={() => handleSave(true)}
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${CANVAS.primary} 0%, ${CANVAS.primaryLight} 100%)`,
            }}>
            {settings.isPublished ? "Published ✓" : "Publish"}
          </button>
        </div>
      </header>

      {/* ── Main Layout: Sidebar + Panel + Preview ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — section navigation */}
        <aside className="w-64 flex-shrink-0 flex flex-col py-6 overflow-y-auto border-r"
          style={{
            backgroundColor: "#f2f2eb",
            borderColor: `${CANVAS.outline}15`,
            height: "calc(100vh - 4rem)",
            position: "sticky",
            top: "4rem",
          }}>

          {/* Project info */}
          <div className="px-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${CANVAS.primary}20` }}>
                <Sparkles size={16} style={{ color: CANVAS.primary }} />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: CANVAS.onSurface }}>
                  Invitation Builder
                </p>
                <p className="text-[9px] uppercase tracking-tight"
                  style={{ color: `${CANVAS.onSurfaceVar}70` }}>
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
                  className="px-6 py-3 flex items-center gap-3 text-left transition-all text-xs font-bold tracking-widest uppercase"
                  style={{
                    backgroundColor: isActive ? CANVAS.surface : "transparent",
                    color: isActive ? CANVAS.primary : `${CANVAS.primary}50`,
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
          style={{ backgroundColor: "#f4f4ef" }}>
          <div className="max-w-2xl mx-auto">

            {/* Section header */}
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-semibold mb-1"
                  style={{ color: CANVAS.onSurface }}>
                  {SECTIONS.find(s => s.id === activeSection)?.label || "Settings"}
                </h2>
                <p className="text-xs uppercase tracking-widest font-bold"
                  style={{ color: CANVAS.onSurfaceVar }}>
                  Configuration Panel
                </p>
              </div>
              {saved && (
                <span className="text-xs font-bold" style={{ color: CANVAS.primary }}>
                  Draft Saved ✓
                </span>
              )}
            </div>

            {/* Active panel content */}
            {renderPanel()}
          </div>
        </main>

        {/* Right side — phone preview */}
        <aside className="w-[400px] flex-shrink-0 flex items-center justify-center border-l"
          style={{
            backgroundColor: CANVAS.surface,
            borderColor: `${CANVAS.outline}10`,
            height: "calc(100vh - 4rem)",
            position: "sticky",
            top: "4rem",
          }}>
          <PhonePreview invitation={invitation} settings={settings} />
        </aside>

      </div>
    </div>
  );
};

export default CreateInvitation;