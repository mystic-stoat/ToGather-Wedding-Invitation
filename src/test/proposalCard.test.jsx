// src/test/proposalCard.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ProposalCard (src/components/ProposalCard.jsx): the Accept / Reject card for
// a change the wedding assistant proposed. It keeps its own table of fields,
// and a field missing from it gets NO card, so the proposal is saved but the
// couple can never answer it. This test pins that table to the Cloud
// Function's list of proposable fields.
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProposalCard from "@/components/ProposalCard";

// functions/ is CommonJS and deploys on its own, so load it the CommonJS way.
const require = createRequire(import.meta.url);
const { proposableKeys } = require("../../functions/field-registry");

// A believable new value for each field shape.
const SAMPLE = {
  groomName: { first: "Sam", middle: "", last: "Lee" },
  brideName: { first: "Alex", middle: "J", last: "Ng" },
  childrenPolicy: "adults_only",
  ceremonyTime: "16:00",
  colorPalette1: "#56642b",
  colorPalette2: "#ffffff",
  font1: "Lato",
  font2: "Nunito",
  mealOptions: [{ id: "m1", name: "Chicken", description: "" }],
  travelItems: [{ id: "t1", category: "hotel", name: "The Inn", mapUrl: "", description: "" }],
  registries: [{ id: "r1", name: "Zola", url: "https://zola.com", isVisible: true }],
};

const renderCard = (field) =>
  render(
    <ProposalCard
      proposal={{ id: "p1", field, oldValue: null, newValue: SAMPLE[field] ?? "Some value", reason: "They asked." }}
      busy={false}
      onDecide={() => {}}
    />
  );

describe("ProposalCard", () => {
  it.each(proposableKeys())("shows Accept / Reject for %s", (field) => {
    renderCard(field);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows a name as plain text, not [object Object]", () => {
    renderCard("brideName");
    expect(screen.getByText("Alex J Ng")).toBeInTheDocument();
  });

  it("tells the couple an address change leaves the map pin alone", () => {
    renderCard("venueAddress");
    expect(screen.getByText(/address text only/i)).toBeInTheDocument();
  });
});
