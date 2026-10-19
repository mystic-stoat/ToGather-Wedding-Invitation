//Tests for new rules
//Testing new tests

import fs from 'fs';
import { requireIsolatedEmulators } from './isolatedEmulators';

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import {
  normalizeThemeSettings,
  applyColorPreset,
  applyFontPair,
} from '@/lib/invitationTheme';

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

import {
  beforeAll,
  afterEach,
  afterAll,
  describe,
  it,
} from 'vitest';


// Isolated test emulators only (npm run test:integration:firestore) — this
// throws before any test or clearFirestore() runs if they aren't in use.
const EMULATORS = requireIsolatedEmulators(['firestore']);
const PROJECT_ID = EMULATORS.projectId;


let testEnv;


beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: EMULATORS.firestore.host,
        port: EMULATORS.firestore.port,
      },
    });

    console.log('Firestore test environment initialized');
  } catch (error) {
    console.error('Firestore initialization failed:', error);
    throw error;
  }
}, 30000); //error checks for fetching the port


afterEach(async () => {
  await testEnv.clearFirestore();
});


afterAll(async () => {
  await testEnv.cleanup();
});


/*
 * Seed data while bypassing security rules.
 */
async function seed(setupFn) {
  await testEnv.withSecurityRulesDisabled(setupFn);
}


/*
 * ============================================================
 * TEST DATA
 * ============================================================
 */

const invitationAlice = {
  userId: 'alice-uid',
  names: 'Alice and Alex',
  location: 'Dallas',
  date: '2026-12-01',
  time: '18:00',
  published: true,
};


const invitationBob = {
  userId: 'bob-uid',
  names: 'Bob and Beth',
  location: 'Austin',
  date: '2026-12-10',
  time: '18:00',
  published: true,
};


const inviteeAlice = {
  guestName: 'John Doe',
  email: 'john@example.com',
  group: 'Family',

  weddingId: 'wedding-alice',

  plusOneLimit: 2,

  token: 'alice-secret-token',
  tokenUsed: false,

  rsvpStatus: 'Pending',
  attending: false,
  guestCount: 0,
  dietaryRestrictions: '',
  plusOnes: [],
};


const inviteeBob = {
  guestName: 'Jane Doe',
  email: 'jane@example.com',
  group: 'Friends',

  weddingId: 'wedding-bob',

  plusOneLimit: 1,

  token: 'bob-secret-token',
  tokenUsed: false,

  rsvpStatus: 'Pending',
  attending: false,
  guestCount: 0,
  dietaryRestrictions: '',
  plusOnes: [],
};


/*
 * ============================================================
 * BETROTHED TESTS
 * ============================================================
 */

describe('betrothed security rules', () => {

  it('allows a user to read their own profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      getDoc(doc(alice.firestore(), 'betrothed/alice-uid'))
    );
  });


  it('rejects a user reading another user profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      getDoc(doc(bob.firestore(), 'betrothed/alice-uid'))
    );
  });


  it('rejects unauthenticated profile access', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      getDoc(doc(anon.firestore(), 'betrothed/alice-uid'))
    );
  });


  it('allows a user to create their own profile', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      setDoc(
        doc(alice.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      )
    );
  });


  it('rejects creating a profile for another user', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertFails(
      setDoc(
        doc(alice.firestore(), 'betrothed/bob-uid'),
        {
          name: 'Bob',
        }
      )
    );
  });


  it('allows a user to update their own profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      updateDoc(
        doc(alice.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice Updated',
        }
      )
    );
  });


  it('rejects another user from updating the profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      updateDoc(
        doc(bob.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Hacked',
        }
      )
    );
  });


  it('allows a user to delete their own profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      deleteDoc(
        doc(alice.firestore(), 'betrothed/alice-uid')
      )
    );
  });


  it('rejects another user from deleting the profile', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'betrothed/alice-uid'),
        {
          name: 'Alice',
        }
      );
    });

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      deleteDoc(
        doc(bob.firestore(), 'betrothed/alice-uid')
      )
    );
  });
});


/*
 * ============================================================
 * INVITATION TESTS
 * ============================================================
 */

describe('invitation security rules', () => {

  beforeEach(async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'invitations/wedding-alice'),
        invitationAlice
      );

      await setDoc(
        doc(context.firestore(), 'invitations/wedding-bob'),
        invitationBob
      );
    });
  });


  it('allows public users to read an invitation', async () => {
    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      getDoc(
        doc(anon.firestore(), 'invitations/wedding-alice')
      )
    );
  });


  it('allows the owner to update their invitation', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      updateDoc(
        doc(alice.firestore(), 'invitations/wedding-alice'),
        {
          location: 'Fort Worth',
        }
      )
    );
  });


  it('rejects another user from updating an invitation', async () => {
    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      updateDoc(
        doc(bob.firestore(), 'invitations/wedding-alice'),
        {
          location: 'Hacked',
        }
      )
    );
  });


  it('allows the owner to delete their invitation', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      deleteDoc(
        doc(alice.firestore(), 'invitations/wedding-alice')
      )
    );
  });


  it('rejects another user from deleting an invitation', async () => {
    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      deleteDoc(
        doc(bob.firestore(), 'invitations/wedding-alice')
      )
    );
  });


  it('allows a user to create their own invitation', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      setDoc(
        doc(alice.firestore(), 'invitations/wedding-new'),
        {
          userId: 'alice-uid',
        }
      )
    );
  });


  it('rejects a user from creating an invitation owned by someone else', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertFails(
      setDoc(
        doc(alice.firestore(), 'invitations/wedding-hacked'),
        {
          userId: 'bob-uid',
        }
      )
    );
  });
});


