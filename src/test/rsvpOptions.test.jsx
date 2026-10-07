// Unit tests for src/lib/rsvpOptions.js — pure helpers, no Firebase needed.
import { describe, it, expect } from "vitest";
import {
  getWeddingChildrenPolicy,
  getGuestChildrenOverride,
  getEffectiveChildrenPolicy,
  normalizeMealOptions,
  cleanMealOptionsForSave,
  getMealLabel,
  normalizePlusOnes,
  getAttendanceStats,
} from "@/lib/rsvpOptions";

describe("children policy", () => {
  it("treats a missing wedding policy as allowed", () => {
    expect(getWeddingChildrenPolicy({})).toBe("allowed");
    expect(getWeddingChildrenPolicy(null)).toBe("allowed");
    expect(getWeddingChildrenPolicy({ childrenPolicy: "something-else" })).toBe("allowed");
    expect(getWeddingChildrenPolicy({ childrenPolicy: "adults_only" })).toBe("adults_only");
  });

  it("treats a missing guest override as inherit", () => {
    expect(getGuestChildrenOverride({})).toBe("inherit");
    expect(getGuestChildrenOverride({ childrenPolicyOverride: "default" })).toBe("inherit");
    expect(getGuestChildrenOverride({ childrenPolicyOverride: "allowed" })).toBe("allowed");
  });

  it("inherits the wedding policy unless the guest overrides it", () => {
    const adultsOnly = { childrenPolicy: "adults_only" };
    expect(getEffectiveChildrenPolicy(adultsOnly, { childrenPolicyOverride: "inherit" })).toBe("adults_only");
    expect(getEffectiveChildrenPolicy(adultsOnly, {})).toBe("adults_only");
    expect(getEffectiveChildrenPolicy(adultsOnly, { childrenPolicyOverride: "allowed" })).toBe("allowed");

    const kids = { childrenPolicy: "allowed" };
    expect(getEffectiveChildrenPolicy(kids, { childrenPolicyOverride: "inherit" })).toBe("allowed");
    expect(getEffectiveChildrenPolicy(kids, { childrenPolicyOverride: "adults_only" })).toBe("adults_only");

    // Neither set → allowed
    expect(getEffectiveChildrenPolicy({}, {})).toBe("allowed");
  });
});

describe("meal options", () => {
  it("returns [] when nothing is configured", () => {
    expect(normalizeMealOptions(undefined)).toEqual([]);
    expect(normalizeMealOptions("Chicken")).toEqual([]);
  });

  it("keeps valid options and drops unnamed ones", () => {
    expect(
      normalizeMealOptions([
        { id: "a", name: " Steak ", description: "Sirloin" },
        { id: "b", name: "  " },
        null,
      ])
    ).toEqual([{ id: "a", name: "Steak", description: "Sirloin" }]);
  });

  it("accepts plain-string options defensively", () => {
    expect(normalizeMealOptions(["Chicken"])).toEqual([
      { id: "Chicken", name: "Chicken", description: "" },
    ]);
  });

  it("cleans builder rows before save", () => {
    const cleaned = cleanMealOptionsForSave([
      { id: "a", name: " Steak ", description: " Sirloin " },
      { id: "b", name: "", description: "orphan" },
      { name: "Chicken" },
    ]);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]).toEqual({ id: "a", name: "Steak", description: "Sirloin" });
    expect(cleaned[1].name).toBe("Chicken");
    expect(typeof cleaned[1].id).toBe("string");
    expect(cleaned[1].id.length).toBeGreaterThan(0);
  });
});

describe("meal labels and plus-ones", () => {
  const options = [{ id: "m1", name: "Steak", description: "" }];

  it("prefers the stored name snapshot", () => {
    expect(getMealLabel({ mealId: "m1", meal: "Old Steak Name" }, options)).toBe("Old Steak Name");
  });

  it("falls back to the option name by id, then empty", () => {
    expect(getMealLabel({ mealId: "m1" }, options)).toBe("Steak");
    expect(getMealLabel({ mealId: "gone" }, options)).toBe("");
    expect(getMealLabel({}, options)).toBe("");
  });

  it("keeps old plus-one records like { name, meal: 'chicken' } working", () => {
    const [p] = normalizePlusOnes([{ name: "Sam", meal: "chicken" }]);
    expect(p).toEqual({ name: "Sam", mealId: "", meal: "chicken", dietaryRestrictions: "" });
    expect(getMealLabel(p, options)).toBe("chicken");
    expect(normalizePlusOnes(undefined)).toEqual([]);
  });
});

describe("attendance stats", () => {
  it("separates invitation records from people attending", () => {
    const guests = [
      { rsvpStatus: "Accepted", plusOneLimit: 3, plusOnes: [{ name: "A" }] }, // 1 + 1
      { rsvpStatus: "Accepted", plusOneLimit: 2, plusOnes: [] },              // 1
      { rsvpStatus: "Accepted" },                                             // 1 (old doc, no plusOnes)
      { rsvpStatus: "Declined", plusOneLimit: 2, plusOnes: [{ name: "stale" }] }, // 0
      { rsvpStatus: "Pending",  plusOneLimit: 3, plusOnes: [] },              // 0
      { rsvpStatus: "Accepted", plusOnes: [{ name: "B", meal: "chicken" }, { name: "C" }] }, // 1 + 2
    ];
    expect(getAttendanceStats(guests)).toEqual({
      invitations: 6,
      acceptedPlusOnes: 3,
      attending: 7,
    });
  });

  it("never counts plusOneLimit and handles empty input", () => {
    expect(getAttendanceStats([{ rsvpStatus: "Accepted", plusOneLimit: 3 }]).attending).toBe(1);
    expect(getAttendanceStats(undefined)).toEqual({ invitations: 0, acceptedPlusOnes: 0, attending: 0 });
  });
});
