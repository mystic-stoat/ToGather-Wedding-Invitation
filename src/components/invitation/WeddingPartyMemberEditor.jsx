// src/components/invitation/WeddingPartyMemberEditor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Editor card for ONE wedding party member: drag handle, Move Up / Move Down,
// delete, collapse; photo (optional), name + role (required), side,
// description, and contact details with the "show to guests" switch and the
// wedding-day point-of-contact switch. All state lives in the parent
// (WeddingPartyPanel). Mirrors StoryBlockEditor's look and controls.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GripVertical, ArrowUp, ArrowDown, Trash2, ChevronDown, ChevronUp, ShieldCheck, Star, Lock, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageSlot from "@/components/invitation/ImageSlot";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import { photoSrc } from "@/lib/imageProcessing";
import { photoImageStyle } from "@/lib/photoAdjust";
import {
  PARTY_ROLES, PARTY_SIDES, PARTY_NAME_MAX, PARTY_CUSTOM_ROLE_MAX, PARTY_DESCRIPTION_MAX,
  PARTY_PHONE_MAX, PARTY_EMAIL_MAX, getRoleLabel,
} from "@/lib/weddingParty";

// The member photo is shown as a circle on the invitation; a square frame here
// gives exactly the same crop (position/zoom from Adjust).
export const PARTY_PHOTO_ASPECT = "1 / 1";

const iconBtn = "w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5F47]";

export const PartyToggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    onClick={() => onChange(!checked)}
    className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ backgroundColor: checked ? BUILDER_UI.primary : BUILDER_UI.surfaceHigh }}>
    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
      style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }} />
  </button>
);

const Chip = ({ selected, onClick, children, disabled }) => (
  <button type="button" role="radio" aria-checked={selected} onClick={onClick} disabled={disabled}
    className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all disabled:opacity-60"
    style={{
      backgroundColor: selected ? BUILDER_UI.selected : BUILDER_UI.surface,
      borderColor: selected ? BUILDER_UI.primary : "transparent",
      color: selected ? BUILDER_UI.primary : BUILDER_UI.onSurfaceVar,
    }}>
    {children}
  </button>
);

/**
 * Props
 *   member, index, total, errors ({ name?, role?, customRole?, phone?, email? })
 *   disabled          true while saving
 *   contactsStatus    "idle" | "loading" | "ready" | "error" — contact fields are
 *                     read-only until the private contacts have loaded
 *   onRetryContacts
 *   collapsed, onToggleCollapsed
 *   onFieldChange(field, value), onPhotoChange(photo), onPointOfContactChange(on)
 *   onMoveUp, onMoveDown, onDelete
 *   progress          upload % for a pending photo while saving
 *   dragHandle        { ref, attributes, listeners } from @dnd-kit, isDragging
 */