/*
 * ============================================================
 * INVITEE TEST HELPERS
 * ============================================================
 */

async function seedInvitees() {
  await seed(async (context) => {

    await setDoc(
      doc(context.firestore(), 'invitations/wedding-alice'),
      invitationAlice
    );

    await setDoc(
      doc(context.firestore(), 'invitations/wedding-bob'),
      invitationBob
    );

    await setDoc(
      doc(context.firestore(), 'invitee/invitee-alice'),
      inviteeAlice
    );

    await setDoc(
      doc(context.firestore(), 'invitee/invitee-bob'),
      inviteeBob
    );
  });
}


/*
 * ============================================================
 * INVITEE READ TESTS
 * ============================================================
 */

describe('invitee read security', () => {

  it('allows unauthenticated users to read an invitee', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      getDoc(
        doc(anon.firestore(), 'invitee/invitee-alice')
      )
    );
  });


  it('allows an authenticated user to read an invitee', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertSucceeds(
      getDoc(
        doc(bob.firestore(), 'invitee/invitee-alice')
      )
    );
  });
});


/*
 * ============================================================
 * INVITEE CREATE TESTS
 * ============================================================
 */

describe('invitee create security', () => {

  it('allows the wedding host to create an invitee', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      setDoc(
        doc(alice.firestore(), 'invitee/new-invitee'),
        {
          ...inviteeAlice,
          guestName: 'New Guest',
        }
      )
    );
  });


  it('rejects a non-host from creating an invitee for the wedding', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      setDoc(
        doc(bob.firestore(), 'invitee/hacked-invitee'),
        {
          ...inviteeAlice,
          guestName: 'Hacked Guest',
        }
      )
    );
  });


  it('rejects an unauthenticated user from creating an invitee', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      setDoc(
        doc(anon.firestore(), 'invitee/hacked-invitee'),
        inviteeAlice
      )
    );
  });


  it('rejects a host from creating an invitee for a nonexistent wedding', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertFails(
      setDoc(
        doc(alice.firestore(), 'invitee/orphan'),
        {
          ...inviteeAlice,
          weddingId: 'does-not-exist',
        }
      )
    );
  });
});


/*
 * ============================================================
 * INVITEE HOST UPDATE/DELETE TESTS
 * ============================================================
 */

describe('invitee host management', () => {

  it('allows the wedding host to update an invitee', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      updateDoc(
        doc(alice.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'Updated Guest',
        }
      )
    );
  });


  it('rejects another wedding host from updating the invitee', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      updateDoc(
        doc(bob.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'Hacked Guest',
        }
      )
    );
  });


  it('rejects an unauthenticated user from updating an invitee', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'Hacked Guest',
        }
      )
    );
  });


  it('allows the wedding host to delete an invitee', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      deleteDoc(
        doc(alice.firestore(), 'invitee/invitee-alice')
      )
    );
  });


  it('rejects another wedding host from deleting an invitee', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      deleteDoc(
        doc(bob.firestore(), 'invitee/invitee-alice')
      )
    );
  });


  it('rejects an unauthenticated user from deleting an invitee', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      deleteDoc(
        doc(anon.firestore(), 'invitee/invitee-alice')
      )
    );
  });
});


/*
 * ============================================================
 * RSVP UPDATE TESTS
 * ============================================================
 */

