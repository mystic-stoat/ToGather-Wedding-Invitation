// src/lib/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Initializes the Firebase connection for the whole app.
//   This file runs once when the app starts and creates two things:
//     - `db`           → the Firestore database connection
//     - `firebaseAuth` → the Firebase Authentication connection
//
//   Every other file that needs Firebase imports from here.
//   This way the app only connects to Firebase once, not multiple times.
//
// HOW TO USE:
//   import { db } from "@/lib/firebase";           // for database reads/writes
//   import { firebaseAuth } from "@/lib/firebase";  // for auth (used in AuthContext)
//
// ⚠️  IMPORTANT: Replace the firebaseConfig values below with your own.
//   Get them from: Firebase Console → Project Settings → Your Apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";


// Your Firebase project credentials
// These are safe to include in frontend code — Firebase security rules
// control what data can actually be read/written
const firebaseConfig = {
  apiKey:            "AIzaSyBpbQNC7u2Lmz8-itIFajmdPIYhrKSIrXE",
  authDomain:        "togather-64b0b.firebaseapp.com",
  projectId:         "togather-64b0b",
  storageBucket:     "togather-64b0b.firebasestorage.app",
  messagingSenderId: "66168998569",
  appId:             "1:66168998569:web:be6b45adc9d1a07386f7b8",
};

// Initialize the Firebase app (connects to your Firebase project)
const app = initializeApp(firebaseConfig);

// Firebase services connections
const db = getFirestore(app);
const firebaseAuth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);

if ( import.meta.env.VITE_RUN_EMULATOR_MODE === "true") {
  connectAuthEmulator(firebaseAuth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export { app, firebaseAuth, db, storage, functions };

