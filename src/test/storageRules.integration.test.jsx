// Integration tests for storage.rules (Hero Photo + Our Story photos).
// Requires the Firestore AND Storage emulators (storage rules read the
// invitation owner from Firestore). They are started automatically on separate
// ports by firebase.test.json — never the development emulators:
//   npm run test:integration:storage
import fs from 'fs';
import { requireIsolatedEmulators } from './isolatedEmulators';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';

// Isolated test emulators only — this throws before any test, clearFirestore()
// or bucket clean-up runs if they aren't in use.
const EMULATORS = requireIsolatedEmulators(['firestore', 'storage']);
const PROJECT_ID = EMULATORS.projectId;
const STORAGE_BUCKET = 'togather-64b0b.firebasestorage.app';
const DRAFT = 'wedding-draft';
const LIVE = 'wedding-live';
const MB = 1024 * 1024;

let testEnv;

// testEnv.clearStorage() can't be used here: it only lists the TOP LEVEL of the
// DEFAULT bucket (gs://<projectId>), so it never deleted anything under
// weddings/... in togather-64b0b.firebasestorage.app. Files from earlier runs
// (also kept by --export-on-exit / --import) then made "new" uploads into
// overwrites. This empties our bucket recursively, with rules disabled.
async function deleteFolder(folderRef) {
  const { items, prefixes } = await listAll(folderRef);
  await Promise.all(items.map((item) => deleteObject(item)));
  await Promise.all(prefixes.map((prefix) => deleteFolder(prefix)));
}

const clearTestBucket = () =>
  testEnv.withSecurityRulesDisabled((ctx) => deleteFolder(ref(ctx.storage(STORAGE_BUCKET))));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), ...EMULATORS.firestore },
    storage: { rules: fs.readFileSync('storage.rules', 'utf8'), ...EMULATORS.storage },
  });
}, 30000);

beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearTestBucket();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `invitations/${DRAFT}`), { userId: 'alice-uid', isPublished: false });
    await setDoc(doc(ctx.firestore(), `invitations/${LIVE}`), { userId: 'alice-uid', isPublished: true });
    const bytes = new Uint8Array([1, 2, 3]);
    try {
      await uploadBytes(
        ref(ctx.storage(STORAGE_BUCKET), `weddings/${DRAFT}/story/e1/existing.webp`),
        bytes,
        { contentType: 'image/webp' }
      );
    } catch (error) {
      console.error('STORAGE DEBUG:', {
        code: error.code,
        message: error.message,
        serverResponse: error.customData?.serverResponse,
        customData: error.customData,
      });
      throw error;
    }
    await uploadBytes(ref(ctx.storage(STORAGE_BUCKET), `weddings/${LIVE}/hero/existing.webp`), bytes, { contentType: 'image/webp' });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

const img = (size = 1024) => new Uint8Array(size);
const put = (ctx, path, data = img(), contentType = 'image/webp') =>
  uploadBytes(ref(ctx.storage(STORAGE_BUCKET), path), data, { contentType });

describe('storage.rules — uploads', () => {
  it('lets the owner upload hero and story photos', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(put(alice, `weddings/${DRAFT}/hero/abc-1.webp`));
    await assertSucceeds(put(alice, `weddings/${DRAFT}/story/e1/abc-2.jpg`, img(), 'image/jpeg'));
    await assertSucceeds(put(alice, `weddings/${DRAFT}/story/e2/abc-3.png`, img(), 'image/png'));
  });

  it('rejects uploads from other users and signed-out visitors', async () => {
    await assertFails(put(testEnv.authenticatedContext('bob-uid'), `weddings/${DRAFT}/hero/x.webp`));
    await assertFails(put(testEnv.unauthenticatedContext(), `weddings/${DRAFT}/hero/x.webp`));
  });

  it('rejects files over 5 MB, non-image types and odd file names', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertFails(put(alice, `weddings/${DRAFT}/hero/big.webp`, img(5 * MB + 1)));
    await assertFails(put(alice, `weddings/${DRAFT}/hero/anim.webp`, img(), 'image/gif'));
    await assertFails(put(alice, `weddings/${DRAFT}/hero/page.html`, img(), 'image/webp'));
  });

  it('never overwrites an existing file', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const path = `weddings/${DRAFT}/story/e1/existing.webp`;

    // Verify the original file exists before testing an overwrite.
    const existing = await getBytes(
      ref(alice.storage(STORAGE_BUCKET), path)
    );
    expect(existing.byteLength).toBe(3);

    // Uploading to the same path should be rejected.
    await assertFails(put(alice, path));
  });

  it('rejects uploads for a wedding that does not exist and outside /weddings', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertFails(put(alice, `weddings/no-such-wedding/hero/x.webp`));
    await assertFails(put(alice, `uploads/x.webp`));
  });
});

