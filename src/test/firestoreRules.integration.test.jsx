//Tests for new rules
//Testing new tests

import fs from 'fs';

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';

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


const PROJECT_ID = 'togather-64b0b';


let testEnv;


beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
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


  it('rejects a guest from changing guestName', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          guestName: 'HACKED NAME',
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


  it('rejects a guest from changing email', async () => {
    await seedInvitees();

    const anon = testEnv.unauthenticatedContext();

    await assertFails(
      updateDoc(
        doc(anon.firestore(), 'invitee/invitee-alice'),
        {
          email: 'attacker@example.com',
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
 * DEFAULT DENY
 * ============================================================
 */

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