describe('invitee RSVP security', () => {

  it('allows a guest to submit a valid RSVP', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 2,
          dietaryRestrictions: 'Vegetarian',
          plusOnes: [
            {
              name: 'Jane Doe',
              meal: 'Vegetarian',
            },
          ],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP with an incorrect token', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          token: 'WRONG-TOKEN',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP that changes the weddingId', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          weddingId: 'wedding-bob',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP that changes the token', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          token: 'NEW-TOKEN',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP that leaves tokenUsed false', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: false,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects reusing an RSVP token after it was used', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'invitations/wedding-alice'),
        invitationAlice
      );

      await setDoc(
        doc(context.firestore(), 'invitee/invitee-alice'),
        {
          ...inviteeAlice,
          tokenUsed: true,
        }
      );
    });

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: false,
          guestCount: 0,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Declined',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  // A guest may correct their own name/email, but ONLY as part of the
  // one-time RSVP submission (tokenUsed false -> true) and with valid values.
  const rsvpBase = {
    attending: true,
    guestCount: 1,
    dietaryRestrictions: '',
    plusOnes: [],
    rsvpStatus: 'Accepted',
    tokenUsed: true,
  };

  it('allows a guest to update guestName and email during their RSVP', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          ...rsvpBase,
          guestName: 'Johnny Doe',
          email: 'johnny@example.com',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest RSVP that sets an empty guestName', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          ...rsvpBase,
          guestName: '',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest RSVP that sets a non-string guestName', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          ...rsvpBase,
          guestName: 12345,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest RSVP that sets an invalid email', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          ...rsvpBase,
          email: 'not-an-email',
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest changing guestName/email outside an RSVP (no tokenUsed flip)', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'HACKED NAME',
          email: 'attacker@example.com',
        }
      )
    );
  });


  it('rejects a guest changing guestName/email after the token was used', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'invitations/wedding-alice'),
        invitationAlice
      );
      await setDoc(
        doc(context.firestore(), 'invitee/invitee-alice'),
        { ...inviteeAlice, tokenUsed: true, rsvpStatus: 'Accepted', attending: true }
      );
    });

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'HACKED NAME',
          email: 'attacker@example.com',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest from changing plusOneLimit', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          plusOneLimit: 100,
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest from changing rsvpStatus to an invalid value', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          plusOnes: [],
          rsvpStatus: 'HACKED',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest from changing tokenUsed back to false', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'invitations/wedding-alice'),
        invitationAlice
      );

      await setDoc(
        doc(context.firestore(), 'invitee/invitee-alice'),
        {
          ...inviteeAlice,
          tokenUsed: true,
        }
      );
    });

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          tokenUsed: false,
        }
      )
    );
  });


  it('rejects an unauthenticated user from modifying an invitee with no valid RSVP', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'Hacked',
        }
      )
    );
  });
});


/*
 * ============================================================
 * RSVP MEAL / DIETARY FIELDS
 * ============================================================
 *
 * Main guest:  mealId + meal (name snapshot) + dietaryRestrictions
 * Plus-ones:   [{ name, mealId, meal, dietaryRestrictions }]
 */

describe('invitee RSVP meal fields', () => {

  it('allows an RSVP with a main-guest meal and full plus-one details', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 2,
          dietaryRestrictions: 'Peanut allergy',
          mealId: 'meal-steak',
          meal: 'Steak',
          plusOnes: [
            {
              name: 'Jane Doe',
              mealId: 'meal-pasta',
              meal: 'Vegan Pasta',
              dietaryRestrictions: 'Gluten-free',
            },
          ],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('allows an RSVP with empty meal fields (wedding has no meal options)', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          mealId: '',
          meal: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('allows a declined RSVP with guestCount 0, no meal and no plus-ones', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: false,
          guestCount: 0,
          dietaryRestrictions: '',
          mealId: '',
          meal: '',
          plusOnes: [],
          rsvpStatus: 'Declined',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP where mealId is not a string', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          mealId: 42,
          meal: 'Steak',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects an RSVP where meal is not a string', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          mealId: 'meal-steak',
          meal: { name: 'Steak' },
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });


  it('rejects a guest RSVP that changes childrenPolicyOverride', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          attending: true,
          guestCount: 1,
          dietaryRestrictions: '',
          mealId: '',
          meal: '',
          plusOnes: [],
          rsvpStatus: 'Accepted',
          tokenUsed: true,
          respondedAt: new Date(),
          childrenPolicyOverride: 'allowed',
        }
      )
    );
  });


  it('rejects reusing a used token even with valid meal fields', async () => {
    await seed(async (context) => {
      await setDoc(
        doc(context.firestore(), 'invitations/wedding-alice'),
        invitationAlice
      );
      await setDoc(
        doc(context.firestore(), 'invitee/invitee-alice'),
        { ...inviteeAlice, tokenUsed: true, rsvpStatus: 'Accepted', attending: true }
      );
    });

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          mealId: 'meal-steak',
          meal: 'Steak',
          tokenUsed: true,
          respondedAt: new Date(),
        }
      )
    );
  });
});


/*
 * ============================================================
 * CHILDREN POLICY + MEAL OPTIONS (host-managed)
 * ============================================================
 */

