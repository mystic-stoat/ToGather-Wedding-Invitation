// src/components/invitation/InvitationContent.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   Renders the invitation itself — every section, in the fixed order of the
//   builder's sidebar tabs:
//     Greetings (header + hero photo + greetings), Wedding Day, Music,
//     Our Story, Wedding Party, Venue, Travel & Stay, RSVP, Registry, Q&A,
//     then the closing section.
//   Color Theme has no section of its own; it styles everything.
//
//   ONE renderer for every place the invitation appears:
//     mode="preview" (default) — the builder's phone preview. Phone-sized
//       classes and placeholders, exactly as before Phase 1/2 (the preview's
//       HTML is unchanged).
//     mode="page" — the standalone, responsive invitation website (the owner
//       preview at /invitation/preview now; the guest website later). Same
//       design, scaled with src/components/invitation/invitationContent.css,
//       and NO unfinished placeholders. Must be rendered inside
//       <InvitationPageSurface> (below), which provides the responsive container.
//
//   Which sections appear is decided by getSectionVisibility() in
//   src/lib/invitationView.js, for both modes.
//
//   It returns a fragment (no wrapper element) so the sections stay direct
//   children of the preview's scroll box / the page surface — the builder
//   tests and Q&A section links rely on that ([data-section="…"],
//   section.tg-story).
//
// PROPS:
//   mode             "preview" | "page"
//   invitation       Wedding Details (names, date, time, venue) — may be null
//   settings         invitation customization settings (builder shape — see
//                    invitationToSettings() for saved documents)
//   hero             Hero Photo (saved or pending local photo) — may be null
//   storyBlocks      Our Story blocks in display order
//   partyMembers     Wedding Party members
//   registries / registryMessage / registryShown   Gift Registry
//   qaEntries        Q&A entries already filtered for guests (getGuestQaItems)
//   onNavigate       called with a section id when a Q&A answer links to a
//                    section (and, on the page, by the hero's RSVP button)
//   rsvpSlot         page only: what goes under the RSVP heading (the guest
//                    RSVP form later; a "turned off in preview" note now)
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef } from "react";
import { Heart, Image, ExternalLink } from "lucide-react";
import GoogleMapEmbed, { buildMapQuery, mapLinkUrl } from "@/components/GoogleMapEmbed";
import { getTravelCategoryLabel, getVisibleTravelItems } from "@/lib/travelStay";
import { CANVAS } from "@/components/invitation/builderTheme";
import { resolveInvitationTheme, buildGuestThemeStyle } from "@/lib/invitationTheme";
import StorySection from "@/components/invitation/StorySection";
import WeddingDaySection from "@/components/invitation/WeddingDaySection";
import { parseWeddingDate } from "@/lib/weddingDate";
import { photoSrc } from "@/lib/imageProcessing";
import { photoImageStyle } from "@/lib/photoAdjust";
import { getVenueDisplay } from "@/lib/venueDisplay";
import WeddingPartySection from "@/components/invitation/WeddingPartySection";
import RegistrySection from "@/components/registry/RegistrySection";
import QaSection from "@/components/qa/QaSection";
import { VIEW_MODES, getSectionVisibility } from "@/lib/invitationView";
import "./invitationContent.css";

const DEFAULT_GREETING_TITLE = "Together with their families";
const DEFAULT_CLOSURE_TITLE  = "We can't wait to celebrate with you";
// Preview only: shown until the couple writes their own welcome message.
const PLACEHOLDER_GREETING =
  "The stars aligned when we met, and now we're getting married! Your presence at our wedding would make our special day even more memorable.";

const formatLongDate = (isoDate) =>
  new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

// Page: keep a section's content in the centered column. Preview: no wrapper
// at all, so the phone preview's HTML stays exactly as it was.
const Inner = ({ page, wide = false, children }) =>
  (page
    ? <div className={wide ? "tg-inv-inner tg-inv-inner--wide" : "tg-inv-inner"}>{children}</div>
    : <>{children}</>);

/**
 * InvitationPageSurface
 * The root element for mode="page": full-width responsive container (CSS
 * container queries), the invitation's background color and body font.
 * `scrollOffset` = height of any sticky bar above the invitation, so Q&A
 * section links never scroll a section underneath it.
 */
