// src/contexts/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Manages who is logged in across the entire app.
//
//   Instead of each page checking Firebase separately, we wrap the whole app
//   in <AuthProvider> once (in App.jsx). Then any page can call useAuth()
//   to instantly know:
//     - Who is logged in (the `user` object)
//     - Whether Firebase is still loading (the `loading` flag)
//     - Auth functions: login, signup, logout, resetPassword
//
// HOW TO USE IN ANY PAGE:
//   import { useAuth } from "@/contexts/AuthContext";
//
//   const MyPage = () => {
//     const { user, login, logout } = useAuth();
//     console.log(user.email); // the logged-in user's email
//   };
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,           // listens for login/logout changes
  signInWithEmailAndPassword,   // login with email + password
  createUserWithEmailAndPassword, // create a new account
  signOut,                      // log out
  sendPasswordResetEmail,       // send password reset email
  updateProfile,                // update display name / photo
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

// ── Step 1: Create the context ────────────────────────────────────────────────
// createContext makes a "container" that holds shared data.
// It starts null and gets filled in by AuthProvider below.
const AuthContext = createContext(null);

// ── Step 2: AuthProvider — wraps the whole app in App.jsx ─────────────────────
// This component is the actual engine. It talks to Firebase, keeps user state
// updated, and makes everything available to child components via the context.
export const AuthProvider = ({ children }) => {

  // `user` — the Firebase User object when logged in, null when logged out
  const [user, setUser] = useState(null);

  // `loading` — true while Firebase checks if there's an existing session.
  // Starts true so pages don't flash to /login on first load before
  // Firebase has had a chance to check if someone is already logged in.
  const [loading, setLoading] = useState(true);

  // ── Listen for auth state changes ────────────────────────────────────────
  // This runs once when the app loads and stays active the whole time.
  // Firebase calls the callback whenever:
  //   - User logs in    → firebaseUser = User object
  //   - User logs out   → firebaseUser = null
  //   - Page refreshes  → Firebase checks session and fires this again
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);  // update our local state
      setLoading(false);      // done loading — safe to show the page
    });

    // Cleanup function: stops listening when the app unmounts
    // (prevents memory leaks)
    return unsubscribe;
  }, []); // empty array = only run once on mount

  // ── login ─────────────────────────────────────────────────────────────────
  // Signs in with email + password.
  // If successful, onAuthStateChanged above fires and sets `user` automatically.
  // If it fails (wrong password etc.), Firebase throws an error with a `code`
  // property that Login.jsx catches and shows a friendly message for.
  const login = async (email, password) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  // ── signup ────────────────────────────────────────────────────────────────
  // Creates a new Firebase Auth account and sets the user's display name.
  // Returns { uid } so Signup.jsx can use it to create the Firestore profile.
  const signup = async (name, email, password) => {
    // Step 1: Create the Firebase Auth account
    const credential = await createUserWithEmailAndPassword(
      firebaseAuth, email, password
    );
    // Step 2: Save their name to their Firebase Auth profile
    await updateProfile(credential.user, { displayName: name });

    // Return the uid so Signup.jsx can create the bethrothed Firestore doc
    return { uid: credential.user.uid };
  };

  // ── logout ────────────────────────────────────────────────────────────────
  // Signs out. onAuthStateChanged fires and sets user to null.
  // ProtectedRoute in App.jsx will then redirect to /login automatically.
  const logout = async () => {
    await signOut(firebaseAuth);
  };

  // ── resetPassword ─────────────────────────────────────────────────────────
  // Sends a password reset email through Firebase.
  // The user clicks the link in the email to set a new password.
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(firebaseAuth, email);
  };

  // ── Provide everything to child components ────────────────────────────────
  // Any component wrapped in <AuthProvider> can now call useAuth()
  // to access user, loading, and all the auth functions above.
  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Step 3: useAuth hook — how pages access the context ───────────────────────
// This is a convenience wrapper around useContext.
// Call it at the top of any component:
//   const { user, login, logout } = useAuth();
//
// Throws a helpful error if you accidentally use it outside <AuthProvider>.
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