describe('children policy and meal options', () => {

  it('allows the wedding owner to set childrenPolicy and mealOptions', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      updateDoc(
        doc(alice.firestore(), 'invitations/wedding-alice'),
        {
          childrenPolicy: 'adults_only',
          mealOptions: [
            { id: 'meal-steak', name: 'Steak', description: 'Sirloin with mashed potatoes' },
          ],
        }
      )
    );
  });


  it('rejects another user from changing childrenPolicy', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      updateDoc(
        doc(bob.firestore(), 'invitations/wedding-alice'),
        {
          childrenPolicy: 'allowed',
        }
      )
    );
  });


  it('allows the wedding host to create a guest with childrenPolicyOverride', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      setDoc(
        doc(alice.firestore(), 'invitee/invitee-new'),
        {
          ...inviteeAlice,
          token: 'new-token',
          childrenPolicyOverride: 'allowed',
        }
      )
    );
  });


  it('allows the wedding host to update a guest childrenPolicyOverride', async () => {
    await seedInvitees();

    const alice = testEnv.authenticatedContext('alice-uid');

    await assertSucceeds(
      updateDoc(
        doc(alice.firestore(), 'invitee/invitee-alice'),
        {
          childrenPolicyOverride: 'adults_only',
        }
      )
    );
  });


  it('rejects another wedding host from changing a guest childrenPolicyOverride', async () => {
    await seedInvitees();

    const bob = testEnv.authenticatedContext('bob-uid');

    await assertFails(
      updateDoc(
        doc(bob.firestore(), 'invitee/invitee-alice'),
        {
          childrenPolicyOverride: 'allowed',
        }
      )
    );
  });
});


/*
 * ============================================================
 * DEFAULT DENY
 * ============================================================
 */

describe('wedding assistant proposals', () => {
  const path = 'betrothed/alice-uid/proposals/p1';
  const pending = {
    field: 'venueName',
    oldValue: null,
    newValue: 'The Barn',
    reason: 'they said so',
    status: 'pending',
    messageId: 'm1',
    weddingId: 'wedding-alice',
    decidedAt: null,
  };

  const seedProposal = (data = pending) =>
    seed((context) => setDoc(doc(context.firestore(), path), data));

  it('lets the owner read their own proposal, not someone else\'s', async () => {
    await seedProposal();
    await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext('alice-uid').firestore(), path))
    );
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext('bob-uid').firestore(), path))
    );
  });

  it('never lets the client create or delete a proposal', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(setDoc(doc(alice, 'betrothed/alice-uid/proposals/p2'), pending));
    await seedProposal();
    await assertFails(deleteDoc(doc(alice, path)));
  });

  it('lets the owner accept or reject a pending proposal', async () => {
    await seedProposal();
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(
      updateDoc(doc(alice, path), { status: 'accepted', decidedAt: serverTimestamp() })
    );
  });

  it('rejects changing anything except status and decidedAt', async () => {
    await seedProposal();
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(
      updateDoc(doc(alice, path), {
        status: 'accepted', decidedAt: serverTimestamp(), newValue: 'Somewhere Else',
      })
    );
  });

  it('rejects a made-up status', async () => {
    await seedProposal();
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(
      updateDoc(doc(alice, path), { status: 'pending', decidedAt: serverTimestamp() })
    );
    await assertFails(
      updateDoc(doc(alice, path), { status: 'superseded', decidedAt: serverTimestamp() })
    );
  });

  it('rejects deciding a proposal that is already decided', async () => {
    await seedProposal({ ...pending, status: 'rejected' });
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(
      updateDoc(doc(alice, path), { status: 'accepted', decidedAt: serverTimestamp() })
    );
  });

  it('rejects another user deciding it', async () => {
    await seedProposal();
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    await assertFails(
      updateDoc(doc(bob, path), { status: 'accepted', decidedAt: serverTimestamp() })
    );
  });
});

describe('wedding assistant proposals: access and edge cases', () => {
  const pending = {
    field: 'venueName',
    oldValue: null,
    newValue: 'The Barn',
    reason: 'they said so',
    status: 'pending',
    messageId: 'm1',
    weddingId: 'wedding-alice',
    decidedAt: null,
  };
  const aliceProposal = 'betrothed/alice-uid/proposals/p1';
  const bobProposal = 'betrothed/bob-uid/proposals/p1';

  beforeEach(async () => {
    await seed(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'invitations/wedding-alice'), invitationAlice);
      await setDoc(doc(db, 'invitee/invitee-alice'), inviteeAlice);
      await setDoc(doc(db, aliceProposal), pending);
      await setDoc(doc(db, bobProposal), {
        ...pending, newValue: 'Bob Hall', weddingId: 'wedding-bob',
      });
    });
  });

  it('lets each couple accept their own proposal but not the other couple\'s', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(
      updateDoc(doc(alice, aliceProposal), { status: 'accepted', decidedAt: serverTimestamp() })
    );
    await assertFails(
      updateDoc(doc(alice, bobProposal), { status: 'accepted', decidedAt: serverTimestamp() })
    );
    // Bob's proposal is untouched
    await seed(async (context) => {
      const snap = await getDoc(doc(context.firestore(), bobProposal));
      expect(snap.data().status).toBe('pending');
    });
  });

  it('lets the owner mark a proposal stale', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(
      updateDoc(doc(alice, aliceProposal), { status: 'stale', decidedAt: serverTimestamp() })
    );
  });

  it('rejects a decision whose decidedAt is not the server time', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(
      updateDoc(doc(alice, aliceProposal), { status: 'accepted', decidedAt: new Date(0) })
    );
    await assertFails(updateDoc(doc(alice, aliceProposal), { status: 'accepted' }));
  });

  it('rejects the owner editing the field, reason or ownership of a proposal', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    for (const change of [
      { field: 'venueAddress' },
      { reason: 'rewritten' },
      { weddingId: 'wedding-bob' },
      { messageId: 'other' },
    ]) {
      await assertFails(
        updateDoc(doc(alice, aliceProposal), {
          status: 'accepted', decidedAt: serverTimestamp(), ...change,
        })
      );
    }
  });

  it('lets the owner list their proposals but not another couple\'s', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(getDocs(collection(alice, 'betrothed/alice-uid/proposals')));
    await assertFails(getDocs(collection(alice, 'betrothed/bob-uid/proposals')));
  });

  it('hides proposals from signed-out visitors', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, aliceProposal)));
    await assertFails(getDocs(collection(anon, 'betrothed/alice-uid/proposals')));
    await assertFails(
      updateDoc(doc(anon, aliceProposal), { status: 'accepted', decidedAt: serverTimestamp() })
    );
  });

  it('hides proposals from invitees, who have no couple account', async () => {
    // A guest is either signed out or signed in under their own uid; neither
    // matches the couple's uid.
    for (const ctx of [
      testEnv.unauthenticatedContext(),
      testEnv.authenticatedContext('guest-uid'),
    ]) {
      const db = ctx.firestore();
      await assertFails(getDoc(doc(db, aliceProposal)));
      await assertFails(getDocs(collection(db, 'betrothed/alice-uid/proposals')));
      await assertFails(
        updateDoc(doc(db, aliceProposal), { status: 'accepted', decidedAt: serverTimestamp() })
      );
      await assertFails(deleteDoc(doc(db, aliceProposal)));
    }
  });

  it('never lets anyone create a proposal, even in their own folder', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(alice, 'betrothed/alice-uid/proposals/new'), pending));
    await assertFails(setDoc(doc(alice, 'betrothed/bob-uid/proposals/new'), pending));
    await assertFails(setDoc(doc(anon, 'betrothed/alice-uid/proposals/new'), pending));
  });
});


