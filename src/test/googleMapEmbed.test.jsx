import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import GoogleMapEmbed, {
  buildMapQuery,
  mapEmbedSrc,
  mapLinkUrl,
} from "@/components/GoogleMapEmbed";

describe("buildMapQuery", () => {
  it("joins venue name and address", () => {
    expect(buildMapQuery("The Grand Pavilion", "1001 Main Street, Denton, TX"))
      .toBe("The Grand Pavilion, 1001 Main Street, Denton, TX");
  });

  it("skips empty parts and trims whitespace", () => {
    expect(buildMapQuery("  The Grand Pavilion  ", "")).toBe("The Grand Pavilion");
    expect(buildMapQuery(null, " 1001 Main Street ")).toBe("1001 Main Street");
    expect(buildMapQuery("", "")).toBe("");
    expect(buildMapQuery(undefined, undefined)).toBe("");
  });
});

describe("map URLs", () => {
  it("builds a standard keyless embed URL with an encoded query", () => {
    const src = mapEmbedSrc("The Grand Pavilion, 1001 Main Street");
    expect(src).toContain("https://www.google.com/maps");
    expect(src).toContain("output=embed");
    expect(src).toContain(`q=${encodeURIComponent("The Grand Pavilion, 1001 Main Street")}`);
    // standard Google styling — no custom style/map parameters
    expect(src).not.toContain("style=");
    expect(src).not.toContain("key=");
  });

  it("builds an external Google Maps link with an encoded query", () => {
    const url = mapLinkUrl("The Grand Pavilion, 1001 Main Street");
    expect(url).toContain("https://www.google.com/maps/search/");
    expect(url).toContain(`query=${encodeURIComponent("The Grand Pavilion, 1001 Main Street")}`);
  });
});

describe("GoogleMapEmbed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const flushDebounce = () => act(() => { vi.advanceTimersByTime(600); });

  it("renders a placeholder instead of a broken map when the query is empty", () => {
    render(<GoogleMapEmbed query="" />);
    flushDebounce();
    expect(screen.getByText(/enter a venue address/i)).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("renders a Google Maps iframe for a venue query", () => {
    render(<GoogleMapEmbed query="The Grand Pavilion, 1001 Main Street" />);
    flushDebounce();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toContain("output=embed");
    expect(iframe.getAttribute("src")).toContain(
      `q=${encodeURIComponent("The Grand Pavilion, 1001 Main Street")}`);
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer-when-downgrade");
  });

  it("updates the map src when the query changes", () => {
    const { rerender } = render(<GoogleMapEmbed query="Old Venue, 1 First St" />);
    flushDebounce();
    rerender(<GoogleMapEmbed query="New Venue, 2 Second St" />);
    flushDebounce();
    expect(document.querySelector("iframe").getAttribute("src"))
      .toContain(`q=${encodeURIComponent("New Venue, 2 Second St")}`);
  });

  it("renders a safe external Google Maps link when showLink is set", () => {
    render(<GoogleMapEmbed query="The Grand Pavilion, 1001 Main Street" showLink />);
    flushDebounce();
    const link = screen.getByRole("link", { name: /view in google maps/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("href")).toContain(
      `query=${encodeURIComponent("The Grand Pavilion, 1001 Main Street")}`);
  });
});
