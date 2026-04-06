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
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Firestore database — used in firestore.js for all reads/writes
export const db = getFirestore(app);

// Firebase Authentication — used in AuthContext.jsx for login/signup/logout
export const firebaseAuth = getAuth(app);
