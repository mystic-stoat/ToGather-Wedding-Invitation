/**
 * ProtectedRoute.jsx
 * This component protects routes that require authentication.
 *
 * If the user is:
 * - Loading -> show temporary loading state
 * - Not authenticated -> redirect to /login
 * - Authenticated -> render the protected component
 *
 * This prevents unauthorized users from accessing private pages.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  /**
   * While Firebase is determining authentication state,
   * we do not render protected content yet.
   *
   * This prevents:
   * - UI flickering
   * - Protected pages flashing briefly
   * - Incorrect redirects
   */
  if (loading) {
    return <div>Checking authentication...</div>;
  }

  /**
   * If no authenticated user exists,
   * redirect to login page.
   */
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /**
   * If authenticated, render protected content.
   */
  return children;
}