/*
 * ============================================================
 * WEDDING ASSISTANT CONVERSATION HISTORY
 * ============================================================
 *   betrothed/{uid}/messages/{msgId}
 *   The client may only create "user" messages in its own folder; replies
 *   come from the Cloud Function (admin SDK). Nobody edits a message, and
 *   only the owner reads or deletes (clears the chat).
 */
describe('wedding assistant conversation history', () => {
  const msgPath = 'betrothed/alice-uid/messages/m1';
  const replyPath = 'betrothed/alice-uid/messages/reply-m1';
  const userMessage = (overrides = {}) => ({
    role: 'user',
    content: [{ type: 'text', text: 'Can we move the ceremony to 5pm?' }],
    createdAt: serverTimestamp(),
    status: 'pending',
    ...overrides,
  });

  beforeEach(async () => {
    await seed(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'invitations/wedding-alice'), invitationAlice);
      await setDoc(doc(db, 'invitee/invitee-alice'), inviteeAlice);
      await setDoc(doc(db, msgPath), { ...userMessage(), createdAt: new Date(), status: 'replied' });
      await setDoc(doc(db, replyPath), {
        role: 'assistant',
        content: [{ type: 'text', text: 'Sure, I suggested it below.' }],
        createdAt: new Date(),
        status: 'complete',
      });
    });
  });

  it('lets the owner read and list their own conversation', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(getDoc(doc(alice, msgPath)));
    await assertSucceeds(getDoc(doc(alice, replyPath)));
    await assertSucceeds(getDocs(collection(alice, 'betrothed/alice-uid/messages')));
  });

  it('hides the conversation from other couples, invitees and signed-out visitors', async () => {
    for (const ctx of [
      testEnv.authenticatedContext('bob-uid'),
      testEnv.authenticatedContext('guest-uid'),
      testEnv.unauthenticatedContext(),
    ]) {
      const db = ctx.firestore();
      await assertFails(getDoc(doc(db, msgPath)));
      await assertFails(getDoc(doc(db, replyPath)));
      await assertFails(getDocs(collection(db, 'betrothed/alice-uid/messages')));
    }
  });

  it('lets the owner send a well-formed user message', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(setDoc(doc(alice, 'betrothed/alice-uid/messages/m2'), userMessage()));
  });

  it('rejects the owner forging an assistant message', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(
      setDoc(doc(alice, 'betrothed/alice-uid/messages/m2'), userMessage({ role: 'assistant' }))
    );
    await assertFails(
      setDoc(doc(alice, 'betrothed/alice-uid/messages/m3'), userMessage({ status: 'complete' }))
    );
  });

  it('rejects malformed user messages', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    const path = 'betrothed/alice-uid/messages/bad';
    await assertFails(setDoc(doc(alice, path), userMessage({ extra: 'field' })));
    await assertFails(setDoc(doc(alice, path), userMessage({ createdAt: new Date(0) })));
    await assertFails(
      setDoc(doc(alice, path), userMessage({ content: [{ type: 'text', text: 'x'.repeat(4001) }] }))
    );
    await assertFails(
      setDoc(doc(alice, path), userMessage({
        content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }],
      }))
    );
  });

  it('rejects creating a message in someone else\'s conversation', async () => {
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    const guest = testEnv.authenticatedContext('guest-uid').firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    const path = 'betrothed/alice-uid/messages/m9';
    await assertFails(setDoc(doc(bob, path), userMessage()));
    await assertFails(setDoc(doc(guest, path), userMessage()));
    await assertFails(setDoc(doc(anon, path), userMessage()));
  });

  it('rejects every update to a message, including by the owner', async () => {
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    const guest = testEnv.authenticatedContext('guest-uid').firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(alice, msgPath), { status: 'pending' }));
    await assertFails(
      updateDoc(doc(alice, replyPath), { content: [{ type: 'text', text: 'edited' }] })
    );
    await assertFails(updateDoc(doc(bob, msgPath), { status: 'error' }));
    await assertFails(updateDoc(doc(guest, replyPath), { status: 'error' }));
    await assertFails(updateDoc(doc(anon, msgPath), { status: 'error' }));
  });

  it('lets only the owner delete (clear) their conversation', async () => {
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    const guest = testEnv.authenticatedContext('guest-uid').firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(deleteDoc(doc(bob, msgPath)));
    await assertFails(deleteDoc(doc(guest, replyPath)));
    await assertFails(deleteDoc(doc(anon, msgPath)));

    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertSucceeds(deleteDoc(doc(alice, msgPath)));
  });

  it('leaves the conversation intact after all the rejected attempts', async () => {
    const guest = testEnv.authenticatedContext('guest-uid').firestore();
    await assertFails(deleteDoc(doc(guest, msgPath)));
    await assertFails(updateDoc(doc(guest, msgPath), { status: 'error' }));
    await seed(async (context) => {
      const snap = await getDoc(doc(context.firestore(), msgPath));
      expect(snap.exists()).toBe(true);
      expect(snap.data().status).toBe('replied');
    });
  });
});

