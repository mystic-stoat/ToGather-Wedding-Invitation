// Tests for the Save the Date calendar feature:
//   - src/lib/saveTheDate.js: event building, all-day iCalendar output,
//     Google Calendar URL, iCalendar escaping/folding, date boundaries
//   - <SaveTheDate>: app (dropdown) + invitation (themed) variants
//   - Dashboard "Set Reminders" replacement + sidebar hash link
//   - Guest-facing invitation page action + builder preview safety
// Firestore / auth / maps are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  getInvitees: vi.fn(async () => []),
}));
vi.mock("@/lib/firestore", () => fs);

const auth = vi.hoisted(() => ({
  user: { uid: "u1" },
  userProfile: { name: "Host" },
  logout: vi.fn(async () => {}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: ({ title }) => <div data-testid="map-embed">{title}</div>,
  buildMapQuery: (name, address) => [name, address].filter(Boolean).join(", "),
  mapLinkUrl: (q) => `https://maps.example/?q=${encodeURIComponent(q)}`,
}));
// toGuestInvitation lives in guestInvitation.js, which transitively imports
// firebase — stub it (and story loading) so the pure projection can be tested.
vi.mock("@/lib/firebase", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));
vi.mock("@/lib/storyStore", () => ({ loadAllStoryEntries: vi.fn(async () => []) }));
// recharts renders nothing inside jsdom — keep the DOM light for Dashboard.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PieChart: () => null, Pie: () => null, Cell: () => null,
}));

import {
  buildCalendarEvent, eventTitle, icsDate, nextDay, icsEscape,
  icsContent, icsFilename, googleCalendarUrl,
} from "@/lib/saveTheDate";
import SaveTheDate from "@/components/SaveTheDate";
import { toGuestInvitation } from "@/lib/guestInvitation";
import Dashboard from "@/pages/Dashboard";
import Sidebar from "@/components/Sidebar";
import InvitationContent from "@/components/invitation/InvitationContent";
import WeddingDaySection from "@/components/invitation/WeddingDaySection";

const THEME = {
  button: "#56642b", buttonLabel: "#ffffff", accent: "#8a9a5b",
  background: "#fafaf5", headingText: "#1a1c19", bodyText: "#46483c",
  headingFont: "serif", bodyFont: "sans-serif",
};
const INVITATION = {
  weddingId: "w1", userId: "u1",
  groomName: { first: "Alex" }, brideName: { first: "Sam" },
  weddingDate: "2026-06-20", ceremonyTime: "14:30",
  venueName: "Rose Hall", venueAddress: "1 Garden Way, Dallas, TX",
  receptionName: "Rose Hall North", receptionAddress: "2 Garden Way",
};

const inRouter = (ui, path = "/") =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
const maxLineOctets = (text) =>
  Math.max(...text.split("\r\n").map(l => new TextEncoder().encode(l).length));

