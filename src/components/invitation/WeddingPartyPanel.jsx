// src/components/invitation/WeddingPartyPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Wedding Party" tab of the Invitation Builder (replaces the old
// Guestbook placeholder): show/hide switch, "group by side" switch, and the
// list of members (add / edit / delete / reorder).
//
// The whole feature is optional — with no members the section simply doesn't
// appear on the invitation, and publishing works as before.
//
// Reordering works like Our Story: drag a member by its grip handle (mouse,
// touch with a short press, or keyboard) — powered by @dnd-kit — or use the
// Move Up / Move Down buttons.
//
// Nothing here talks to Firebase: edits only change local state, the phone
// preview updates live, and everything is saved when the couple clicks Save.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Users, AlertCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import WeddingPartyMemberEditor, { PartyToggle } from "@/components/invitation/WeddingPartyMemberEditor";
import { BUILDER_UI, ERROR_COLOR } from "@/components/invitation/builderTheme";
import {
  createPartyMember, updatePartyMember, setPointOfContact, isPartyMemberBlank,
  MAX_PARTY_MEMBERS,
} from "@/lib/weddingParty";
import { moveItem } from "@/lib/storyBlocks";
import { releasePhoto, releaseIfReplaced } from "@/lib/imageProcessing";

// ── One sortable row ─────────────────────────────────────────────────────────
const SortableMember = ({ member, ...props }) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: member.id, disabled: props.disabled });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }}>
      <WeddingPartyMemberEditor
        member={member}
        isDragging={isDragging}
        dragHandle={{ ref: setActivatorNodeRef, attributes, listeners }}
        {...props}
      />
    </div>
  );
};

/**
 * Props
 *   settings, onSettingChange(field, value) — partyShowOnInvitation / partyGroupBySide
 *   members, setMembers(nextArray)
 *   loaded          false if the invitation couldn't be loaded (editing locked)
 *   errors          { [memberId]: { name?, role?, ... } } from the parent's validation
 *   onClearError(memberId, field)
 *   contactsStatus, onRetryContacts — private contact details (see useWeddingPartyContacts)
 *   progressByKey   { [localId]: percent } while saving
 *   disabled        true while saving
 */