describe('default deny behavior', () => {

  it('rejects writes to an unknown collection', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertFails(
      setDoc(
        doc(alice.firestore(), 'randomCollection/doc1'),
        {
          foo: 'bar',
        }
      )
    );
  });


  it('rejects reads from an unknown collection', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');

    await assertFails(
      getDoc(
        doc(alice.firestore(), 'randomCollection/doc1')
      )
    );
  });
});

/*
 * ============================================================
 * OUR STORY ENTRIES
 * ============================================================
 *
 *   /invitations/{weddingId}/storyEntries/{entryId}
 *   - only the owner writes
 *   - private until the invitation is published
 */

describe('storyEntries rules', () => {

  const DRAFT = 'wedding-draft';
  const LIVE = 'wedding-live';

  const photo = (weddingId, entryId, name = 'abc-123.webp') => ({
    path: `weddings/${weddingId}/story/${entryId}/${name}`,
    url: 'https://example.com/photo',
    width: 800,
    height: 1000,
    bytes: 1234,
    contentType: 'image/webp',
  });

  const entry = (weddingId, entryId, overrides = {}) => ({
    id: entryId,
    layout: 'photoLeft',
    title: 'How we met',
    description: 'At UNT.',
    images: [photo(weddingId, entryId)],
    order: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });

  const entryPath = (weddingId, entryId) => `invitations/${weddingId}/storyEntries/${entryId}`;

  beforeEach(async () => {
    await seed(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `invitations/${DRAFT}`), { userId: 'alice-uid', isPublished: false });
      await setDoc(doc(db, `invitations/${LIVE}`), { userId: 'alice-uid', isPublished: true });
      await setDoc(doc(db, entryPath(DRAFT, 'e1')), { ...entry(DRAFT, 'e1'), createdAt: new Date(), updatedAt: new Date() });
      await setDoc(doc(db, entryPath(LIVE, 'e1')), { ...entry(LIVE, 'e1'), createdAt: new Date(), updatedAt: new Date() });
    });
  });

  it('lets the owner create a valid entry', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(setDoc(doc(alice.firestore(), entryPath(DRAFT, 'e2')), entry(DRAFT, 'e2')));
  });

  it('allows text-only and photo-only entries', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(setDoc(doc(alice.firestore(), entryPath(DRAFT, 't1')),
      entry(DRAFT, 't1', { layout: 'textOnly', images: [] })));
    await assertSucceeds(setDoc(doc(alice.firestore(), entryPath(DRAFT, 'c1')),
      entry(DRAFT, 'c1', { layout: 'collage', title: '', description: '',
        images: [photo(DRAFT, 'c1', 'a.webp'), null, photo(DRAFT, 'c1', 'c.jpg')] })));
  });

  it('rejects writes from other users and signed-out visitors', async () => {
    const bob = testEnv.authenticatedContext('bob-uid');
    const anon = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(bob.firestore(), entryPath(DRAFT, 'e3')), entry(DRAFT, 'e3')));
    await assertFails(setDoc(doc(anon.firestore(), entryPath(DRAFT, 'e3')), entry(DRAFT, 'e3')));
    await assertFails(updateDoc(doc(bob.firestore(), entryPath(DRAFT, 'e1')), { title: 'hacked', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(bob.firestore(), entryPath(DRAFT, 'e1'))));
  });

  it('rejects malformed entries', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const db = alice.firestore();
    // photo stored in ANOTHER wedding's folder
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x1')), entry(DRAFT, 'x1', { images: [photo('wedding-bob', 'x1')] })));
    // more photos than the layout allows
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x2')),
      entry(DRAFT, 'x2', { images: [photo(DRAFT, 'x2', 'a.webp'), photo(DRAFT, 'x2', 'b.webp')] })));
    // unknown layout / extra field / oversized text / wrong id / bad order
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x3')), entry(DRAFT, 'x3', { layout: 'grid' })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x4')), entry(DRAFT, 'x4', { secret: true })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x5')), entry(DRAFT, 'x5', { description: 'x'.repeat(1001) })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x6')), entry(DRAFT, 'other-id')));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x7')), entry(DRAFT, 'x7', { order: -1 })));
    // photo larger than 5 MB
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'x8')),
      entry(DRAFT, 'x8', { images: [{ ...photo(DRAFT, 'x8'), bytes: 6 * 1024 * 1024 }] })));
  });

  it('accepts a saved photo position/zoom and rejects invalid ones', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const db = alice.firestore();
    const withAdjust = (id, adjust) => entry(DRAFT, id, { images: [{ ...photo(DRAFT, id), adjust }] });
    await assertSucceeds(setDoc(doc(db, entryPath(DRAFT, 'a1')), withAdjust('a1', { x: 12.5, y: 80, zoom: 1.75 })));
    await assertSucceeds(setDoc(doc(db, entryPath(DRAFT, 'a2')), withAdjust('a2', { x: 0, y: 100, zoom: 3 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a3')), withAdjust('a3', { x: 120, y: 50, zoom: 1 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a4')), withAdjust('a4', { x: 50, y: 50, zoom: 5 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a5')), withAdjust('a5', { x: 50, y: 50, zoom: 0.5 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a6')), withAdjust('a6', { x: 50, y: 50 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a7')), withAdjust('a7', { x: '50', y: 50, zoom: 1 })));
    await assertFails(setDoc(doc(db, entryPath(DRAFT, 'a8')), withAdjust('a8', { x: 50, y: 50, zoom: 1, rotate: 90 })));
  });

  it('lets the owner update and delete, but not rewrite createdAt', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const ref = doc(alice.firestore(), entryPath(DRAFT, 'e1'));
    await assertSucceeds(updateDoc(ref, { order: 3, layout: 'textOnly', images: [], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('keeps unpublished Story content private', async () => {
    const anon = testEnv.unauthenticatedContext();
    const bob = testEnv.authenticatedContext('bob-uid');
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertFails(getDoc(doc(anon.firestore(), entryPath(DRAFT, 'e1'))));
    await assertFails(getDoc(doc(bob.firestore(), entryPath(DRAFT, 'e1'))));
    await assertFails(getDocs(collection(anon.firestore(), `invitations/${DRAFT}/storyEntries`)));
    await assertSucceeds(getDoc(doc(alice.firestore(), entryPath(DRAFT, 'e1'))));
  });

  it('lets guests read Story content once the invitation is published', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), entryPath(LIVE, 'e1'))));
    await assertSucceeds(getDocs(collection(anon.firestore(), `invitations/${LIVE}/storyEntries`)));
  });
});