beforeEach(() => {
  cleanup();
  fs.getInvitationByUser.mockReset();
  fs.getInvitees.mockReset().mockResolvedValue([]);
  // setup.js creates its own JSDOM realm — stubs must go on ITS window
  // classes, not the environment globals.
  window.Element.prototype.hasPointerCapture = () => false;
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("buildCalendarEvent", () => {
  it("builds title, description and location from public invitation data", () => {
    const e = buildCalendarEvent(INVITATION);
    expect(e.title).toBe("Wedding of Alex & Sam");
    expect(e.date).toEqual({ year: 2026, month: 6, day: 20 });
    expect(e.location).toBe("Rose Hall, 1 Garden Way, Dallas, TX");
    expect(e.description).toContain("2:30 PM");
    expect(e.description).toContain("local venue time");
    expect(e.description).toContain("Rose Hall");
    expect(e.description).toContain("Rose Hall North");
  });

  it("uses 'Wedding' when no partner names exist; handles a single name", () => {
    expect(eventTitle({ weddingDate: "2026-06-20" })).toBe("Wedding");
    expect(eventTitle({ groomName: { first: "Alex" } })).toBe("Wedding of Alex");
  });

  const invalidDates = [undefined, null, "", "not-a-date", "2026-13-01", "2025-02-30", "2027-02-29"];
  it.each(invalidDates)("returns null for missing/invalid weddingDate %s", (d) => {
    expect(buildCalendarEvent({ ...INVITATION, weddingDate: d })).toBeNull();
  });

  it("omits the ceremony line when ceremonyTime is missing or invalid", () => {
    expect(buildCalendarEvent({ ...INVITATION, ceremonyTime: "" }).description)
      .not.toContain("Ceremony begins");
    expect(buildCalendarEvent({ ...INVITATION, ceremonyTime: "25:99" }).description)
      .not.toContain("Ceremony begins");
  });

  it("never leaks private fields (tokens, guests, auth) into the event", () => {
    const dirty = {
      ...INVITATION,
      token: "SECRET-TOKEN", inviteeId: "inv-secret", emailStatus: "sent",
      guests: [{ name: "Private Guest" }], userId: "uid-secret",
    };
    const e = buildCalendarEvent(dirty);
    const blob = JSON.stringify(e) + icsContent(e) + googleCalendarUrl(e);
    ["SECRET-TOKEN", "inv-secret", "Private Guest", "uid-secret", "emailStatus"]
      .forEach(s => expect(blob).not.toContain(s));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("event UID stability and uniqueness", () => {
  it("different weddings produce different UIDs", () => {
    const a = buildCalendarEvent(INVITATION).uid;
    const b = buildCalendarEvent({ ...INVITATION, weddingId: "w2" }).uid;
    expect(a).not.toBe(b);
    // without ids, different public event data must not collide either
    const { weddingId: _dropped, ...noId } = INVITATION;
    const other = { ...noId, brideName: { first: "Riley" } };
    expect(buildCalendarEvent(noId).uid).not.toBe(buildCalendarEvent(other).uid);
  });

  it("the same wedding exports a stable UID", () => {
    expect(buildCalendarEvent(INVITATION).uid).toBe("w1-save-the-date@togather");
    expect(buildCalendarEvent({ ...INVITATION }).uid)
      .toBe(buildCalendarEvent(INVITATION).uid);
  });

  it("the guest-safe projection carries weddingId so guest exports get the real UID", () => {
    const guest = toGuestInvitation({ ...INVITATION, token: "SECRET", userId: "u-secret" });
    expect(guest.weddingId).toBe("w1");
    expect(guest.token).toBeUndefined();
    expect(guest.userId).toBeUndefined();
    expect(buildCalendarEvent(guest).uid).toBe("w1-save-the-date@togather");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("date boundaries", () => {
  const dtendOf = (d) => icsContent(buildCalendarEvent({ ...INVITATION, weddingDate: d }))
    .match(/DTEND;VALUE=DATE:(\d{8})/)[1];

  it("regular day → next day (exclusive DTEND)", () => {
    expect(dtendOf("2026-06-20")).toBe("20260621");
  });
  it("month end → first of next month", () => {
    expect(dtendOf("2026-01-31")).toBe("20260201");
    expect(dtendOf("2026-04-30")).toBe("20260501");
  });
  it("year end → Jan 1 of next year", () => {
    expect(dtendOf("2026-12-31")).toBe("20270101");
  });
  it("leap day → March 1; non-leap Feb 29 is invalid", () => {
    expect(dtendOf("2028-02-29")).toBe("20280301");
    expect(buildCalendarEvent({ ...INVITATION, weddingDate: "2026-02-29" })).toBeNull();
  });
  it("nextDay/icsDate helpers agree", () => {
    expect(icsDate({ year: 2026, month: 2, day: 9 })).toBe("20260209");
    expect(icsDate(nextDay({ year: 2026, month: 12, day: 31 }))).toBe("20270101");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("icsContent", () => {
  const ics = icsContent(buildCalendarEvent(INVITATION), { dtstamp: new Date("2026-10-16T21:00:00Z") });

  it("uses CRLF line endings and required VCALENDAR/VEVENT fields", () => {
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:w1-save-the-date@togather");
    expect(ics).toContain("DTSTAMP:20261016T210000Z");
    expect(ics).toContain("SUMMARY:Wedding of Alex & Sam");
    expect(ics).toContain("END:VCALENDAR\r\n");
    expect(ics).not.toMatch(/(^|[^\r])\n/); // every LF must be a CRLF
  });

  it("writes an all-day event with exclusive DTEND", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260620");
    expect(ics).toContain("DTEND;VALUE=DATE:20260621");
    expect(ics).not.toMatch(/DTSTART[^;\r\n]*T\d{6}/); // no timed DTSTART
  });

  it("never invents a time zone or duration", () => {
    expect(ics).not.toContain("TZID");
    expect(ics).not.toContain("DURATION");
  });

  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe("a\\,b\\;c\\\\d\\ne");
    const e = buildCalendarEvent({ ...INVITATION, venueName: "Hall, Annex; West" });
    const text = icsContent(e);
    expect(text).toContain("Hall\\, Annex\\; West");
    expect(text).not.toContain("Hall, Annex; West");
  });

  it("folds lines to at most 75 octets", () => {
    const long = buildCalendarEvent({
      ...INVITATION,
      groomName: { first: "AlejandroMaximiliano".repeat(3) },
      venueAddress: "Very Long Address ".repeat(20),
    });
    expect(maxLineOctets(icsContent(long))).toBeLessThanOrEqual(75);
  });

  it("names the download file after the date", () => {
    expect(icsFilename(buildCalendarEvent(INVITATION))).toBe("save-the-date-20260620.ics");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("googleCalendarUrl", () => {
  const url = googleCalendarUrl(buildCalendarEvent(INVITATION));

  it("is a prefilled TEMPLATE link on calendar.google.com", () => {
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain("action=TEMPLATE");
  });

  it("carries title, all-day exclusive dates, details and location", () => {
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("text")).toBe("Wedding of Alex & Sam");
    expect(params.get("dates")).toBe("20260620/20260621");
    expect(params.get("details")).toContain("Ceremony begins at 2:30 PM");
    expect(params.get("location")).toBe("Rose Hall, 1 Garden Way, Dallas, TX");
    expect(params.get("ctz")).toBeNull(); // no invented time zone
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("<SaveTheDate> app variant", () => {
  it("is disabled with an explanation when no valid wedding date exists", () => {
    render(<SaveTheDate invitation={{ ...INVITATION, weddingDate: "" }} />);
    const btn = screen.getByRole("button", { name: /save the date/i });
    expect(btn).toBeDisabled();
  });

  it("offers Google Calendar and .ics download when clicked", async () => {
    const user = userEvent.setup();
    render(<SaveTheDate invitation={INVITATION} />);
    await user.click(screen.getByRole("button", { name: /save the date/i }));
    const google = await screen.findByRole("menuitem", { name: /google calendar/i });
    expect(google).toHaveAttribute("href", expect.stringContaining("calendar.google.com"));
    const ics = screen.getByRole("menuitem", { name: /download calendar event/i });
    await user.click(ics);
    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = URL.createObjectURL.mock.calls.at(-1)[0];
    expect(blob.type).toContain("text/calendar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("<SaveTheDate> invitation variant", () => {
  it("renders nothing without a valid date; expands to both options otherwise", async () => {
    const { container, rerender } = render(
      <SaveTheDate invitation={{ ...INVITATION, weddingDate: "" }} variant="invitation" theme={THEME} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<SaveTheDate invitation={INVITATION} variant="invitation" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    const options = await screen.findByTestId("save-the-date-options");
    const google = options.querySelector("a");
    expect(google.href).toContain("calendar.google.com");
    expect(google.href).toContain("dates=20260620%2F20260621");
    fireEvent.click(screen.getByRole("button", { name: /download calendar event/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Dashboard integration", () => {
  it("replaces 'Set Reminders' with a working 'Save the Date'", async () => {
    const user = userEvent.setup();
    fs.getInvitationByUser.mockResolvedValue(INVITATION);
    inRouter(<Dashboard />, "/dashboard");
    await waitFor(() => expect(screen.getByRole("button", { name: /save the date/i })).toBeInTheDocument());
    expect(screen.queryByText("Set Reminders")).toBeNull();
    await user.click(screen.getByRole("button", { name: /save the date/i }));
    expect(await screen.findByRole("menuitem", { name: /google calendar/i })).toBeInTheDocument();
  });

  it("disables the action when the invitation has no wedding date", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...INVITATION, weddingDate: "" });
    inRouter(<Dashboard />, "/dashboard");
    await waitFor(() => expect(screen.getByRole("button", { name: /save the date/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /save the date/i })).toBeDisabled();
  });

  it("scrolls to the RSVP Progress card when arriving at #save-the-date", async () => {
    fs.getInvitationByUser.mockResolvedValue(INVITATION);
    inRouter(<Dashboard />, "/dashboard#save-the-date");
    await waitFor(() => expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled());
    expect(document.getElementById("save-the-date")).toBeTruthy();
  });
});

describe("Sidebar integration", () => {
  it("Save the Date nav item links to the dashboard action anchor", () => {
    inRouter(<Sidebar invitation={INVITATION} />, "/wedding-details");
    const link = screen.getByRole("link", { name: /save the date/i });
    expect(link.getAttribute("href")).toBe("/dashboard#save-the-date");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Guest invitation page", () => {
  const renderContent = (invitation, settings = {}) =>
    render(<InvitationContent mode="page" invitation={invitation}
      settings={settings} storyBlocks={[]} partyMembers={[]} />);

  it("shows Add to Calendar under the date line even when Date options are off", () => {
    renderContent(INVITATION, { dateShowCalendar: false, dateShowCountdown: false });
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("is absent when there is no valid wedding date", () => {
    renderContent({ ...INVITATION, weddingDate: "" });
    expect(screen.queryByRole("button", { name: /add to calendar/i })).toBeNull();
  });

  it("expands to real Google/.ics actions and never includes guest data", async () => {
    renderContent({ ...INVITATION, token: "SECRET-TOKEN" });
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    const options = await screen.findByTestId("save-the-date-options");
    expect(options.querySelector("a").href).toContain("calendar.google.com");
    expect(options.querySelector("a").href).not.toContain("SECRET-TOKEN");
  });
});

describe("WeddingDaySection (page variant)", () => {
  it("shows no duplicate action — the header owns the single live button", () => {
    render(<WeddingDaySection invitation={INVITATION}
      settings={{ dateShowCalendar: true }} theme={THEME} variant="page" />);
    expect(screen.queryByRole("button", { name: /add to calendar/i })).toBeNull();
    expect(screen.queryByTestId("save-the-date-options")).toBeNull();
  });

  it("compact/preview variant keeps an inert visual button (no event actions)", () => {
    render(<WeddingDaySection invitation={INVITATION}
      settings={{ dateShowCalendar: true }} theme={THEME} variant="compact" />);
    const btn = screen.getByRole("button", { name: /add to calendar/i });
    fireEvent.click(btn);
    expect(screen.queryByTestId("save-the-date-options")).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector("a[href*='calendar.google.com']")).toBeNull();
  });
});