describe('storage.rules — reading', () => {
  it('keeps unpublished photos private', async () => {
    await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(STORAGE_BUCKET), `weddings/${DRAFT}/story/e1/existing.webp`)));
    await assertFails(getBytes(ref(testEnv.authenticatedContext('bob-uid').storage(STORAGE_BUCKET), `weddings/${DRAFT}/story/e1/existing.webp`)));
    await assertSucceeds(getBytes(ref(testEnv.authenticatedContext('alice-uid').storage(STORAGE_BUCKET), `weddings/${DRAFT}/story/e1/existing.webp`)));
  });

  it('lets guests view photos of a published invitation', async () => {
    await assertSucceeds(getBytes(ref(testEnv.unauthenticatedContext().storage(STORAGE_BUCKET), `weddings/${LIVE}/hero/existing.webp`)));
  });
});

describe('storage.rules — deleting', () => {
  it('only the owner can delete', async () => {
    const path = `weddings/${DRAFT}/story/e1/existing.webp`;
    await assertFails(deleteObject(ref(testEnv.authenticatedContext('bob-uid').storage(STORAGE_BUCKET), path)));
    await assertFails(deleteObject(ref(testEnv.unauthenticatedContext().storage(STORAGE_BUCKET), path)));
    await assertSucceeds(deleteObject(ref(testEnv.authenticatedContext('alice-uid').storage(STORAGE_BUCKET), path)));
  });
});

describe('storage.rules — Wedding Party photos', () => {
  it('lets only the owner upload valid member photos', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(put(alice, `weddings/${DRAFT}/party/m1/abc-1.webp`));
    await assertSucceeds(put(alice, `weddings/${DRAFT}/party/m2/abc-2.jpg`, img(), 'image/jpeg'));
    await assertFails(put(testEnv.authenticatedContext('bob-uid'), `weddings/${DRAFT}/party/m1/x.webp`));
    await assertFails(put(testEnv.unauthenticatedContext(), `weddings/${DRAFT}/party/m1/x.webp`));
    await assertFails(put(alice, `weddings/${DRAFT}/party/m1/big.webp`, img(5 * MB + 1)));
    await assertFails(put(alice, `weddings/${DRAFT}/party/m1/anim.webp`, img(), 'image/gif'));
  });

  it('keeps member photos private until published, and only the owner deletes', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(put(alice, `weddings/${DRAFT}/party/m1/p.webp`));
    await assertSucceeds(put(alice, `weddings/${LIVE}/party/m1/p.webp`));
    const anon = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(anon.storage(STORAGE_BUCKET), `weddings/${DRAFT}/party/m1/p.webp`)));
    await assertSucceeds(getBytes(ref(anon.storage(STORAGE_BUCKET), `weddings/${LIVE}/party/m1/p.webp`)));
    await assertFails(deleteObject(ref(testEnv.authenticatedContext('bob-uid').storage(STORAGE_BUCKET), `weddings/${DRAFT}/party/m1/p.webp`)));
    await assertSucceeds(deleteObject(ref(alice.storage(STORAGE_BUCKET), `weddings/${DRAFT}/party/m1/p.webp`)));
  });
});
