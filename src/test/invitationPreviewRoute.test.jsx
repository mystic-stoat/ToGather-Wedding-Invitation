// /invitation/preview is a PROTECTED route (src/App.jsx): only a logged-in
// user reaches the preview page; everyone else is sent to /login.
// Every page is replaced by a stub so this only tests the routing. The app's
// BrowserRouter is swapped for a MemoryRouter (jsdom has no real URL here);
// the routes and <ProtectedRoute> under test are the real ones from App.jsx.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const rr = await importOriginal();
  return {
    ...rr,
    BrowserRouter: ({ children }) => <rr.MemoryRouter initialEntries={[route.path]}>{children}</rr.MemoryRouter>,
  };
});

const auth = vi.hoisted(() => ({ user: null, loading: false }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }) => children,
}));

// vi.mock is hoisted above imports, so the stub helper must be hoisted too
const stub = vi.hoisted(() => (name) => ({ default: () => <p>{name}</p> }));
vi.mock("@/pages/Index.jsx", () => stub("INDEX PAGE"));
vi.mock("@/pages/Login.jsx", () => stub("LOGIN PAGE"));
vi.mock("@/pages/ForgotPassword.jsx", () => stub("FORGOT PAGE"));
vi.mock("@/pages/Signup.jsx", () => stub("SIGNUP PAGE"));
vi.mock("@/pages/Dashboard.jsx", () => stub("DASHBOARD PAGE"));
vi.mock("@/pages/WeddingDetails.jsx", () => stub("WEDDING DETAILS PAGE"));
vi.mock("@/pages/WeddingAssistant.jsx", () => stub("ASSISTANT PAGE"));
vi.mock("@/pages/CreateInvitation.jsx", () => stub("BUILDER PAGE"));
vi.mock("@/pages/InvitationPreview.jsx", () => stub("INVITATION PREVIEW PAGE"));
vi.mock("@/pages/RSVP.jsx", () => stub("RSVP PAGE"));
vi.mock("@/pages/GuestList.jsx", () => stub("GUEST LIST PAGE"));
vi.mock("@/pages/Registry.jsx", () => stub("REGISTRY PAGE"));
vi.mock("@/pages/NotFound.jsx", () => stub("NOT FOUND PAGE"));

import App from "@/App";

const visit = (path) => {
  route.path = path;
  return render(<App />);
};

beforeEach(() => {
  auth.user = null;
  auth.loading = false;
});

describe("/invitation/preview route", () => {
  it("opens the preview page for a logged-in couple", () => {
    auth.user = { uid: "u1" };
    visit("/invitation/preview");
    expect(screen.getByText("INVITATION PREVIEW PAGE")).toBeTruthy();
  });

  it("sends logged-out visitors to the login page", () => {
    visit("/invitation/preview");
    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
    expect(screen.queryByText("INVITATION PREVIEW PAGE")).toBeNull();
  });

  it("shows nothing from the preview while the login state is still loading", () => {
    auth.loading = true;
    visit("/invitation/preview");
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("INVITATION PREVIEW PAGE")).toBeNull();
  });

  it("leaves the guest RSVP route unchanged", () => {
    visit("/rsvp/invitee-1/token-1");
    expect(screen.getByText("RSVP PAGE")).toBeTruthy();
  });
});
