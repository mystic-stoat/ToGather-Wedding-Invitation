// set up emulators before we try our tests
import "@testing-library/jest-dom";
import { JSDOM } from "jsdom";
import { beforeAll } from 'vitest';
import { connectAuthEmulator } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { firebaseAuth } from '@/lib/firebase';

// Setup jsdom for testing environment
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const { window } = dom;

// Make window and document available globally
global.window = window;
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
});

// Verify Firebase Auth emulator is running
beforeAll(async () => {
  try {
    connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    console.log('✓ Connected to Firebase Auth emulator');
  } catch (error) {
    console.error('✗ Failed to connect to Firebase Auth emulator:', error.message);
    throw new Error('Firebase Auth emulator is not running. Please start it with "firebase emulators:start"');
  }
});

// Verify Firestore emulator is running
beforeAll(async () => {
  try {
    await initializeTestEnvironment({
      projectId: 'togather-64b0b',
      firestore: {
        rules: 'firestore.rules',
        host: '127.0.0.1',
        port: 8080,
      },
    });
    console.log('✓ Connected to Firebase Firestore emulator');
  } catch (error) {
    console.error('✗ Failed to connect to Firebase Firestore emulator:', error.message);
    throw new Error('Firebase Firestore emulator is not running. Please start it with "firebase emulators:start"');
  }
});