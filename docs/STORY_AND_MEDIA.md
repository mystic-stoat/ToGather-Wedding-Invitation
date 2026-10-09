# Our Story, Hero Photo & photo storage

How the Invitation Builder stores photos (Hero Photo + Our Story), how the
per-wedding quota works, what the security rules enforce, and what is still
client-side only.

## Where things live

| What | Where |
|---|---|
| Photo files | Cloud Storage: `weddings/{weddingId}/hero/{fileId}.webp` and `weddings/{weddingId}/story/{entryId}/{fileId}.webp` |
| Hero reference | `invitations/{weddingId}.heroImage = { path, url, width, height, bytes, contentType } \| null` |
| Story section settings | `invitations/{weddingId}.storyTitle`, `.storyShowOnInvitation` |
| Story blocks | `invitations/{weddingId}/storyEntries/{entryId} = { id, layout, title, description, images[], order, createdAt, updatedAt }` |
| Photo bookkeeping | `invitations/{weddingId}.mediaBytesUsed`, `.mediaPendingDeletes = [{ path, bytes }]` |

No image data or base64 is ever written to Firestore. Every upload gets a new
random file name, so a file path is used by exactly one place (the hero OR one
story slot) and deleting it can't break anything else.

Legacy data: the removed Layout tab's `layoutStyle` field is left untouched in
existing invitation documents. Nothing is migrated or deleted.

## Code map

| File | Role |
|---|---|
| `src/lib/mediaConfig.js` | Limits: 5 MB per original photo, 100 MB per wedding, formats, resize size |
| `src/lib/imageProcessing.js` | Validate (real file signature + size), resize to ≤1600 px, re-encode WebP/JPEG (strips EXIF/GPS) |
| `src/lib/mediaStorage.js` | Upload with progress, safe delete (only inside the wedding's folder) |
| `src/lib/storyBlocks.js` | Pure helpers: six layouts, layout switching, reordering, diffing |
| `src/lib/storyStore.js` | Firestore: progressive Story loading, atomic batched saves |
| `src/lib/storySave.js` | The Save pipeline (below) |
| `src/hooks/useInvitationMedia.js` | Builder state + wiring for Hero/Story |
| `src/components/invitation/*` | Hero field, Story editor, layout picker, preview section |

## Photo position & zoom ("Adjust")

Every Hero and Story photo can be repositioned (drag, mouse or touch) and
zoomed (slider, 100–300%) inside its frame. Reset centers it again. Stored on
the photo object as `adjust: { x, y, zoom }`:

- `x`, `y` (0–100): the point of the photo, in % of its size, that is pinned
  to the same % position of the frame.
- `zoom` (1–3): 1 means the photo just covers the frame.

It's rendered everywhere with the same CSS (`photoImageStyle()` in
`src/lib/photoAdjust.js`):

```css
object-fit: cover; object-position: x% y%;
transform: scale(zoom); transform-origin: x% y%;
```

- **Frames match exactly.** Editor frames use the same aspect ratio as the
  invitation frames: hero 67:48 (268 × 192), Story 4:5 / 3:2 / 1:1, and the
  collage's tall photo about 8:11. So the editor and the invitation preview
  show the identical crop at any size.
- **Other frame shapes.** In a differently shaped frame (very narrow screens,
  or a collage rebalanced because of empty slots), the chosen focal point
  stays in view.
- **No gaps.** The photo always covers its frame at any position or zoom.
- **What's stored.** `adjust` is written only when it isn't the default, so
  untouched photos keep their original shape. Reset + Save removes it.
- **No re-upload.** Changing only the position or zoom never re-uploads or
  deletes the file; it's a Firestore update on Save.
- **Replacing a photo** starts the new one centered.
- **Rules.** `firestore.rules` validates `adjust` on Story photos (x/y 0–100,
  zoom 1–3, no other keys). Storage rules are unchanged: files never change.

## Save pipeline (photos upload when the couple clicks Save)

1. **Plan.** Empty blocks are dropped. Photos hidden by a layout change are
   not uploaded (the couple was warned).
2. **Quota check, before any upload.** Photos are compressed when picked, so
   their final sizes are known. If the result would exceed 100 MB, Save stops.
3. **Upload** new photos (2 at a time) with progress. If any upload fails, the
   files uploaded in this attempt are deleted again and nothing is written.
