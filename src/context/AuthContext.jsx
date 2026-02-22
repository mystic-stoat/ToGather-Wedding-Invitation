/**
 * AuthContext.jsx
 * This file creates a global authentication context for the application.
 *
 * Purpose:
 * - Track the currently authenticated Firebase user.
 * - Expose `user` and `loading` state across the entire app.
 * - Prevent prop-drilling authentication state.
 * - Support protected routes (via ProtectedRoute component).
 *
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";

// Created a react context to hold authentication state
const AuthContext = createContext(null);

/**
 * AuthProvider:
 * Wraps the app and provides authentication state.
 *
 * This component:
 * - Subscribes to Firebase auth state changes
 * - Stores the current user
 * - Tracks loading state while Firebase initializes
 */
export function AuthProvider({ children }) {
  // `user` will hold the Firebase user object (or null if not logged in)
  const [user, setUser] = useState(null);

  // `loading` prevents rendering protected routes before Firebase resolves auth state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  
    /**
     * onAuthStateChanged:
     * Firebase listener that fires whenever:
     * - User logs in
     * - User logs out
     * - App refreshes and firebase restores session
     */
	 
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoading(false); // Firebase has resolved authentication state
    });

    // Cleanup subscription when component unmounts
    return () => unsubscribe();
  }, []);

  /**
   * useMemo:
   * Prevents unnecessary re-renders by memoizing the context value.
   */
  const value = useMemo(() => {
    return { user, loading };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook
 * Custom hook to consume authentication context.
 *
 * Usage:
 * const { user, loading } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