const WeddingPartyPanel = ({
  settings, onSettingChange, members, setMembers, loaded = true, errors = {}, onClearError,
  contactsStatus = "ready", onRetryContacts, progressByKey = {}, disabled = false,
}) => {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null); // memberId
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const show = settings.partyShowOnInvitation !== false;
  const groupBySide = settings.partyGroupBySide === true;
  const locked = disabled || !loaded;
  const atMax = members.length >= MAX_PARTY_MEMBERS;

  const indexOf = (id) => members.findIndex(m => m.id === id);
  const nameOf = (id) => {
    const m = members.find(x => x.id === id);
    return m?.name.trim() || `member ${indexOf(id) + 1}`;
  };

  const updateMember = (id, field, value) => {
    setMembers(members.map(m => (m.id === id ? updatePartyMember(m, field, value) : m)));
    onClearError?.(id, field);
    if (field === "role") onClearError?.(id, "customRole");
  };

  const setPhoto = (id, photo) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    releaseIfReplaced(member.photo, photo);
    setMembers(members.map(m => (m.id === id ? { ...m, photo } : m)));
  };

  const move = (from, to) => {
    const next = moveItem(members, from, to);
    if (next === members) return;
    setMembers(next);
    setAnnouncement(`${nameOf(members[from].id)} moved to position ${to + 1} of ${members.length}.`);
  };

  const addMember = () => {
    if (atMax) return;
    setMembers([...members, createPartyMember()]);
    setAnnouncement(`Member ${members.length + 1} added.`);
  };

  const deleteMember = (id) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    releasePhoto(member.photo);
    setMembers(members.filter(m => m.id !== id));
    setAnnouncement("Member removed.");
  };

  const requestDelete = (id) => {
    const member = members.find(m => m.id === id);
    if (member && isPartyMemberBlank(member)) deleteMember(id);
    else setPendingDelete(id);
  };

  const toggleCollapsed = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(indexOf(active.id), indexOf(over.id));
  };

  const accessibility = {
    screenReaderInstructions: {
      draggable: "To reorder, press Space to pick up the member, use the arrow keys to move, then press Space again to drop. Press Escape to cancel. You can also use the Move up and Move down buttons.",
    },
    announcements: {
      onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
      onDragOver: ({ active, over }) => over ? `${nameOf(active.id)} is over position ${indexOf(over.id) + 1}.` : undefined,
      onDragEnd: ({ active, over }) => over ? `Dropped ${nameOf(active.id)} at position ${indexOf(over.id) + 1}.` : "Dropped.",
      onDragCancel: ({ active }) => `Cancelled moving ${nameOf(active.id)}.`,
    },
  };

  const sectionHeading = "text-xs font-bold tracking-widest uppercase mb-4";

  return (
    <div className="space-y-8 min-w-0">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {/* Section settings */}
      <div>
        <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>Section</h3>
        <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: BUILDER_UI.surfaceContainer }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Show Wedding Party on invitation</p>
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Optional — appears once you add a member. Hidden members stay saved.
              </p>
            </div>
            <PartyToggle checked={show} disabled={locked} label="Show Wedding Party on invitation"
              onChange={v => onSettingChange("partyShowOnInvitation", v)} />
          </div>
          <div className="flex items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: BUILDER_UI.outline }}>
            <div>
              <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>Group by side</p>
              <p className="text-xs" style={{ color: BUILDER_UI.onSurfaceVar }}>
                Show Bride's Party, Groom's Party and Other separately. Off shows one combined group.
              </p>
            </div>
            <PartyToggle checked={groupBySide} disabled={locked || !show} label="Group wedding party by side"
              onChange={v => onSettingChange("partyGroupBySide", v)} />
          </div>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className={sectionHeading} style={{ color: BUILDER_UI.onSurfaceVar }}>
          Members {members.length > 0 && <span className="normal-case tracking-normal font-normal">({members.length})</span>}
        </h3>

        {!loaded && (
          <div className="flex items-center gap-2 p-4 rounded-lg mb-4 text-sm" role="alert"
            style={{ backgroundColor: BUILDER_UI.selected, color: BUILDER_UI.onSurface }}>
            <AlertCircle size={16} className="flex-shrink-0" style={{ color: ERROR_COLOR }} />
            Your invitation couldn't be loaded, so the wedding party can't be edited right now. Refresh the page to try again.
          </div>
        )}

        {loaded && members.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg border-2 border-dashed mb-4"
            style={{ borderColor: BUILDER_UI.outline, backgroundColor: BUILDER_UI.surfaceHigh }}>
            <Users size={24} className="mb-2" style={{ color: BUILDER_UI.onSurfaceVar }} />
            <p className="text-sm font-bold" style={{ color: BUILDER_UI.onSurface }}>No wedding party members yet</p>
            <p className="text-xs mt-1" style={{ color: BUILDER_UI.onSurfaceVar }}>
              Introduce your maid of honor, best man, bridesmaids and groomsmen — or skip this; it's optional.
            </p>
          </div>
        )}

        {loaded && members.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
            <SortableContext items={members.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 mb-4">
                {members.map((member, i) => (
                  <SortableMember
                    key={member.id}
                    member={member}
                    index={i}
                    total={members.length}
                    errors={errors[member.id]}
                    disabled={locked}
                    contactsStatus={contactsStatus}
                    onRetryContacts={onRetryContacts}
                    collapsed={collapsed.has(member.id) && !errors[member.id]}
                    onToggleCollapsed={() => toggleCollapsed(member.id)}
                    onFieldChange={(field, value) => updateMember(member.id, field, value)}
                    onPhotoChange={photo => setPhoto(member.id, photo)}
                    onPointOfContactChange={on => setMembers(setPointOfContact(members, member.id, on))}
                    onMoveUp={() => move(i, i - 1)}
                    onMoveDown={() => move(i, i + 1)}
                    onDelete={() => requestDelete(member.id)}
                    progress={member.photo?.pending ? progressByKey[member.photo.localId] : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <button type="button" onClick={addMember} disabled={locked || atMax}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-widest disabled:opacity-60"
          style={{ backgroundColor: BUILDER_UI.primary, color: "#FFFFFF" }}>
          <Plus size={15} /> Add Member
        </button>
        <p className="text-xs mt-3" style={{ color: BUILDER_UI.onSurfaceVar }}>
          {atMax
            ? `You've reached the limit of ${MAX_PARTY_MEMBERS} members.`
            : "Name and role are required for each member. Changes and photos are saved when you click Save; empty members are removed on save."}
        </p>
      </div>

      {/* Confirm: delete a member that has details */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete ? nameOf(pendingDelete) : "member"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their details and photo will be removed from your wedding party when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDelete) deleteMember(pendingDelete); setPendingDelete(null); }}>
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WeddingPartyPanel;