export const InvitationPageSurface = forwardRef(({ settings, scrollOffset = 0, children, style, ...rest }, ref) => {
  const theme = resolveInvitationTheme(settings);
  return (
    <div ref={ref} className="tg-invitation-page" data-testid="invitation-page"
      style={{
        backgroundColor: theme.background, fontFamily: theme.bodyFont, color: theme.bodyText,
        "--inv-scroll-offset": `${scrollOffset}px`, ...style,
      }}
      {...rest}>
      {children}
    </div>
  );
});
InvitationPageSurface.displayName = "InvitationPageSurface";

const InvitationContent = ({
  mode = VIEW_MODES.PREVIEW,
  invitation, settings, hero, storyBlocks = [], partyMembers = [], registries = [], registryMessage = "",
  registryShown = true, qaEntries = [], onNavigate, rsvpSlot = null,
}) => {
  const page         = mode === VIEW_MODES.PAGE;
  // Pick the preview's original class string or the page's responsive one.
  const cx           = (previewCls, pageCls) => (page ? pageCls : previewCls);

  const theme        = resolveInvitationTheme(settings);
  const sec          = theme.sections;
  const heroUrl      = photoSrc(hero);
  const show         = getSectionVisibility({
    invitation, settings, hero, storyBlocks, partyMembers, registries, registryMessage, registryShown,
  }, mode);

  // Invitation buttons: same pill shape, size and label as before, now solid
  // so the white label stays readable (the old 70% opacity fell below 4.5:1).
  const btnStyle = { backgroundColor: theme.button, color: theme.buttonLabel };
  const headingStyle = { fontFamily: theme.headingFont, color: theme.headingText };

  const groomName  = invitation?.groomName?.first?.trim() || "";
  const brideName  = invitation?.brideName?.first?.trim() || "";
  const venueName  = invitation?.venueName?.trim() || "";
  const venueAddr  = invitation?.venueAddress?.trim() || "";
  const venueQuery = buildMapQuery(invitation?.venueName, invitation?.venueAddress);
  // Venue tab switches (all ON for older invitations)
  const venueDisplay = getVenueDisplay(settings);
  const hasValidDate = parseWeddingDate(invitation?.weddingDate) !== null;

  // Preview: placeholders keep the layout visible while the couple fills it in.
  // Page: only real values (names / date line are left out when missing).
  const coupleNames = page
    ? [groomName, brideName].filter(Boolean).join(" & ")
    : `${invitation?.groomName?.first || "Groom"} & ${invitation?.brideName?.first || "Bride"}`;
  const formattedDate = page
    ? (hasValidDate ? formatLongDate(invitation.weddingDate) : "")
    : (invitation?.weddingDate ? formatLongDate(invitation.weddingDate) : "Wedding Date");
  const dateLine = `${formattedDate}${venueDisplay.section && invitation?.venueName
    ? `${page && !formattedDate ? "" : " · "}${invitation.venueName}` : ""}`;

  // Page: with the year, as the guest RSVP page always showed it.
  const deadlineText = settings.inviteDeadline
    ? `Kindly reply by ${new Date(settings.inviteDeadline + "T00:00:00").toLocaleDateString("en-US",
      page ? { month: "long", day: "numeric", year: "numeric" } : { month: "long", day: "numeric" })}`
    : "Kindly reply at your earliest convenience";

  return (
    <>
      {/* Hero header */}
      <div className={cx("p-6 text-center", "tg-inv-section tg-inv-header text-center")}
        data-section="header" data-testid={page ? "invitation-header" : undefined}
        style={{ backgroundColor: sec.header }}>
        <Inner page={page}>
          <p className={cx("text-[9px] uppercase tracking-widest mb-1", "tg-inv-eyebrow")}
            style={{ color: theme.bodyText }}>
            {settings.greetingTitle || DEFAULT_GREETING_TITLE}
          </p>
          {coupleNames && (
            <h1 className={cx("text-2xl mb-1", "tg-inv-h1")} style={headingStyle}>
              {page ? coupleNames : <>{invitation?.groomName?.first || "Groom"} & {invitation?.brideName?.first || "Bride"}</>}
            </h1>
          )}
          {(!page || dateLine) && (
            <p className={cx("text-[9px] uppercase tracking-widest", "tg-inv-eyebrow")}
              style={{ color: theme.bodyText }}>
              {page ? dateLine : (
                <>
                  {formattedDate}
                  {venueDisplay.section && invitation?.venueName && ` · ${invitation.venueName}`}
                </>
              )}
            </p>
          )}
          {/* Save the Date / Add to Calendar lives at the bottom of the
              Wedding Day section (WeddingDaySection), not here. */}
        </Inner>
      </div>

      {/* Hero image — fills the frame using the couple's position/zoom (same
          style as the editor). Preview: h-96 (384px) in the ~268px-wide phone =
          HERO_FRAME_ASPECT (HeroPhotoField.jsx), with a placeholder until a
          photo is added. Page: a frame with that SAME aspect ratio at every
          width (so the crop matches), shown only when there is a photo. */}
      {page ? (
        show.heroPhoto && (
          <div className="tg-inv-hero" data-testid="invitation-hero" style={{ backgroundColor: sec.header }}>
            <div className="tg-inv-hero__frame" data-testid="invitation-hero-frame"
              style={{ backgroundColor: CANVAS.surfaceHigh }}>
              <img src={heroUrl} alt={coupleNames ? `${coupleNames}` : "Wedding photo"}
                decoding="async" draggable={false}
                className="absolute inset-0 w-full h-full" style={photoImageStyle(hero)} />
              <div className="tg-inv-hero__rsvp">
                <button type="button" className="tg-inv-button" onClick={() => onNavigate?.("rsvp")}
                  style={{ backgroundColor: `${theme.button}cc`, color: theme.buttonLabel }}>
                  RSVP
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="relative w-full h-96 flex items-center justify-center overflow-hidden"
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
      )}

      {/* Greetings — page: hidden when the couple never wrote a message */}
      {show.greetings && (
        <div className={cx("p-8 text-center", "tg-inv-section text-center")}
          data-section="greetings" style={{ backgroundColor: sec.greetings }}>
          <Inner page={page}>
            <h2 className={cx("text-base mb-3", "tg-inv-h2")} style={headingStyle}>
              Greetings
            </h2>
            <p className={cx("text-[9px] leading-relaxed", "tg-inv-body whitespace-pre-line")}
              style={{ color: theme.bodyText }}>
              {page ? settings.greetingMessage.trim() : (settings.greetingMessage || PLACEHOLDER_GREETING)}
            </p>
          </Inner>
        </div>
      )}

      {/* ── Content order matches the sidebar tabs (SECTIONS): Greetings
          (header + hero + greetings), Date, Music, Our Story, Wedding
          Party, Venue, Travel & Stay, RSVP, Registry — then the closing.
          Color Theme has no section of its own; it styles everything. ── */}

      {/* Wedding Day (Date tab) — right after Greetings; shown when Calendar
          View, Countdown and/or Add to Calendar is on (page: and a valid date
          is set). The hero date above is always shown regardless of these
          settings. */}
      {show.date && (
        <WeddingDaySection invitation={invitation} settings={settings}
          theme={theme} backgroundColor={sec.date} {...(page ? { variant: "page" } : {})} />
      )}

      {/* Music player — only shown once a real Spotify song is selected
          AND the host has "Show music on invitation" enabled. No fake
          placeholder song info is ever displayed. */}
      {show.music && (
        <div className={cx("p-6 text-center", "tg-inv-section text-center")}
          data-section="music" style={{ backgroundColor: sec.music }}>
          <Inner page={page}>
            <h2 className={cx("text-base mb-4", "tg-inv-h2")} style={headingStyle}>
              Music
            </h2>
            {page ? (
              <div className="tg-inv-music">
                <iframe
                  title="Spotify song"
                  src={`https://open.spotify.com/embed/track/${settings.musicTrackId}`}
                  width="100%"
                  height="152"
                  style={{ borderRadius: "12px", border: "none" }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            ) : (
              <iframe
                title="Spotify song"
                src={`https://open.spotify.com/embed/track/${settings.musicTrackId}`}
                width="100%"
                height="80"
                style={{ borderRadius: "12px", border: "none" }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            )}
          </Inner>
        </div>
      )}

      {/* Our Story — after Music, before Wedding Party. Preview shows empty
          photo slots as placeholders; the page shows only real content. */}
      {show.story && (
        <StorySection
          title={settings.storyTitle}
          blocks={storyBlocks}
          headingFont={theme.headingFont}
          bodyFont={theme.bodyFont}
          accentColor={theme.secondary}
          backgroundColor={sec.story}
          textColor={theme.headingText}
          mutedColor={theme.bodyText}
          showPlaceholders={!page}
        />
      )}

      {/* Wedding Party — after Our Story. Only when the switch is on AND at
          least one member has a name. Contact details appear only for
          members whose "Show contact details" is on. */}
      {show.party && (
        <WeddingPartySection
          members={partyMembers}
          groupBySide={settings.partyGroupBySide === true}
          headingFont={theme.headingFont}
          bodyFont={theme.bodyFont}
          backgroundColor={sec.party}
          textColor={theme.headingText}
          mutedColor={theme.bodyText}
          accentColor={theme.secondary}
          linkColor={theme.button}
        />
      )}

      {/* Venue — name/address/link from Wedding Details; which parts show
          is controlled by the Venue tab (src/lib/venueDisplay.js).
          Page: no "Venue Name"/"Venue Address" placeholders, no map or
          directions button without a real name/address. */}
      {show.venue && (page ? (
        <div className="tg-inv-section text-center" data-section="venue" style={{ backgroundColor: sec.venue }}>
          <Inner page>
            <h2 className="tg-inv-h2" style={headingStyle}>
              Wedding Venue
            </h2>
            {venueDisplay.map && venueQuery && (
              <div className="tg-inv-venue__map" data-testid="venue-map">
                <GoogleMapEmbed query={venueQuery} heightClass="h-56 sm:h-72 lg:h-80"
                  title={`Map of ${venueName || venueAddr}`} />
              </div>
            )}
            {venueName && (
              <p className="tg-inv-strong" style={{ color: theme.headingText }}>{venueName}</p>
            )}
            {venueDisplay.address && venueAddr && (
              <p className="tg-inv-body" data-testid="venue-address" style={{ color: theme.bodyText }}>
                {venueAddr}
              </p>
            )}
            {venueDisplay.directions && venueQuery && (
              <a
                href={invitation?.venueURL || mapLinkUrl(venueQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="tg-inv-button"
                style={btnStyle}
              >
                Get directions
              </a>
            )}
          </Inner>
        </div>
      ) : (
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
      ))}

      {/* Travel & Stay — only when the toggle is on AND at least one place
          has a name. Links are re-checked so only http(s) URLs render.
          Page: cards in a 1-column (phone) / 2-column (≥640px) grid. */}
      {show.travel && (
        <div className={cx("p-6", "tg-inv-section")} data-section="travel" style={{ backgroundColor: sec.travel }}>
          <Inner page={page} wide>
            <h2 className={cx("text-base mb-2 text-center", "tg-inv-h2 text-center")} style={headingStyle}>
              Travel &amp; Stay
            </h2>
            {settings.travelMessage?.trim() && (
              <p className={cx("text-[9px] leading-relaxed text-center mb-4", "tg-inv-body text-center mb-8")}
                style={{ color: theme.bodyText }}>
                {settings.travelMessage.trim()}
              </p>
            )}
            <div className={cx("space-y-3", "tg-inv-travel__list")}>
              {getVisibleTravelItems(settings.travelItems).map(item => (
                <div key={item.id} className={cx("rounded-xl p-3 text-left", "tg-inv-card")}
                  style={{ border: `1px solid ${CANVAS.outline}` }}>
                  <p className={cx("text-[8px] font-bold uppercase tracking-widest mb-0.5", "tg-inv-label mb-1")}
                    style={{ color: theme.button }}>
                    {getTravelCategoryLabel(item.category)}
                  </p>
                  <p className={cx("text-[10px] font-bold", "tg-inv-strong")} style={{ color: theme.headingText }}>
                    {item.name}
                  </p>
                  {item.description && (
                    <p className={cx("text-[9px] leading-relaxed mt-1", "tg-inv-body mt-1")}
                      style={{ color: theme.bodyText }}>
                      {item.description}
                    </p>
                  )}
                  {item.mapUrl && (
                    <a
                      href={item.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cx("mt-2 inline-flex items-center gap-1 text-[9px] font-bold",
                        "mt-3 inline-flex items-center gap-1 tg-inv-small font-bold")}
                      style={{ color: theme.button }}
                    >
                      View on Google Maps <ExternalLink size={page ? 14 : 9} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Inner>
        </div>
      )}

      {/* RSVP section. Preview: a sample button. Page: the `rsvpSlot`
          (the guest RSVP form later; a "turned off in preview" note now). */}
      {page ? (
        <div className="tg-inv-section text-center" data-section="rsvp" style={{ backgroundColor: sec.rsvp }}>
          <Inner page>
            <h2 className="tg-inv-h2" style={headingStyle}>
              RSVP
            </h2>
            <p className="tg-inv-body" style={{ color: theme.bodyText }}>
              {deadlineText}
            </p>
            {rsvpSlot}
          </Inner>
        </div>
      ) : (
        <div className="p-6 text-center" data-section="rsvp" style={{ backgroundColor: sec.rsvp }}>
          <h2 className="text-base mb-4"
            style={{ fontFamily: theme.headingFont, color: theme.headingText }}>
            RSVP
          </h2>
          <p className="text-[9px] mb-4" style={{ color: theme.bodyText }}>
            {deadlineText}
          </p>
          <button className="w-full py-2 rounded-full text-white text-[9px] font-bold"
            style={btnStyle}>
            RSVP Now
          </button>
        </div>
      )}

      {/* Gift Registry — the SAME component the guest RSVP page renders,
          wrapped in the same theme styling, so this is exactly what guests
          see: the message plus only links with isVisible === true. Shows
          nothing when "Show Registry on Invitation" is off, or when there's
          no message and no visible link. (Page: the empty wrapper is left out
          too, so it never adds an empty band.) */}
      {page ? (
        show.registry && (
          <div className="tg-invite-theme tg-inv-section tg-inv-section--card" data-section="registry"
            style={{ ...buildGuestThemeStyle(settings), backgroundColor: theme.background }}>
            <Inner page>
              <RegistrySection registries={registries} registryMessage={registryMessage}
                showOnInvitation={registryShown} />
            </Inner>
          </div>
        )
      ) : (
        <div className="tg-invite-theme" data-section="registry"
          style={{ ...buildGuestThemeStyle(settings), backgroundColor: theme.background }}>
          <div className={show.registry ? "p-4" : undefined}>
            <RegistrySection registries={registries} registryMessage={registryMessage}
              showOnInvitation={registryShown} compact />
          </div>
        </div>
      )}

      {/* Q&A — after Registry, before the closing. Same component as the
          guest RSVP page: only questions that are switched on and fully
          answered, in the couple's order. Section links scroll to that
          section (the phone screen in the preview, the page on the website).
          Hidden while the Q&A switch is off. */}
      {page ? (
        qaEntries.length > 0 && (
          <div className="tg-invite-theme tg-inv-section tg-inv-section--card" data-section="qa"
            style={{ ...buildGuestThemeStyle(settings), backgroundColor: theme.background }}>
            <Inner page>
              <QaSection entries={qaEntries} onNavigate={onNavigate} />
            </Inner>
          </div>
        )
      ) : (
        <div className="tg-invite-theme" data-section="qa"
          style={{ ...buildGuestThemeStyle(settings), backgroundColor: theme.background }}>
          <div className={qaEntries.length ? "p-4" : undefined}>
            <QaSection entries={qaEntries} compact
              onNavigate={onNavigate} />
          </div>
        </div>
      )}

      {/* Closure — the default closing line is kept on the page too */}
      <div className={cx("p-10 text-center", "tg-inv-section text-center")}
        data-section="closure" style={{ backgroundColor: sec.closure }}>
        <Inner page={page}>
          <h2 className={cx("text-base mb-3", "tg-inv-h2")} style={headingStyle}>
            {settings.closureTitle || DEFAULT_CLOSURE_TITLE}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={cx("h-px w-10", "tg-inv-closure__line")} style={{ backgroundColor: theme.accent }} />
            <Heart size={page ? 18 : 12} style={{ color: theme.primary }} />
            <div className={cx("h-px w-10", "tg-inv-closure__line")} style={{ backgroundColor: theme.accent }} />
          </div>
        </Inner>
      </div>
    </>
  );
};

export default InvitationContent;
