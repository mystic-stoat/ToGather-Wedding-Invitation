// Unit tests for src/lib/travelStay.js — pure helpers, no Firebase needed.
import { describe, it, expect } from "vitest";
import {
  TRAVEL_CATEGORIES,
  getTravelCategoryLabel,
  isSafeHttpUrl,
  createTravelItem,
  normalizeTravelItems,
  validateTravelItems,
  cleanTravelItemsForSave,
  getVisibleTravelItems,
  getTravelShowOnInvitation,
  shouldShowTravelSection,
} from "@/lib/travelStay";

describe("isSafeHttpUrl", () => {
  it("accepts http and https links, including Google Maps share links", () => {
    expect(isSafeHttpUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isSafeHttpUrl("https://www.google.com/maps/place/Hyatt+Regency+Dallas")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("  https://example.com  ")).toBe(true);
  });

  it("rejects unsafe or malformed values", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
    expect(isSafeHttpUrl("maps.google.com/place")).toBe(false);
    expect(isSafeHttpUrl("/relative/path")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl(42)).toBe(false);
  });
});

describe("categories", () => {
  it("offers Hotel, Restaurant, Airport and Other", () => {
    expect(TRAVEL_CATEGORIES.map(c => c.label)).toEqual(["Hotel", "Restaurant", "Airport", "Other"]);
  });

  it("labels unknown categories as Other", () => {
    expect(getTravelCategoryLabel("hotel")).toBe("Hotel");
    expect(getTravelCategoryLabel("spaceport")).toBe("Other");
  });
});

describe("createTravelItem", () => {
  it("creates a blank hotel place with a unique id", () => {
    const a = createTravelItem();
    const b = createTravelItem();
    expect(a).toMatchObject({ category: "hotel", name: "", mapUrl: "", description: "" });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});

describe("normalizeTravelItems (backward compatibility)", () => {
  it("treats missing or non-array data as no places", () => {
    expect(normalizeTravelItems(undefined)).toEqual([]);
    expect(normalizeTravelItems(null)).toEqual([]);
    expect(normalizeTravelItems("Hotel")).toEqual([]);
  });

  it("fills missing fields and fixes unknown categories", () => {
    expect(normalizeTravelItems([{ id: "a", name: "Hyatt" }, null, { id: "b", category: "boat", name: 5 }]))
      .toEqual([
        { id: "a", category: "other", name: "Hyatt", mapUrl: "", description: "" },
        { id: "b", category: "other", name: "", mapUrl: "", description: "" },
      ]);
  });
});

describe("validateTravelItems", () => {
  it("ignores completely empty places", () => {
    expect(validateTravelItems([{ id: "a", name: "", mapUrl: "", description: "  " }])).toEqual({});
  });

  it("requires a name once anything is filled in", () => {
    expect(validateTravelItems([{ id: "a", name: "", mapUrl: "", description: "Close to venue" }]))
      .toEqual({ a: { name: "Place name is required." } });
  });

  it("allows an empty link but rejects unsafe links", () => {
    expect(validateTravelItems([{ id: "a", name: "Hyatt", mapUrl: "" }])).toEqual({});
    expect(validateTravelItems([{ id: "a", name: "Hyatt", mapUrl: "javascript:alert(1)" }]))
      .toEqual({ a: { mapUrl: "Enter a valid http:// or https:// link." } });
  });
});

describe("cleanTravelItemsForSave", () => {
  it("trims text, drops empty places and keeps ids", () => {
    const cleaned = cleanTravelItemsForSave([
      { id: "a", category: "hotel", name: "  Hyatt Regency Dallas ", mapUrl: " https://maps.app.goo.gl/x ", description: " Closest hotel " },
      { id: "b", category: "hotel", name: "", mapUrl: "", description: "" },
      { category: "nope", name: "Love Field" },
    ]);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).toEqual({
      id: "a", category: "hotel", name: "Hyatt Regency Dallas",
      mapUrl: "https://maps.app.goo.gl/x", description: "Closest hotel",
    });
    expect(cleaned[1].category).toBe("other");
    expect(cleaned[1].id).toBeTruthy();
  });
});

describe("visibility", () => {
  it("only shows named places and strips unsafe links", () => {
    const visible = getVisibleTravelItems([
      { id: "a", name: "Hyatt", mapUrl: "https://maps.app.goo.gl/x" },
      { id: "b", name: "Bad Link Inn", mapUrl: "javascript:alert(1)" },
      { id: "c", name: "   " },
    ]);
    expect(visible.map(v => v.id)).toEqual(["a", "b"]);
    expect(visible[0].mapUrl).toBe("https://maps.app.goo.gl/x");
    expect(visible[1].mapUrl).toBe("");
  });

  it("defaults the toggle to on for older invitations", () => {
    expect(getTravelShowOnInvitation({})).toBe(true);
    expect(getTravelShowOnInvitation({ travelShowOnInvitation: false })).toBe(false);
  });

  it("shows the section only when the toggle is on and a place has a name", () => {
    const places = [{ id: "a", name: "Hyatt" }];
    expect(shouldShowTravelSection({})).toBe(false);
    expect(shouldShowTravelSection({ travelItems: [{ id: "a", name: "" }] })).toBe(false);
    expect(shouldShowTravelSection({ travelItems: places })).toBe(true);
    expect(shouldShowTravelSection({ travelItems: places, travelShowOnInvitation: false })).toBe(false);
  });
});
