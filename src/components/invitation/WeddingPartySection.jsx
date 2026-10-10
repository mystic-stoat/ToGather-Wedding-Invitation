// src/components/invitation/WeddingPartySection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders the "Wedding Party" section of the invitation: a centered heading
// and a responsive grid of member cards (round photo or placeholder avatar,
// name, role, optional description, approved contact details). Used by the
// builder's phone preview today and meant to be reused by the published
// invitation page in Phase 2 (pass it normalized members —
// normalizePartyMembers() turns the stored publicPhone/publicEmail into
// phone/email).
//
// Contact details are shown ONLY for members whose showContact is on
// (getShownContact). The builder state also holds hidden phone numbers and
// emails, so never render member.phone / member.email directly.
// ─────────────────────────────────────────────────────────────────────────────

import { Phone, Mail, Star, User } from "lucide-react";
import {
  groupPartyMembers, getRoleLabel, getShownContact, phoneHref, memberInitials,
} from "@/lib/weddingParty";
import { photoSrc } from "@/lib/imageProcessing";
import { photoImageStyle } from "@/lib/photoAdjust";
import { tintColor } from "@/components/invitation/StorySection";
import "./weddingPartySection.css";

export const WEDDING_PARTY_TITLE = "Wedding Party";

const Avatar = ({ member, accentColor, textColor }) => {
  const src = photoSrc(member.photo);
  const initials = memberInitials(member.name);
  return (
    <div className="tg-party__photo" style={{ "--tg-party-ring": accentColor }}>
      {src ? (
        <img src={src} alt={member.name.trim()} loading="lazy" decoding="async"
          style={photoImageStyle(member.photo)}
          width={member.photo?.width || undefined} height={member.photo?.height || undefined} />
      ) : (
        <div className="tg-party__avatar" data-testid="party-avatar-placeholder" aria-hidden="true"
          style={{ backgroundColor: tintColor(accentColor, 0.22), color: textColor }}>
          {initials || <User size={18} />}
        </div>
      )}
    </div>
  );
};

const MemberCard = ({ member, headingFont, textColor, mutedColor, accentColor, linkColor }) => {
  const contact = getShownContact(member);
  const role = getRoleLabel(member);
  return (
    <li className="tg-party__card" data-testid="party-member-card">
      <Avatar member={member} accentColor={accentColor} textColor={textColor} />
      <h3 className="tg-party__name" style={{ fontFamily: headingFont, color: textColor }}>
        {member.name.trim()}
      </h3>
      {role && <p className="tg-party__role" style={{ color: linkColor }}>{role}</p>}
      {member.isPointOfContact && (
        <span className="tg-party__badge" data-testid="party-point-of-contact"
          style={{ backgroundColor: tintColor(accentColor, 0.22), color: textColor }}>
          <Star size={9} aria-hidden="true" /> Wedding-day contact
        </span>
      )}
      {member.description.trim() && (
        <p className="tg-party__desc" style={{ color: mutedColor }}>{member.description.trim()}</p>
      )}
      {contact && (
        <div className="tg-party__contact" data-testid="party-member-contact">
          {contact.phone && (
            <a href={phoneHref(contact.phone)} style={{ color: linkColor }}
              aria-label={`Call ${member.name.trim()}`}>
              <Phone size={10} aria-hidden="true" /> {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={{ color: linkColor }}
              aria-label={`Email ${member.name.trim()}`}>
              <Mail size={10} aria-hidden="true" /> {contact.email}
            </a>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * Props
 *   members          local or normalized members, in display order
 *   groupBySide      false (default) = one combined grid; true = Bride's Party,
 *                    Groom's Party, Other
 *   headingFont / bodyFont
 *   backgroundColor  section background (Color Theme)
 *   textColor        names + heading      mutedColor  descriptions
 *   accentColor      photo ring, avatar tint, divider
 *   linkColor        roles, contact links (the invitation's Button color)
 */
const WeddingPartySection = ({
  members = [], groupBySide = false, headingFont, bodyFont, backgroundColor = "#fafaf5",
  textColor = "#1a1c19", mutedColor = "#46483c", accentColor = "#735c00", linkColor = "#56642b",
}) => {
  const groups = groupPartyMembers(members, groupBySide);
  if (!groups.length) return null;
  const cardStyle = { headingFont, textColor, mutedColor, accentColor, linkColor };

  return (
    <section className="tg-party" data-section="party" aria-label={WEDDING_PARTY_TITLE}
      style={{ backgroundColor, fontFamily: bodyFont, padding: "1.75rem 1rem" }}>
      <div className="tg-party__inner">
        <div>
          <h2 className="tg-party__heading" style={{ fontFamily: headingFont, color: textColor }}>
            {WEDDING_PARTY_TITLE}
          </h2>
          <div className="tg-party__divider" aria-hidden="true" style={{ color: accentColor }}>
            <span /><Star size={8} /><span />
          </div>
        </div>
        {groups.map(group => (
          <div key={group.id} data-testid={`party-group-${group.id}`}>
            {group.label && (
              <h3 className="tg-party__group-label" style={{ color: mutedColor }}>{group.label}</h3>
            )}
            <ul className="tg-party__grid">
              {group.members.map(m => <MemberCard key={m.id} member={m} {...cardStyle} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WeddingPartySection;
