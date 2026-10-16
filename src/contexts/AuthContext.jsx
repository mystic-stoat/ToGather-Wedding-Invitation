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

// adding libraries here to connect fire auth to firestore db
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, db } from "@/lib/firebase";
import { verificationActionCodeSettings } from "@/lib/emailVerification";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,           // listens for login/logout changes
  signInWithEmailAndPassword,   // login with email + password
  createUserWithEmailAndPassword, // create a new account
  signOut,                      // log out
  sendPasswordResetEmail,       // send password reset email
  updateProfile,                // update display name / photo
  sendEmailVerification,        // send the account verification email
  reload,                       // refresh the user's auth record (emailVerified)
} from "firebase/auth";

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

  // userProfile, firestore db info about user
  const [userProfile, setUserProfile] = useState(null);

  // ── Listen for auth state changes ────────────────────────────────────────
  // This runs once when the app loads and stays active the whole time.
  // Firebase calls the callback whenever: <= meaning firebase is queried on authentication functions
  //   - User logs in    → firebaseUser = User object
  //   - User logs out   → firebaseUser = null
  //   - Page refreshes  → Firebase checks session and fires this again
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // pull data from firebase db, idexing from user id (using api call => async)
        // Collection is `betrothed` — the one Signup writes (createUserProfile)
        // and the only one firestore.rules lets the owner read. A failed read
        // must not escape this callback (unhandled rejection) or skip
        // setLoading(false) below (stuck loading spinner); the profile is optional.
        try {
          const docRef = doc(db, "betrothed", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          setUserProfile(docSnap.exists() ? docSnap.data() : null);
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setUserProfile(null);
        }
      }
      else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);      // done loading — safe to show the page
    });
    // Cleanup function: stops listening when the app unmounts
    // (prevents memory leaks)
    return unsubscribe;
  }, []); // empty array = only run once on mount


  // now we can load these values into our "AuthContext.Provider"
  // ── login ─────────────────────────────────────────────────────────────────
  // Signs in with email + password.
  // If successful, onAuthStateChanged above fires and sets `user` automatically.
  // If it fails (wrong password etc.), Firebase throws an error with a `code`
  // property that Login.jsx catches and shows a friendly message for.
  const login = async (email, password) => {
    return signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  // ── signup ────────────────────────────────────────────────────────────────
  // Creates a new Firebase Auth account, sets the display name, and sends the
  // verification email. Returns { uid, verificationSent } so Signup.jsx can
  // create the Firestore profile and the verify-email page can warn when the
  // email could not be sent.
  //
  // PARTIAL-FAILURE HANDLING:
  //   If the account is created but sending the verification email fails
  //   (network error, Firebase rate limit), the account and profile still
  //   exist — signup resolves with verificationSent: false instead of
  //   throwing. The user lands on /verify-email where Resend is available.
  //   We never retry createUserWithEmailAndPassword, which would throw
  //   auth/email-already-in-use for a perfectly good account.
  const signup = async (name, email, password) => {
    // Step 1: Create the Firebase Auth account
    const credential = await createUserWithEmailAndPassword(
      firebaseAuth, email, password
    );
    // Step 2: Save their name to their Firebase Auth profile. A failure here
    // must NOT fail the signup — the account already exists and the canonical
    // name lives in the betrothed Firestore doc Signup writes next. Aborting
    // would orphan a good account and a retry would hit email-already-in-use.
    try {
      await updateProfile(credential.user, { displayName: name });
    } catch (err) {
      console.error("Display name could not be saved:", err);
    }

    // Step 3: Send the verification email. The continue URL returns the user
    // to this app's verify screen; the domain must be authorized in Firebase
    // Console → Authentication → Settings → Authorized domains (localhost is
    // allowed by default).
    let verificationSent = true;
    try {
      await sendEmailVerification(credential.user, verificationActionCodeSettings());
    } catch (err) {
      console.error("Verification email could not be sent:", err);
      verificationSent = false;
    }

    // Return the uid so Signup.jsx can create the betrothed Firestore doc
    return { uid: credential.user.uid, verificationSent };
  };

  // ── resendVerificationEmail ───────────────────────────────────────────────
  // Sends another verification email to the currently signed-in user.
  // Throws the Firebase error (auth/too-many-requests, etc.) so the
  // verify-email page can show the right message.
  const resendVerificationEmail = async () => {
    if (!firebaseAuth.currentUser) throw new Error("No signed-in user");
    await sendEmailVerification(firebaseAuth.currentUser, verificationActionCodeSettings());
  };

  // ── reloadCurrentUser ─────────────────────────────────────────────────────
  // Re-fetches the signed-in user's auth record so `emailVerified` reflects
  // the link they may have clicked in another tab/device. Returns the
  // (possibly updated) Firebase User, or null when signed out.
  const reloadCurrentUser = async () => {
    const current = firebaseAuth.currentUser;
    if (!current) return null;
    await reload(current);
    return current;
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
    <AuthContext.Provider value ={{
      user,
      userProfile,
      loading,
      login,
      signup,
      logout,
      resetPassword,
      resendVerificationEmail,
      reloadCurrentUser
    }}>
      {children}
    </AuthContext.Provider>
  )

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
