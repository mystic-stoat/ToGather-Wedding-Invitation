
// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   The root of the entire app. Sets up:
//     1. QueryClientProvider  — enables data fetching with React Query
//     2. TooltipProvider      — enables tooltips across the app (from shadcn)
//     3. Toaster / Sonner     — toast notification systems
//     4. BrowserRouter        — enables URL-based navigation (React Router)
//     5. AuthProvider         — makes the logged-in user available everywhere
//     6. Routes               — maps URLs to page components
//
// ROUTE TYPES:
//   Public routes    → must NOT be logged in (login, signup, landing, RSVP)
//   Protected routes → must be logged in, otherwise redirected to /login
// ─────────────────────────────────────────────────────────────────────────────
 
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
 
// Page imports — each route loads one of these
import Index            from "./pages/Index.jsx";
import Login            from "./pages/Login.jsx";
import Signup           from "./pages/Signup.jsx";
import Dashboard        from "./pages/Dashboard.jsx";
import WeddingDetails   from "./pages/WeddingDetails.jsx";
import CreateInvitation from "./pages/CreateInvitation.jsx";
import RSVP             from "./pages/RSVP.jsx";
import GuestList        from "./pages/GuestList.jsx";
import NotFound         from "./pages/NotFound.jsx";
 
// React Query client — manages caching for API/Firestore calls
const queryClient = new QueryClient();
 
// ── PublicRoute ───────────────────────────────────────────────────────────────
// Wrapper for pages that should NOT be accessible when already logged in
// (landing page, login, signup).
//
// How it works:
//   1. While Firebase is checking the session → show a spinner
//   2. If user IS logged in                   → redirect to /dashboard
//   3. If user is NOT logged in               → show the page normally
//
// This solves two problems:
//   a) Logo linking to "/" now goes to /dashboard when logged in instead of
//      the public landing page.
//   b) Back-arrow after logout cannot re-enter protected pages — pressing back
//      from /dashboard after logout lands on /login (not logged in), which
//      stays there rather than bouncing into the app.
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
 
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
 
  // Already logged in — push them into the app instead of showing login/landing
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
 
  return children;
};
 
// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wrapper component that guards pages requiring login.
//
// How it works:
//   1. While Firebase is checking the session → show a spinner (prevents flicker)
//   2. If no user is logged in               → redirect to /login
//   3. If user is logged in                  → show the page normally
//
// Usage in Routes below:
//   <ProtectedRoute><Dashboard /></ProtectedRoute>
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
 
  // Still checking Firebase session — show spinner so page doesn't flash
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
 
  // Not logged in — send them to the login page
  // `replace` means the /dashboard URL is replaced in history (so back button works)
  if (!user) {
    return <Navigate to="/login" replace />;
  }
 
  // Logged in — render the actual page
  return children;
};
 
// ── App ───────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />   {/* shadcn toast notifications */}
      <Sonner />    {/* sonner toast notifications */}
      <BrowserRouter>
        {/* AuthProvider must be inside BrowserRouter so Navigate works */}
        <AuthProvider>
          <Routes>
 
            {/* ── Public routes — redirects to /dashboard if already logged in ── */}
            <Route path="/"      element={<PublicRoute><Index /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
 
            {/* RSVP is fully public — guests don't have accounts */}
            {/* :token is a URL parameter — e.g. /rsvp/abc-123 */}
            <Route path="/rsvp/:token" element={<RSVP />} />
 
            {/* ── Protected routes — must be logged in ── */}
            <Route path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/wedding-details"
              element={<ProtectedRoute><WeddingDetails /></ProtectedRoute>} />
            <Route path="/create-invitation"
              element={<ProtectedRoute><CreateInvitation /></ProtectedRoute>} />
            <Route path="/guest-list"
              element={<ProtectedRoute><GuestList /></ProtectedRoute>} />

            {/* Catch-all — shows 404 page for any unknown URL */}
            <Route path="*" element={<NotFound />} />
 
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
 
export default App;