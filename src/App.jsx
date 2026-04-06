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
//   Public routes    → anyone can visit (login, signup, landing, RSVP)
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
import NotFound         from "./pages/NotFound.jsx";

// React Query client — manages caching for API/Firestore calls
const queryClient = new QueryClient();

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wrapper component that guards pages requiring login.
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

            {/* ── Public routes — no login required ── */}
            <Route path="/"            element={<Index />} />
            <Route path="/login"       element={<Login />} />
            <Route path="/signup"      element={<Signup />} />
            {/* :token is a URL parameter — e.g. /rsvp/abc-123 */}
            <Route path="/rsvp/:token" element={<RSVP />} />

            {/* ── Protected routes — must be logged in ── */}
            <Route path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/wedding-details"
              element={<ProtectedRoute><WeddingDetails /></ProtectedRoute>} />
            <Route path="/create-invitation"
              element={<ProtectedRoute><CreateInvitation /></ProtectedRoute>} />

            {/* Catch-all — shows 404 page for any unknown URL */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
