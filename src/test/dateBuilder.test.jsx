// Component tests for the Invitation Builder's Date tab (Calendar View +
// Countdown) and the phone preview's Wedding Day section.
// Firestore / auth / storage are mocked — no emulator needed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fs = vi.hoisted(() => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(async () => "w1"),
}));
vi.mock("@/lib/firestore", () => fs);

const auth = vi.hoisted(() => ({ user: { uid: "u1" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/GoogleMapEmbed", () => ({
  default: () => null, buildMapQuery: () => "", mapLinkUrl: () => "",
}));
vi.mock("@/lib/storyStore", () => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock("@/lib/mediaStorage", () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn(), buildStoryPath: vi.fn(),
}));

import CreateInvitation from "@/pages/CreateInvitation";
import { BUILDER_UI } from "@/components/invitation/builderTheme";

const BASE = {
  weddingId: "w1",
  groomName: { first: "Alex" },
  brideName: { first: "Sam" },
  weddingDate: "2026-06-20",
  ceremonyTime: "14:30",
};

const renderBuilder = (path = "/create-invitation?section=date") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CreateInvitation />
    </MemoryRouter>
  );

const rgb = (hex) => {
  const h = hex.replace("#", "");
  return `rgb(${[0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
};

const preview = () => screen.getByTestId("invitation-preview");
const weddingDay = () => preview().querySelector('[data-section="date"]');
const calendar = () => within(preview()).queryByTestId("wedding-calendar");
const countdown = () => within(preview()).queryByTestId("wedding-countdown");
const calendarSwitch = () => screen.getByRole("switch", { name: "Show Calendar View" });
const countdownSwitch = () => screen.getByRole("switch", { name: "Show Countdown" });
const openDateTab = () => screen.findByRole("switch", { name: "Show Calendar View" });
const clickSave = () => fireEvent.click(screen.getAllByText(/^Save$/)[0]);
const lastSaved = () => fs.saveInvitation.mock.calls.at(-1)[1];
const saveAndGet = async () => {
  fs.saveInvitation.mockClear();
  clickSave();
  await waitFor(() => expect(fs.saveInvitation).toHaveBeenCalled());
  return lastSaved();
};

describe("Date tab — Calendar View and Countdown", () => {
  beforeEach(() => {
    cleanup();
    fs.getInvitationByUser.mockReset();
    fs.saveInvitation.mockClear();
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers only Calendar View and Countdown, both OFF by default, with no Wedding Day section", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openDateTab();

    expect(screen.queryByText("Text View")).toBeNull();
    expect(screen.getAllByRole("switch").map(s => s.getAttribute("aria-label")))
      .toEqual(["Show Calendar View", "Show Countdown"]);
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "false");
    expect(countdownSwitch()).toHaveAttribute("aria-checked", "false");
    expect(weddingDay()).toBeNull();

    // The hero date under the couple's names is always shown
    const hero = preview().querySelector('[data-section="header"]');
    expect(within(hero).getByText("Alex & Sam")).toBeTruthy();
    expect(within(hero).getByText(/June 20, 2026/)).toBeTruthy();
  });

  it("does not add any date input to the builder (date comes from Wedding Details)", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    const { container } = renderBuilder();
    await openDateTab();
    expect(container.querySelector('input[type="date"], input[type="time"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Wedding Details" })).toHaveAttribute("href", "/wedding-details");
  });

  it("an older invitation without date settings loads OFF and saves false without touching other settings", async () => {
    fs.getInvitationByUser.mockResolvedValue({
      ...BASE, greetingTitle: "Hello there", musicShowOnInvitation: false,
      travelShowOnInvitation: false, storyTitle: "How we met", colorPalette1: "#1e3a5f",
    });
    renderBuilder();
    await openDateTab();
    expect(weddingDay()).toBeNull();

    const saved = await saveAndGet();
    expect(saved.dateShowCalendar).toBe(false);
    expect(saved.dateShowCountdown).toBe(false);
    expect(saved.greetingTitle).toBe("Hello there");
    expect(saved.musicShowOnInvitation).toBe(false);
    expect(saved.travelShowOnInvitation).toBe(false);
    expect(saved.storyTitle).toBe("How we met");
    expect(saved.colorPalette1).toBe("#1e3a5f");
    expect(saved.weddingDate).toBe("2026-06-20");
    expect(saved.ceremonyTime).toBe("14:30");
    expect(saved).not.toHaveProperty("dateDisplay");
  });

  it("Calendar View alone shows the wedding month with the day highlighted, and saves", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openDateTab();

    fireEvent.click(calendarSwitch());
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "true");
    expect(weddingDay()).toBeTruthy();
    expect(calendar()).toBeTruthy();
    expect(countdown()).toBeNull();

    expect(within(calendar()).getByText("June 2026")).toBeTruthy();
    const highlighted = calendar().querySelectorAll('[data-wedding-day="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toBe("20");
    expect(highlighted[0]).toHaveAttribute("aria-label", "Wedding day, June 20");
    // June 2026 has 30 days and starts on a Monday
    const firstRow = calendar().querySelectorAll("tbody tr")[0].querySelectorAll("td");
    expect(firstRow[0].textContent).toBe("");
    expect(firstRow[1].textContent).toBe("1");
    expect(within(calendar()).queryByText("31")).toBeNull();

    // Existing Add to calendar button stays in the section
    expect(within(weddingDay()).getByText("Add to calendar")).toBeTruthy();
    expect(within(weddingDay()).getByText("June 20, 2026 · 2:30 PM")).toBeTruthy();

    const saved = await saveAndGet();
    expect(saved).toMatchObject({ dateShowCalendar: true, dateShowCountdown: false });
  });

  it("highlights Feb 29 on a leap-year wedding", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, weddingDate: "2028-02-29", dateShowCalendar: true });
    renderBuilder();
    await openDateTab();
    expect(within(calendar()).getByText("February 2028")).toBeTruthy();
    expect(calendar().querySelector('[data-wedding-day="true"]').textContent).toBe("29");
  });

  it("Countdown alone shows days, hours, minutes and seconds, and saves", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 5, 18, 12, 0, 0)); // 2d 2h 30m before 2:30 PM on June 20
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openDateTab();

    fireEvent.click(countdownSwitch());
    expect(calendar()).toBeNull();
    expect(countdown()).toBeTruthy();
    const cd = countdown();
    expect(within(cd).getByTestId("countdown-days").textContent).toBe("2");
    expect(within(cd).getByTestId("countdown-hours").textContent).toBe("2");
    expect(within(cd).getByTestId("countdown-minutes").textContent).toBe("30");
    expect(within(cd).getByTestId("countdown-seconds").textContent).toBe("0");
    for (const label of ["Days", "Hours", "Min", "Sec"]) expect(within(cd).getByText(label)).toBeTruthy();

    const saved = await saveAndGet();
    expect(saved).toMatchObject({ dateShowCalendar: false, dateShowCountdown: true });
  });

  it("both options together show calendar and countdown; turning both off removes the section live", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openDateTab();

    fireEvent.click(calendarSwitch());
    fireEvent.click(countdownSwitch());
    expect(calendar()).toBeTruthy();
    expect(countdown()).toBeTruthy();
    // Only one Wedding Day section, never duplicated
    expect(preview().querySelectorAll('[data-section="date"]')).toHaveLength(1);

    let saved = await saveAndGet();
    expect(saved).toMatchObject({ dateShowCalendar: true, dateShowCountdown: true });

    fireEvent.click(calendarSwitch());
    expect(calendar()).toBeNull();
    expect(countdown()).toBeTruthy();
    fireEvent.click(countdownSwitch());
    expect(weddingDay()).toBeNull();

    saved = await saveAndGet();
    expect(saved).toMatchObject({ dateShowCalendar: false, dateShowCountdown: false });
  });

  it("restores saved settings on reload", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCalendar: true, dateShowCountdown: true });
    renderBuilder();
    await openDateTab();
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "true");
    expect(countdownSwitch()).toHaveAttribute("aria-checked", "true");
    expect(calendar()).toBeTruthy();
    expect(countdown()).toBeTruthy();

    cleanup();
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCalendar: false, dateShowCountdown: true });
    renderBuilder();
    await openDateTab();
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "false");
    expect(countdownSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("round-trips through save → reload", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE });
    renderBuilder();
    await openDateTab();
    fireEvent.click(countdownSwitch());
    const saved = await saveAndGet();

    cleanup();
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, ...saved, weddingId: "w1" });
    renderBuilder();
    await openDateTab();
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "false");
    expect(countdownSwitch()).toHaveAttribute("aria-checked", "true");
    expect(countdown()).toBeTruthy();
  });

  it("treats non-boolean stored values as OFF", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCalendar: "true", dateShowCountdown: 1 });
    renderBuilder();
    await openDateTab();
    expect(calendarSwitch()).toHaveAttribute("aria-checked", "false");
    expect(weddingDay()).toBeNull();
  });

  it("does not write date settings when the invitation failed to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fs.getInvitationByUser.mockRejectedValue(new Error("offline"));
    renderBuilder();
    await openDateTab();
    const saved = await saveAndGet();
    expect(saved).not.toHaveProperty("dateShowCalendar");
    expect(saved).not.toHaveProperty("dateShowCountdown");
    console.error.mockRestore();
  });

  it.each([
    ["missing", {}],
    ["empty", { weddingDate: "" }],
    ["invalid", { weddingDate: "2026-02-30" }],
  ])("shows a message instead of crashing when the wedding date is %s", async (_label, override) => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, ...override, weddingDate: override.weddingDate,
      dateShowCalendar: true, dateShowCountdown: true });
    renderBuilder();
    await openDateTab();

    expect(screen.getByText(/No wedding date set yet/)).toBeTruthy();
    expect(within(weddingDay()).getByTestId("wedding-date-missing").textContent)
      .toBe("The wedding date hasn't been set yet.");
    expect(calendar()).toBeNull();
    expect(countdown()).toBeNull();
    expect(within(weddingDay()).getByText("Add to calendar")).toBeTruthy();
  });

  it("shows a missing-date message with no invitation at all (new host)", async () => {
    fs.getInvitationByUser.mockResolvedValue(null);
    renderBuilder();
    await openDateTab();
    fireEvent.click(countdownSwitch());
    expect(within(weddingDay()).getByTestId("wedding-date-missing")).toBeTruthy();
  });

  it("counts down live and switches to a celebratory message when the wedding starts", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 5, 20, 14, 29, 58));
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCountdown: true });
    renderBuilder();
    await openDateTab();

    const seconds = () => within(countdown()).getByTestId("countdown-seconds").textContent;
    expect(seconds()).toBe("2");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(seconds()).toBe("1");
    act(() => { vi.advanceTimersByTime(1000); });

    expect(countdown()).toHaveAttribute("data-complete", "true");
    expect(within(countdown()).getByText("Just married! 🎉")).toBeTruthy();
    expect(within(countdown()).queryByTestId("countdown-seconds")).toBeNull();

    // Stays complete — never goes negative
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(countdown().textContent).not.toMatch(/-\d/);
    expect(vi.getTimerCount()).toBe(0); // the interval stopped
  });

  it("shows the celebratory message straight away for a past wedding", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCountdown: true, dateShowCalendar: true });
    renderBuilder();
    await openDateTab();
    expect(within(countdown()).getByText("Just married! 🎉")).toBeTruthy();
    expect(calendar()).toBeTruthy(); // the calendar still shows the wedding month
  });

  it("counts down to the start of the day when no ceremony time is set", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 5, 19, 23, 0, 0));
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, ceremonyTime: "", dateShowCountdown: true });
    renderBuilder();
    await openDateTab();
    expect(within(countdown()).getByTestId("countdown-hours").textContent).toBe("1");
    expect(within(countdown()).getByText("Counting down to the start of the day.")).toBeTruthy();
  });

  it("uses the selected Color Theme for the section while the switches keep builder colors", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0)); // before the wedding, so the countdown shows numbers
    fs.getInvitationByUser.mockResolvedValue({
      ...BASE, dateShowCalendar: true, dateShowCountdown: true,
      themePreset: "Navy", colorPalette1: "#1e3a5f", colorButton: "#1e3a5f",
      colorHeadingText: "#223344", sectionBackgrounds: { date: "#fdf2e9" },
    });
    renderBuilder();
    await openDateTab();

    expect(weddingDay().style.backgroundColor).toBe(rgb("#fdf2e9"));
    const heading = within(weddingDay()).getByText("Wedding Day");
    const heroHeading = within(preview()).getByText("Alex & Sam");
    expect(heading.style.fontFamily).toBe(heroHeading.style.fontFamily);
    expect(heading.style.color).toBe(heroHeading.style.color);

    // Highlighted day and countdown numbers follow the theme (button + heading colors)
    const addBtn = within(weddingDay()).getByText("Add to calendar");
    const dayCell = calendar().querySelector('[data-wedding-day="true"]');
    expect(dayCell.style.backgroundColor).toBe(addBtn.style.backgroundColor);
    expect(within(countdown()).getByTestId("countdown-days").style.fontFamily).toBe(heroHeading.style.fontFamily);

    // Builder chrome stays builder-colored regardless of the invitation theme
    expect(calendarSwitch().style.backgroundColor).toBe(rgb(BUILDER_UI.primary));
  });

  it("keeps the rest of the preview intact (Greetings, Venue, RSVP still render)", async () => {
    fs.getInvitationByUser.mockResolvedValue({ ...BASE, dateShowCalendar: true });
    renderBuilder();
    await openDateTab();
    for (const id of ["header", "greetings", "date", "venue", "rsvp", "closure"]) {
      expect(preview().querySelector(`[data-section="${id}"]`)).toBeTruthy();
    }
  });
});
