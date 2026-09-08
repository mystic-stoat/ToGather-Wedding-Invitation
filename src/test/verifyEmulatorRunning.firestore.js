import { beforeAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'togather-64b0b';

// Verify that the firestore emulator is running before tests
beforeAll(async () => {
  try {
    // This will verify that the Firestore emulator is available
    await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: 'firestore.rules', // This will fail if file doesn't exist or emulator not running
        host: '127.0.0.1',
        port: 8080,
      },
    });
    
    console.log('Connected to Firebase Firestore emulator successfully');
  } catch (error) {
    console.error('Failed to connect to Firebase Firestore emulator:', error);
    throw new Error('Firebase Firestore emulator is not running. Please start it with "firebase emulators:start"');
  }
});