/*
 * ============================================================
 * INVITATION COLOR THEME — save / load round trip
 * ============================================================
 * The Color Theme fields are plain fields on invitations/{weddingId}; the
 * existing owner-only update rule and public read rule cover them.
 */
describe('invitation color theme persistence', () => {

  beforeEach(async () => {
    await seed(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations/wedding-alice'), invitationAlice);
    });
  });

  const savedTheme = () => normalizeThemeSettings({
    ...applyColorPreset('Navy'),
    ...applyFontPair('Timeless'),
    colorButton: '#7a1f3d',
    sectionBackgrounds: { story: 'main', rsvp: '#ffffff' },
  });

  it('lets the owner save the theme and a guest read back the same settings', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const theme = savedTheme();
    await assertSucceeds(updateDoc(doc(alice.firestore(), 'invitations/wedding-alice'), theme));

    const anon = testEnv.unauthenticatedContext();
    const snap = await assertSucceeds(getDoc(doc(anon.firestore(), 'invitations/wedding-alice')));
    expect(normalizeThemeSettings(snap.data())).toEqual(theme);
    // Unrelated fields are untouched
    expect(snap.data().location).toBe('Dallas');
  });

  it('replaces section overrides, so a removed override stays removed', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const ref = doc(alice.firestore(), 'invitations/wedding-alice');
    await updateDoc(ref, savedTheme());
    await updateDoc(ref, { sectionBackgrounds: { rsvp: '#ffffff' } });
    const snap = await getDoc(ref);
    expect(snap.data().sectionBackgrounds).toEqual({ rsvp: '#ffffff' });
  });

  it('gives an invitation saved before the Color Theme tab its defaults', async () => {
    const anon = testEnv.unauthenticatedContext();
    const snap = await getDoc(doc(anon.firestore(), 'invitations/wedding-alice'));
    expect(normalizeThemeSettings(snap.data())).toMatchObject({
      themePreset: 'Garden', colorBackground: '#fafaf5', font1: 'Playfair Display', sectionBackgrounds: {},
    });
  });

  it("rejects another user changing the theme", async () => {
    const bob = testEnv.authenticatedContext('bob-uid');
    await assertFails(updateDoc(doc(bob.firestore(), 'invitations/wedding-alice'), { colorBackground: '#000000' }));
  });
});


