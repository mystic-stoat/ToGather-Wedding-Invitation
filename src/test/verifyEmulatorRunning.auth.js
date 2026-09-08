import { beforeAll } from 'vitest';
import { connectAuthEmulator } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9099;

// Verify that the auth emulator is running before tests
beforeAll(async () => {
  try {
    // Attempt to connect to the auth emulator
    connectAuthEmulator(firebaseAuth, `http://${EMULATOR_HOST}:${EMULATOR_PORT}`, {
      disableWarnings: true,
    });
    
    console.log('Connected to Firebase Auth emulator successfully');
  } catch (error) {
    console.error('Failed to connect to Firebase Auth emulator:', error);
    throw new Error('Firebase Auth emulator is not running. Please start it with "firebase emulators:start"');
  }
});