const WeddingPartyMemberEditor = ({
  member, index, total, errors = {}, disabled, contactsStatus = "ready", onRetryContacts,
  collapsed, onToggleCollapsed, onFieldChange, onPhotoChange, onPointOfContactChange,
  onMoveUp, onMoveDown, onDelete, progress, dragHandle, isDragging,
}) => {
  const n = index + 1;
  const fieldStyle = { borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceContainer, color: BUILDER_UI.onSurface };
  const errStyle = (msg) => (msg ? { borderColor: ERROR_COLOR } : {});
  const labelCls = "text-xs font-bold tracking-widest uppercase mb-2 block";
  const optional = <span className="normal-case tracking-normal font-normal">(optional)</span>;
  const errorText = (msg, id) => msg && (
    <p id={id} className="text-xs mt-1.5" role="alert" style={{ color: ERROR_COLOR }}>{msg}</p>
  );
  const contactsLocked = disabled || contactsStatus !== "ready";
  const hasContact = Boolean(member.phone.trim() || member.email.trim());
  const displayName = member.name.trim() || `Member ${n}`;
  const roleLabel = getRoleLabel(member);
  const thumb = photoSrc(member.photo);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div data-testid="party-member-editor"
      className="rounded-lg border"
      style={{
        backgroundColor: BUILDER_UI.surfaceContainer,
        borderColor: hasErrors ? ERROR_COLOR : BUILDER_UI.outline,
        boxShadow: isDragging ? "0 10px 30px rgba(0,0,0,0.12)" : undefined,
      }}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: collapsed ? "transparent" : BUILDER_UI.outline }}>
        <button type="button" ref={dragHandle?.ref} {...(dragHandle?.attributes || {})} {...(dragHandle?.listeners || {})}
          className={`${iconBtn} cursor-grab touch-none`} disabled={disabled}
          aria-label={`Drag to reorder ${displayName}`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <GripVertical size={16} />
        </button>

        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: BUILDER_UI.surfaceHigh }} aria-hidden="true">
          {thumb
            ? <img src={thumb} alt="" className="absolute inset-0 w-full h-full" style={photoImageStyle(member.photo)} />
            : <User size={16} style={{ color: BUILDER_UI.onSurfaceVar }} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ color: BUILDER_UI.onSurface }}>{displayName}</p>
          <p className="text-xs truncate flex items-center gap-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
            {roleLabel || "No role yet"}
            {member.isPointOfContact && (
              <span className="inline-flex items-center gap-0.5 font-bold" style={{ color: BUILDER_UI.primary }}>
                · <Star size={10} /> Point of contact
              </span>
            )}
          </p>
        </div>

        <button type="button" className={iconBtn} onClick={onMoveUp} disabled={disabled || index === 0}
          aria-label={`Move ${displayName} up`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <ArrowUp size={15} />
        </button>
        <button type="button" className={iconBtn} onClick={onMoveDown} disabled={disabled || index === total - 1}
          aria-label={`Move ${displayName} down`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <ArrowDown size={15} />
        </button>
        <button type="button" className={iconBtn} onClick={onDelete} disabled={disabled}
          aria-label={`Delete ${displayName}`} style={{ color: BUILDER_UI.onSurfaceVar }}>
          <Trash2 size={15} />
        </button>
        <button type="button" className={iconBtn} onClick={onToggleCollapsed}
          aria-expanded={!collapsed} aria-label={collapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
          style={{ color: BUILDER_UI.onSurfaceVar }}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 sm:p-5 space-y-5">
          {/* Photo + name */}
          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] items-start">
            <div className="max-w-[150px]">
              <span className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>Photo {optional}</span>
              <ImageSlot
                photo={member.photo}
                onChange={onPhotoChange}
                label={`Member ${n} photo`}
                aspect={PARTY_PHOTO_ASPECT}
                progress={progress}
                disabled={disabled}
                hint="Optional"
              />
            </div>
            <div className="space-y-4 min-w-0">
              <div>
                <label htmlFor={`party-name-${member.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Name <span aria-hidden="true" style={{ color: ERROR_COLOR }}>*</span>
                </label>
                <Input
                  id={`party-name-${member.id}`}
                  value={member.name}
                  onChange={e => onFieldChange("name", e.target.value)}
                  placeholder="Jordan Lee"
                  maxLength={PARTY_NAME_MAX}
                  disabled={disabled}
                  required
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? `party-name-err-${member.id}` : undefined}
                  className="h-11 rounded-lg border-0 border-b-2"
                  style={{ ...fieldStyle, ...errStyle(errors.name) }}
                />
                {errorText(errors.name, `party-name-err-${member.id}`)}
              </div>

              {/* Side */}
              <div>
                <span className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>Side</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${displayName} side`}>
                  {PARTY_SIDES.map(s => (
                    <Chip key={s.id} selected={member.side === s.id} disabled={disabled}
                      onClick={() => onFieldChange("side", s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Role */}
          <div>
            <span className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
              Role <span aria-hidden="true" style={{ color: ERROR_COLOR }}>*</span>
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${displayName} role`}
              aria-invalid={errors.role ? true : undefined}>
              {PARTY_ROLES.map(r => (
                <Chip key={r.id} selected={member.role === r.id} disabled={disabled}
                  onClick={() => onFieldChange("role", r.id)}>
                  {r.label}
                </Chip>
              ))}
            </div>
            {errorText(errors.role)}
            {member.role === "other" && (
              <div className="mt-3">
                <label htmlFor={`party-custom-role-${member.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Custom Role
                </label>
                <Input
                  id={`party-custom-role-${member.id}`}
                  value={member.customRole}
                  onChange={e => onFieldChange("customRole", e.target.value)}
                  placeholder="Flower Girl, Ring Bearer, Officiant…"
                  maxLength={PARTY_CUSTOM_ROLE_MAX}
                  disabled={disabled}
                  aria-invalid={errors.customRole ? true : undefined}
                  className="h-11 rounded-lg border-0 border-b-2"
                  style={{ ...fieldStyle, ...errStyle(errors.customRole) }}
                />
                {errorText(errors.customRole)}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor={`party-desc-${member.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
              Description {optional}
            </label>
            <Textarea
              id={`party-desc-${member.id}`}
              value={member.description}
              onChange={e => onFieldChange("description", e.target.value)}
              placeholder="My sister and best friend since day one."
              maxLength={PARTY_DESCRIPTION_MAX}
              disabled={disabled}
              className="min-h-[80px] rounded-lg border-0 border-b-2 resize-y"
              style={fieldStyle}
            />
            <p className="text-xs mt-1 text-right" style={{ color: BUILDER_UI.onSurfaceVar }}>
              {member.description.length}/{PARTY_DESCRIPTION_MAX}
            </p>
          </div>

          {/* Contact details */}
          <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: BUILDER_UI.surface }}
            data-testid="party-contact-settings">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"
                style={{ color: BUILDER_UI.onSurfaceVar }}>
                <Lock size={12} /> Contact Details {optional}
              </p>
              <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Private by default — only you can see these unless you turn on
                "Show contact details to guests".
              </p>
            </div>

            {contactsStatus === "loading" && (
              <p className="text-xs" role="status" style={{ color: BUILDER_UI.onSurfaceVar }}>Loading contact details…</p>
            )}
            {contactsStatus === "error" && (
              <div className="text-xs" role="alert" style={{ color: ERROR_COLOR }}>
                Contact details couldn't be loaded, so they can't be edited right now.{" "}
                {onRetryContacts && (
                  <button type="button" onClick={onRetryContacts} className="font-bold underline"
                    style={{ color: BUILDER_UI.primary }}>
                    Try again
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor={`party-phone-${member.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Phone
                </label>
                <Input
                  id={`party-phone-${member.id}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={member.phone}
                  onChange={e => onFieldChange("phone", e.target.value)}
                  placeholder="(214) 555-0123"
                  maxLength={PARTY_PHONE_MAX}
                  disabled={contactsLocked}
                  aria-invalid={errors.phone ? true : undefined}
                  className="h-11 rounded-lg border-0 border-b-2"
                  style={{ ...fieldStyle, ...errStyle(errors.phone) }}
                />
                {errorText(errors.phone)}
              </div>
              <div className="min-w-0">
                <label htmlFor={`party-email-${member.id}`} className={labelCls} style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Email
                </label>
                <Input
                  id={`party-email-${member.id}`}
                  type="email"
                  autoComplete="off"
                  value={member.email}
                  onChange={e => onFieldChange("email", e.target.value)}
                  placeholder="jordan@example.com"
                  maxLength={PARTY_EMAIL_MAX}
                  disabled={contactsLocked}
                  aria-invalid={errors.email ? true : undefined}
                  className="h-11 rounded-lg border-0 border-b-2"
                  style={{ ...fieldStyle, ...errStyle(errors.email) }}
                />
                {errorText(errors.email)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-3 border-t" style={{ borderColor: BUILDER_UI.outline }}>
              <div>
                <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Show contact details to guests</p>
                <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Off by default. When on, guests see this phone number and email.
                </p>
              </div>
              <PartyToggle checked={member.showContact} disabled={contactsLocked}
                onChange={v => onFieldChange("showContact", v)}
                label={`Show ${displayName}'s contact details to guests`} />
            </div>

            {/* Permission reminder — always visible next to the switch, stronger when it's on */}
            <div className="flex items-start gap-2 p-3 rounded-lg text-xs" data-testid="party-permission-reminder"
              style={{
                backgroundColor: member.showContact ? BUILDER_UI.selected : BUILDER_UI.surfaceContainer,
                color: BUILDER_UI.onSurface,
              }}>
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: BUILDER_UI.primary }} />
              <p>
                <strong>Ask {member.name.trim() || "this person"} first.</strong> Please get their permission
                before sharing their phone number or email with your guests.
              </p>
            </div>
            {member.showContact && !hasContact && contactsStatus === "ready" && (
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Add a phone number or email above — there's nothing to show yet.
              </p>
            )}

            <div className="flex items-center justify-between gap-4 pt-3 border-t" style={{ borderColor: BUILDER_UI.outline }}>
              <div>
                <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Wedding-day point of contact</p>
                <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                  Guests see this person labeled as the go-to contact on the day. Only one member can have this.
                </p>
              </div>
              <PartyToggle checked={member.isPointOfContact} disabled={disabled}
                onChange={onPointOfContactChange}
                label={`Make ${displayName} the wedding-day point of contact`} />
            </div>
            {member.isPointOfContact && !(member.showContact && hasContact) && (
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Tip: turn on "Show contact details to guests" (with their permission) so guests can reach them.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeddingPartyMemberEditor;
