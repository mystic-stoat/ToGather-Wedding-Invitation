import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import ScrollReveal from "@/components/ScrollReveal";
import { ChevronDown, ChevronRight, Save, Eye, Smartphone, Sparkles, Loader2, Heart, Calendar, MapPin, MessageSquareHeart, Mail, Palette, Image as ImageIcon, Clock, CheckCircle2 } from "lucide-react";

// ─── Template definitions ────────────────────────────────────────────

const templates = [{
  id: "elegant-minimal",
  name: "Elegant Minimal",
  tagline: "Clean lines, timeless beauty",
  colors: {
    bg: "hsl(24, 26%, 92%)",
    text: "hsl(100, 10%, 20%)",
    accent: "hsl(100, 14%, 49%)"
  },
  fontHeading: "'Playfair Display', serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "Together with their families",
  message: "We joyfully invite you to celebrate the union of two hearts becoming one. Your presence would make our day truly magical.",
  coupleNames: "Emma & James",
  date: "Saturday, June 14, 2026",
  time: "4:00 PM",
  venue: "The Grand Terrace",
  venueAddress: "142 Magnolia Lane, Charleston, SC",
  rsvpNote: "Kindly respond by May 20, 2026"
}, {
  id: "romantic-floral",
  name: "Romantic Floral",
  tagline: "Soft petals, warm tones",
  colors: {
    bg: "hsl(350, 56%, 94%)",
    text: "hsl(350, 20%, 25%)",
    accent: "hsl(350, 80%, 72%)"
  },
  fontHeading: "'Playfair Display', serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "With hearts full of love",
  message: "In a garden of moments, ours bloom the brightest. Join us as we begin our forever, surrounded by the people we cherish most.",
  coupleNames: "Sophia & Liam",
  date: "Sunday, September 7, 2026",
  time: "5:30 PM",
  venue: "Rosewood Gardens",
  venueAddress: "88 Blossom Way, Savannah, GA",
  rsvpNote: "Please RSVP by August 15, 2026"
}, {
  id: "modern-chic",
  name: "Modern Chic",
  tagline: "Bold, contemporary edge",
  colors: {
    bg: "hsl(0, 0%, 97%)",
    text: "hsl(0, 0%, 12%)",
    accent: "hsl(100, 14%, 49%)"
  },
  fontHeading: "'DM Sans', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "You're invited",
  message: "No frills. Just love, good people, and a celebration worth remembering. Come as you are — we wouldn't want it any other way.",
  coupleNames: "Ava & Noah",
  date: "Friday, October 10, 2026",
  time: "6:00 PM",
  venue: "The Loft at Studio Row",
  venueAddress: "55 Industrial Blvd, Austin, TX",
  rsvpNote: "RSVP by September 1, 2026"
}, {
  id: "classic-formal",
  name: "Classic Formal",
  tagline: "Traditional elegance",
  colors: {
    bg: "hsl(40, 30%, 95%)",
    text: "hsl(40, 10%, 18%)",
    accent: "hsl(40, 45%, 55%)"
  },
  fontHeading: "'Playfair Display', serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "Mr. & Mrs. Harrison request the honor of your presence",
  message: "at the marriage of their daughter to the son of Mr. & Mrs. Bennett. A reception will follow the ceremony.",
  coupleNames: "Charlotte & William",
  date: "Saturday, April 18, 2026",
  time: "3:00 PM",
  venue: "St. Andrew's Cathedral",
  venueAddress: "200 Cathedral Square, Boston, MA",
  rsvpNote: "The favor of a reply is requested by March 25, 2026"
}, {
  id: "soft-pastel",
  name: "Soft Pastel",
  tagline: "Dreamy and delicate",
  colors: {
    bg: "hsl(350, 56%, 96%)",
    text: "hsl(280, 10%, 30%)",
    accent: "hsl(350, 56%, 84%)"
  },
  fontHeading: "'Playfair Display', serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "With joy in our hearts",
  message: "Like a watercolor painting, our love story has been a blend of soft moments and vivid memories. Come paint another chapter with us.",
  coupleNames: "Lily & Oliver",
  date: "Sunday, May 24, 2026",
  time: "4:30 PM",
  venue: "Meadow Creek Estate",
  venueAddress: "310 Willow Drive, Napa Valley, CA",
  rsvpNote: "Kindly reply by April 30, 2026"
}, {
  id: "luxury-gold",
  name: "Luxury Gold",
  tagline: "Opulent & grand",
  colors: {
    bg: "hsl(40, 20%, 14%)",
    text: "hsl(40, 30%, 90%)",
    accent: "hsl(43, 74%, 60%)"
  },
  fontHeading: "'Playfair Display', serif",
  fontBody: "'DM Sans', sans-serif",
  greeting: "The honor of your presence is requested",
  message: "An evening of elegance, fine dining, and timeless celebration awaits. Join us for a night you won't forget.",
  coupleNames: "Isabella & Alexander",
  date: "Saturday, December 20, 2026",
  time: "7:00 PM",
  venue: "The Grand Ballroom at The Ritz",
  venueAddress: "1 Central Park South, New York, NY",
  rsvpNote: "Black tie · RSVP by November 28, 2026"
}];

