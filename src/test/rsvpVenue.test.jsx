// Guest RSVP page: venue details follow the builder's Venue tab settings,
// older invitations look the same, and the RSVP flow is unaffected.
// Firestore is mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const db = vi.hoisted(() => ({ docs: {} }));
const fsHelpers = vi.hoisted(() => ({ submitRSVP: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, collection, id) => ({ path: `${collection}/${id}`, id }),
  getDoc: vi.fn(async (ref) => {
    const data = db.docs[ref.path];
    return { id: ref.id, exists: () => Boolean(data), data: () => data };
  }),
}));
vi.mock("@/lib/firestore", () => fsHelpers);

import RSVP from "@/pages/RSVP";

const invitee = { token: "tok", weddingId: "w1", guestName: "Jane Smith", email: "jane@example.com", plusOneLimit: 0 };
const INVITATION = {
  groomName: { first: "Sam" }, brideName: { first: "Alex" },
  weddingDate: "2026-06-20", inviteDeadline: "2026-05-01",
  venueName: "Rose Hall", venueAddress: "1 Garden Way, Dallas, TX",
};

const renderPage = (invitation) => {
  db.docs["invitee/i1"] = invitee;
  db.docs["invitations/w1"] = invitation;
  return render(
    <MemoryRouter initialEntries={["/rsvp/i1/tok"]}>
      <Routes><Route path="/rsvp/:inviteeId/:token" element={<RSVP />} /></Routes>
    </MemoryRouter>
  );
};

const acceptAndSubmit = async () => {
  fireEvent.click(screen.getByText("Joyfully accepts"));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Continue/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Send my RSVP/ }));
  await screen.findByText("See you there!");
};

describe("RSVP page — venue display settings", () => {
  beforeEach(() => {
    db.docs = {};
    fsHelpers.submitRSVP.mockClear();
  });

  it("an older invitation shows the venue name and address as before", async () => {
    renderPage({ ...INVITATION });
    await screen.findByText("Sam & Alex");
    expect(screen.getByTestId("invitation-venue")).toHaveTextContent("Rose Hall, 1 Garden Way, Dallas, TX");
    // Deadline display is unchanged
    expect(screen.getByText(/Kindly reply by/)).toHaveTextContent("May 1, 2026");
  });

  it("hides the address when the Address switch is off", async () => {
    renderPage({ ...INVITATION, venueShowAddress: false });
    await screen.findByText("Sam & Alex");
    expect(screen.getByTestId("invitation-venue").textContent).toBe("Rose Hall");
  });

  it("hides all venue info (header and confirmation) when the section is off, and RSVP still works", async () => {
    renderPage({ ...INVITATION, venueShowOnInvitation: false });
    await screen.findByText("Sam & Alex");
    expect(screen.queryByTestId("invitation-venue")).toBeNull();
    expect(screen.queryByText(/Rose Hall/)).toBeNull();

    await acceptAndSubmit();
    expect(fsHelpers.submitRSVP).toHaveBeenCalledWith("tok", expect.objectContaining({ attending: true }));
    expect(screen.queryByTestId("confirmation-venue")).toBeNull();
    expect(screen.queryByText(/Rose Hall/)).toBeNull();
  });

  it("shows the venue on the confirmation card by default", async () => {
    renderPage({ ...INVITATION });
    await screen.findByText("Sam & Alex");
    await acceptAndSubmit();
    await waitFor(() => expect(screen.getByTestId("confirmation-venue")).toHaveTextContent("Rose Hall"));
  });
});