/*
 * ============================================================
 * WEDDING PARTY
 * ============================================================
 *   invitations/{weddingId}.partyMembers              — public member cards
 *     (plain field on the invitation doc; existing owner-only update rule)
 *   invitations/{weddingId}/private/weddingPartyContacts — owner-only
 *     phone numbers / emails, never readable by guests
 */
describe('wedding party rules', () => {

  const DRAFT = 'wedding-draft';
  const LIVE = 'wedding-live';
  const contactsPath = (weddingId) => `invitations/${weddingId}/private/weddingPartyContacts`;
  const contactsDoc = (overrides = {}) => ({
    contacts: { m1: { phone: '(214) 555-0123', email: 'jordan@example.com' } },
    updatedAt: serverTimestamp(),
    ...overrides,
  });
  const member = {
    id: 'm1', name: 'Jordan Lee', role: 'bestMan', customRole: '', side: 'groom',
    description: '', photo: null, isPointOfContact: true,
    showContact: false, publicPhone: '', publicEmail: '',
  };

  beforeEach(async () => {
    await seed(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `invitations/${DRAFT}`), { userId: 'alice-uid', isPublished: false });
      await setDoc(doc(db, `invitations/${LIVE}`), { userId: 'alice-uid', isPublished: true });
      await setDoc(doc(db, contactsPath(LIVE)), { ...contactsDoc(), updatedAt: new Date() });
    });
  });

  it('lets the owner save members and section settings on the invitation', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const ref = doc(alice.firestore(), `invitations/${DRAFT}`);
    await assertSucceeds(updateDoc(ref, {
      partyMembers: [member], partyShowOnInvitation: true, partyGroupBySide: false,
    }));
    const snap = await getDoc(ref);
    expect(snap.data().partyMembers).toEqual([member]);
  });

  it('rejects another user changing the wedding party', async () => {
    const bob = testEnv.authenticatedContext('bob-uid');
    await assertFails(updateDoc(doc(bob.firestore(), `invitations/${DRAFT}`), { partyMembers: [] }));
  });

  it('lets the owner read and write private contact details', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    await assertSucceeds(setDoc(doc(alice.firestore(), contactsPath(DRAFT)), contactsDoc()));
    await assertSucceeds(getDoc(doc(alice.firestore(), contactsPath(DRAFT))));
    await assertSucceeds(setDoc(doc(alice.firestore(), contactsPath(DRAFT)), contactsDoc({ contacts: {} })));
  });

  it('never lets guests or other users read contact details — even once published', async () => {
    const anon = testEnv.unauthenticatedContext();
    const bob = testEnv.authenticatedContext('bob-uid');
    await assertFails(getDoc(doc(anon.firestore(), contactsPath(LIVE))));
    await assertFails(getDoc(doc(bob.firestore(), contactsPath(LIVE))));
    await assertFails(getDocs(collection(anon.firestore(), `invitations/${LIVE}/private`)));
  });

  it('rejects contact writes from other users and signed-out visitors', async () => {
    const bob = testEnv.authenticatedContext('bob-uid');
    const anon = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(bob.firestore(), contactsPath(DRAFT)), contactsDoc()));
    await assertFails(setDoc(doc(anon.firestore(), contactsPath(DRAFT)), contactsDoc()));
    await assertFails(deleteDoc(doc(bob.firestore(), contactsPath(LIVE))));
  });

  it('rejects malformed contact documents and unknown private doc ids', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const db = alice.firestore();
    await assertFails(setDoc(doc(db, contactsPath(DRAFT)), contactsDoc({ extra: true })));
    await assertFails(setDoc(doc(db, contactsPath(DRAFT)), contactsDoc({ contacts: 'not-a-map' })));
    await assertFails(setDoc(doc(db, contactsPath(DRAFT)), { contacts: {}, updatedAt: new Date(0) }));
    const tooMany = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`m${i}`, { phone: '', email: 'a@b.co' }]));
    await assertFails(setDoc(doc(db, contactsPath(DRAFT)), contactsDoc({ contacts: tooMany })));
    await assertFails(setDoc(doc(db, `invitations/${DRAFT}/private/somethingElse`), contactsDoc()));
  });
});