// ─── Accordion section definitions ───────────────────────────────────

const sections = [{
  key: "couple",
  title: "Couple Names",
  icon: Heart
}, {
  key: "datetime",
  title: "Date & Time",
  icon: Calendar
}, {
  key: "venue",
  title: "Venue",
  icon: MapPin
}, {
  key: "message",
  title: "Message",
  icon: MessageSquareHeart
}, {
  key: "rsvp",
  title: "RSVP",
  icon: Mail
}, {
  key: "theme",
  title: "Theme & Colors",
  icon: Palette
}, {
  key: "images",
  title: "Images",
  icon: ImageIcon
}];

// ─── Component ───────────────────────────────────────────────────────
const CreateInvitation = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [expanded, setExpanded] = useState(new Set(["couple"]));
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  // Editable fields
  const [coupleNames, setCoupleNames] = useState(templates[0].coupleNames);
  const [greeting, setGreeting] = useState(templates[0].greeting);
  const [date, setDate] = useState(templates[0].date);
  const [time, setTime] = useState(templates[0].time);
  const [venue, setVenue] = useState(templates[0].venue);
  const [venueAddress, setVenueAddress] = useState(templates[0].venueAddress);
  const [message, setMessage] = useState(templates[0].message);
  const [rsvpNote, setRsvpNote] = useState(templates[0].rsvpNote);

  // Section visibility
  const [showSections, setShowSections] = useState({
    couple: true,
    datetime: true,
    venue: true,
    message: true,
    rsvp: true
  });
  const applyTemplate = useCallback(t => {
    setSelectedTemplate(t);
    setCoupleNames(t.coupleNames);
    setGreeting(t.greeting);
    setDate(t.date);
    setTime(t.time);
    setVenue(t.venue);
    setVenueAddress(t.venueAddress);
    setMessage(t.message);
    setRsvpNote(t.rsvpNote);
  }, []);
  const toggleSection = key => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  // Simulated AI generation
  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiDone(false);
    const lower = aiPrompt.toLowerCase();
    const isBeach = lower.includes("beach") || lower.includes("ocean") || lower.includes("sea");
    const isRustic = lower.includes("rustic") || lower.includes("barn") || lower.includes("outdoor") || lower.includes("country");
    const isLuxury = lower.includes("luxury") || lower.includes("ballroom") || lower.includes("grand") || lower.includes("elegant");
    setTimeout(() => {
      if (isBeach) {
        setCoupleNames("Marina & Kai");
        setGreeting("Toes in the sand, love in the air");
        setMessage("Join us where the waves meet the shore for a sunset celebration of love, laughter, and barefoot dancing under the stars.");
        setDate("Saturday, July 19, 2026");
        setTime("5:00 PM");
        setVenue("Coral Cove Beach Club");
        setVenueAddress("1 Oceanfront Drive, Malibu, CA");
        setRsvpNote("Beach casual · RSVP by June 25, 2026");
        setSelectedTemplate(templates[4]); // soft pastel
      } else if (isRustic) {
        setCoupleNames("Hazel & Wyatt");
        setGreeting("Under open skies and string lights");
        setMessage("From wildflower meadows to old oak trees, our love story found its roots. Come celebrate with us in the place where it all began.");
        setDate("Sunday, August 23, 2026");
        setTime("3:30 PM");
        setVenue("Willow Creek Farm");
        setVenueAddress("456 Country Road 12, Asheville, NC");
        setRsvpNote("Boots welcome · Reply by July 30, 2026");
        setSelectedTemplate(templates[0]); // elegant minimal
      } else if (isLuxury) {
        setCoupleNames("Victoria & Sebastian");
        setGreeting("An evening of grandeur awaits");
        setMessage("Crystal chandeliers, champagne towers, and a love story written in gold. We would be honored by your presence at our celebration.");
        setDate("Saturday, November 8, 2026");
        setTime("7:00 PM");
        setVenue("The Monarch Grand Hotel");
        setVenueAddress("One Park Avenue, New York, NY");
        setRsvpNote("Black tie required · RSVP by October 15, 2026");
        setSelectedTemplate(templates[5]); // luxury gold
      } else {
        setCoupleNames("Aria & Ethan");
        setGreeting("Two hearts, one beautiful beginning");
        setMessage("Every love story is special, but ours is our favorite. We can't wait to start this new chapter with you by our side.");
        setDate("Saturday, September 13, 2026");
        setTime("4:00 PM");
        setVenue("The Ivy Hall");
        setVenueAddress("78 Garden Street, Portland, OR");
        setRsvpNote("Kindly respond by August 20, 2026");
        setSelectedTemplate(templates[2]); // modern chic
      }
      setAiLoading(false);
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    }, 2200);
  };
  const t = selectedTemplate;
  return <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Title bar */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <h1 className="font-heading text-xl sm:text-2xl font-semibold text-foreground">Invitation Builder</h1>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="rounded-xl gap-2 border-border/60">
              <Eye size={15} /> <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button variant="default" size="sm" className="rounded-xl gap-2">
              <Save size={15} /> <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Mobile preview first on small screens */}
        <div className="lg:hidden mb-8">
          <PhonePreview template={t} coupleNames={coupleNames} greeting={greeting} date={date} time={time} venue={venue} venueAddress={venueAddress} message={message} rsvpNote={rsvpNote} showSections={showSections} />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ─── LEFT: Builder panel ─── */}
          <div className="lg:w-[420px] flex-shrink-0 space-y-6">

            {/* AI Generator */}
            <ScrollReveal>
              <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-foreground/[0.03] p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                    <Sparkles size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">AI Generator</h3>
                    <p className="text-xs text-muted-foreground">Describe your style, we'll do the rest</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. romantic beach wedding at sunset, rustic outdoor barn, luxury ballroom with gold accents…" className="min-h-[80px] bg-background border-border/60 rounded-xl resize-none text-sm focus:ring-2 focus:ring-primary/20" />
                  <Button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()} className="w-full rounded-xl gap-2 h-11" variant="default">
                    {aiLoading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : aiDone ? <><CheckCircle2 size={16} /> Generated!</> : <><Sparkles size={16} /> Generate Invitation with AI</>}
                  </Button>
                </div>
              </div>
            </ScrollReveal>

            {/* Template selector */}
            <ScrollReveal delay={80}>
              <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-foreground/[0.03] p-5 sm:p-6">
                <h3 className="font-heading text-base font-semibold text-foreground mb-4">Choose a Template</h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map(tmpl => {
                  const active = tmpl.id === t.id;
                  return <button key={tmpl.id} onClick={() => applyTemplate(tmpl)} className={`group relative rounded-xl border-2 p-3 text-left transition-all duration-200 active:scale-[0.97] ${active ? "border-primary bg-primary/5 shadow-md" : "border-border/40 bg-background/60 hover:border-primary/40 hover:shadow-sm"}`}>
                        {/* Color swatch */}
                        <div className="flex gap-1.5 mb-2.5">
                          <span className="w-5 h-5 rounded-full border border-foreground/10" style={{
                        backgroundColor: tmpl.colors.bg
                      }} />
                          <span className="w-5 h-5 rounded-full border border-foreground/10" style={{
                        backgroundColor: tmpl.colors.accent
                      }} />
                          <span className="w-5 h-5 rounded-full border border-foreground/10" style={{
                        backgroundColor: tmpl.colors.text
                      }} />
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{tmpl.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tmpl.tagline}</p>
                        {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 size={12} className="text-primary-foreground" />
                          </div>}
                      </button>;
                })}
                </div>
              </div>
            </ScrollReveal>

            {/* Settings Accordion */}
            <ScrollReveal delay={160}>
              <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-foreground/[0.03] overflow-hidden divide-y divide-border/40">
                {sections.map(sec => {
                const isOpen = expanded.has(sec.key);
                const Icon = sec.icon;
                return <div key={sec.key}>
                      <button onClick={() => toggleSection(sec.key)} className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors duration-150 ${isOpen ? "bg-primary/[0.06]" : "hover:bg-muted/40"}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <Icon size={16} />
                        </div>
                        <span className={`text-sm font-medium flex-1 transition-colors ${isOpen ? "text-primary" : "text-foreground"}`}>
                          {sec.title}
                        </span>
                        {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                      </button>

                      {isOpen && <div className="px-5 pb-5 pt-2 animate-fade-in space-y-3">
                          {sec.key === "couple" && <>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show section</Label>
                                <Switch checked={showSections.couple} onCheckedChange={v => setShowSections(p => ({
                          ...p,
                          couple: v
                        }))} />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Couple Names</Label>
                                <Input value={coupleNames} onChange={e => setCoupleNames(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Greeting Line</Label>
                                <Input value={greeting} onChange={e => setGreeting(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                            </>}
                          {sec.key === "datetime" && <>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show section</Label>
                                <Switch checked={showSections.datetime} onCheckedChange={v => setShowSections(p => ({
                          ...p,
                          datetime: v
                        }))} />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Date</Label>
                                <Input value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Time</Label>
                                <Input value={time} onChange={e => setTime(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                            </>}
                          {sec.key === "venue" && <>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show section</Label>
                                <Switch checked={showSections.venue} onCheckedChange={v => setShowSections(p => ({
                          ...p,
                          venue: v
                        }))} />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Venue Name</Label>
                                <Input value={venue} onChange={e => setVenue(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Address</Label>
                                <Input value={venueAddress} onChange={e => setVenueAddress(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                            </>}
                          {sec.key === "message" && <>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show section</Label>
                                <Switch checked={showSections.message} onCheckedChange={v => setShowSections(p => ({
                          ...p,
                          message: v
                        }))} />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">Invitation Message</Label>
                                <Textarea value={message} onChange={e => setMessage(e.target.value)} className="mt-1.5 min-h-[100px] bg-background border-border/60 rounded-xl resize-none text-sm" />
                              </div>
                            </>}
                          {sec.key === "rsvp" && <>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show section</Label>
                                <Switch checked={showSections.rsvp} onCheckedChange={v => setShowSections(p => ({
                          ...p,
                          rsvp: v
                        }))} />
                              </div>
                              <div>
                                <Label className="text-sm text-foreground">RSVP Note</Label>
                                <Input value={rsvpNote} onChange={e => setRsvpNote(e.target.value)} className="mt-1.5 h-11 bg-background border-border/60 rounded-xl" />
                              </div>
                            </>}
                          {sec.key === "theme" && <div>
                              <Label className="text-sm text-foreground mb-2 block">Active Template Colors</Label>
                              <div className="flex gap-2">
                                {[t.colors.bg, t.colors.accent, t.colors.text].map((c, i) => <div key={i} className="flex flex-col items-center gap-1">
                                    <span className="w-10 h-10 rounded-xl border border-foreground/10 shadow-sm" style={{
                            backgroundColor: c
                          }} />
                                    <span className="text-[10px] text-muted-foreground">{i === 0 ? "BG" : i === 1 ? "Accent" : "Text"}</span>
                                  </div>)}
                              </div>
                            </div>}
                          {sec.key === "images" && <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border/50 rounded-xl bg-background/40">
                              <ImageIcon size={28} className="text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG up to 5MB</p>
                            </div>}
                        </div>}
                    </div>;
              })}
              </div>
            </ScrollReveal>
          </div>

          {/* ─── RIGHT: Live phone preview (desktop) ─── */}
          <div className="hidden lg:flex flex-1 items-start justify-center sticky top-28 self-start">
            <PhonePreview template={t} coupleNames={coupleNames} greeting={greeting} date={date} time={time} venue={venue} venueAddress={venueAddress} message={message} rsvpNote={rsvpNote} showSections={showSections} />
          </div>
        </div>
      </main>

      <Footer />
    </div>;
};

// ─── Phone Preview ───────────────────────────────────────────────────

const PhonePreview = ({
  template: t,
  coupleNames,
  greeting,
  date,
  time,
  venue,
  venueAddress,
  message,
  rsvpNote,
  showSections
}) => <div className="flex flex-col items-center">
    <div className="relative">
      {/* Phone frame */}
      <div className="w-[300px] sm:w-[320px] h-[620px] sm:h-[640px] rounded-[2.5rem] border-[3px] border-foreground/80 shadow-2xl overflow-hidden relative" style={{
      backgroundColor: t.colors.bg
    }}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-foreground/80 rounded-b-2xl z-10" />

        {/* Scrollable content */}
        <div className="h-full overflow-y-auto pt-10 pb-8 px-6 transition-all duration-500">
          {/* Greeting */}
          <p className="text-center text-xs tracking-widest uppercase mt-4 mb-2 transition-all duration-300" style={{
          color: t.colors.accent,
          fontFamily: t.fontBody
        }}>
            {greeting}
          </p>

          {/* Couple names */}
          {showSections.couple && <h2 className="text-center text-2xl sm:text-[1.7rem] font-bold leading-tight mb-4 transition-all duration-300" style={{
          color: t.colors.text,
          fontFamily: t.fontHeading
        }}>
              {coupleNames}
            </h2>}

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-2 my-4">
            <span className="h-px w-10 opacity-30" style={{
            backgroundColor: t.colors.text
          }} />
            <Heart size={14} style={{
            color: t.colors.accent
          }} />
            <span className="h-px w-10 opacity-30" style={{
            backgroundColor: t.colors.text
          }} />
          </div>

          {/* Message */}
          {showSections.message && <p className="text-center text-xs leading-relaxed mb-5 transition-all duration-300" style={{
          color: t.colors.text,
          fontFamily: t.fontBody,
          opacity: 0.75
        }}>
              {message}
            </p>}

          {/* Date & Time */}
          {showSections.datetime && <div className="rounded-xl p-4 mb-4 text-center transition-all duration-300" style={{
          backgroundColor: t.colors.accent + "18"
        }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Calendar size={12} style={{
              color: t.colors.accent
            }} />
                <span className="text-xs font-semibold tracking-wide" style={{
              color: t.colors.text,
              fontFamily: t.fontBody
            }}>
                  {date}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Clock size={12} style={{
              color: t.colors.accent
            }} />
                <span className="text-xs" style={{
              color: t.colors.text,
              fontFamily: t.fontBody,
              opacity: 0.7
            }}>
                  {time}
                </span>
              </div>
            </div>}

          {/* Venue */}
          {showSections.venue && <div className="text-center mb-5 transition-all duration-300">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <MapPin size={12} style={{
              color: t.colors.accent
            }} />
                <span className="text-xs font-semibold" style={{
              color: t.colors.text,
              fontFamily: t.fontBody
            }}>
                  {venue}
                </span>
              </div>
              <p className="text-[11px]" style={{
            color: t.colors.text,
            fontFamily: t.fontBody,
            opacity: 0.55
          }}>
                {venueAddress}
              </p>
            </div>}

          {/* RSVP */}
          {showSections.rsvp && <div className="mt-4 transition-all duration-300">
              <div className="rounded-xl py-3 px-4 text-center" style={{
            backgroundColor: t.colors.accent + "25"
          }}>
                <p className="text-[11px] font-medium tracking-wide" style={{
              color: t.colors.text,
              fontFamily: t.fontBody
            }}>
                  {rsvpNote}
                </p>
              </div>
              <button className="w-full mt-3 rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-opacity hover:opacity-90" style={{
            backgroundColor: t.colors.accent,
            color: t.colors.bg,
            fontFamily: t.fontBody
          }}>
                RSVP Now
              </button>
            </div>}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-foreground/20" />
      </div>
    </div>

    {/* Label */}
    <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
      <Smartphone size={14} />
      <span>Live Preview · {t.name}</span>
    </div>
  </div>;
export default CreateInvitation;
