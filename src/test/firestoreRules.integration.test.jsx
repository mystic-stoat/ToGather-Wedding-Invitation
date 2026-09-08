import fs from 'fs';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { beforeAll, afterEach, afterAll, describe, it } from 'vitest';

const PROJECT_ID = 'togather-64b0b'; // match .firebaserc

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterEach(async () => {
  // Wipe Firestore data between tests so one test's writes can't
  // leak into another's assertions
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Helper: seed data by bypassing rules entirely — the seeding itself
// isn't under test, only the read/write calls inside each `it` are
async function seed(setupFn) {
  await testEnv.withSecurityRulesDisabled(setupFn);
}

describe('Firestore Security Rules — rsvp collection', () => {
  it('allows a user to read their own RSVP', async () => {
    await seed(async (context) => {
      await setDoc(doc(context.firestore(), 'rsvp/rsvp1'), { userId: 'alice-uid' });
    });

    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(getDoc(doc(alice.firestore(), 'rsvp/rsvp1')));
  });

  it('rejects a user reading someone else\'s RSVP', async () => {
    await seed(async (context) => {
      await setDoc(doc(context.firestore(), 'rsvp/rsvp1'), { userId: 'alice-uid' });
    });

    const bob = testEnv.authenticatedContext('bob-uid');
    await assertFails(getDoc(doc(bob.firestore(), 'rsvp/rsvp1')));
  });

  it('rejects an unauthenticated user reading any RSVP', async () => {
    await seed(async (context) => {
      await setDoc(doc(context.firestore(), 'rsvp/rsvp1'), { userId: 'alice-uid' });
    });

    const anon = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), 'rsvp/rsvp1')));
  });

  it('rejects writes to an unmatched/unknown collection (default-deny)', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertFails(setDoc(doc(alice.firestore(), 'randomCollection/doc1'), { foo: 'bar' }));
  });
});