4. **Commit one Firestore batch:** story entries (only changed ones) +
   `heroImage` + `mediaBytesUsed` + `mediaPendingDeletes`. On failure, this
   attempt's uploads are deleted and the old files are left alone.
5. **Delete replaced/removed files**, only after the commit succeeded.

The invitation's other fields (title, colors, music, travel, `storyTitle`…)
are saved first through the existing `saveInvitation`. If the photo step
fails, the couple sees "Your other changes were saved…" and all local edits
stay on screen so they can click Save again.

## How `mediaBytesUsed` stays accurate

The counter is never adjusted with +/−. Every save recomputes it from
committed data:

```
mediaBytesUsed = bytes of all photos referenced by heroImage + storyEntries
               + bytes of files listed in mediaPendingDeletes
```

| Situation | Effect |
|---|---|
| Upload fails | This attempt's uploads are deleted. No Firestore write, so the counter is unchanged. |
| Firestore commit fails | Same. Old files stay referenced and counted. |
| Photo replaced | New file counted after the commit. The old file stays counted (in `mediaPendingDeletes`) until it is actually deleted. |
| Delete fails | File stays in `mediaPendingDeletes` and keeps counting. Retried on the next save and when the builder opens. |
| Cleanup of a failed attempt also fails | The leftover is added to `mediaPendingDeletes` (if Firestore is reachable). |
| Counter wrong for any reason | Fixed on the next save, which recomputes it. |

## Known limitations (client-side quota enforcement)

- **Closed tab or lost connection mid-save.** If this happens after a file
  uploaded but before the Firestore commit, the file is in Storage but not
  recorded anywhere. The counter is then lower than the bucket's real usage,
  and the file is never cleaned up.
- **Modified client code.** A user who edits the browser code can skip the
  quota check or write a false `mediaBytesUsed`. The invitation document's
  rules only check ownership, not this field.
- **What the rules do enforce:** only the owner can upload/delete; each file
  must be ≤5 MB and JPEG/PNG/WebP; files can't be overwritten; story entries
  are shape-checked and may only reference files in their own folder.
  Security rules **cannot** add up a wedding's total usage.
- **Download URLs are bearer links.** Anyone who has a photo's download URL
  can view it, regardless of Storage rules. Story URLs are only handed out
  through `storyEntries`, which stay private until the invitation is
  published. The Hero URL lives on the invitation document, which is publicly
  readable by the existing rules (the public RSVP page needs it). Once a URL
  has been seen, unpublishing doesn't revoke it; deleting the file does.
- **Firestore reads from Storage rules.** Each upload/download/delete that
  hits Storage rules does a `firestore.get()` of the invitation, which is a
  billed Firestore read.

## Secure server-side enforcement (future work)

1. **Authoritative usage counter.** Add Cloud Functions on Storage
   `onObjectFinalized` / `onObjectDeleted` for `weddings/{weddingId}/**`.
   They update a server-only field (for example `media/{weddingId}.bytesUsed`,
   with client writes denied in rules) in a transaction. If a new file would
   push the wedding over quota, the function deletes it immediately.
2. **Orphan sweep.** Add a scheduled function (for example nightly) that
   lists each wedding's folder and deletes files not referenced by
   `heroImage`/`storyEntries` and older than ~24 h. This covers closed tabs
   and lost connections.
3. **Optional upload tickets.** A callable function that checks the quota and
   returns allowed paths before the client uploads. Combined with (1), this
   rejects over-quota uploads up front.
4. Keep the client-side checks for instant feedback.

These need deploying functions (Blaze is already enabled) and should be
reviewed for cost: function invocations and Storage list operations.

## Firebase setup checklist

- Storage bucket: `togather-64b0b.firebasestorage.app` (already enabled, Blaze).
- Deploy rules **only when the team is ready**:
  `firebase deploy --only firestore:rules,storage`.
  On the first Storage rules deploy, the CLI asks to grant Storage permission
  to read Firestore (needed for the ownership checks). Accept it.
- Budget alerts: a billing admin (team lead) should set a budget plus alerts
  in Google Cloud Billing. Alerts notify; they do not cap spending.
- Local development: `npm run start:emulators` now also starts the Storage
  emulator (port 9199). Set `VITE_RUN_EMULATOR_MODE=true` in `.env` to point
  the app at the emulators.
