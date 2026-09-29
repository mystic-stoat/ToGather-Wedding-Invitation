import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";

// ── Mock Google Places (New) surface ──────────────────────────────────────────
const mockPlace = {
  displayName: "Dallas Arboretum and Botanical Garden",
  formattedAddress: "8525 Garland Rd, Dallas, TX 75218",
  id: "ChIJtestPlaceId",
  location: { lat: () => 32.8235, lng: () => -96.7165 },
  googleMapsURI: "https://maps.google.com/?cid=test",
  fetchFields: vi.fn().mockResolvedValue(undefined),
};

const suggestionOf = (main, secondary, placeId, place) => ({
  placePrediction: {
    placeId,
    text: { text: `${main}, ${secondary}` },
    mainText: { text: main },
    secondaryText: { text: secondary },
    toPlace: () => place,
  },
});

const makeSuggestions = () => [
  suggestionOf("Dallas Arboretum and Botanical Garden", "8525 Garland Rd, Dallas, TX", "p1", mockPlace),
  suggestionOf("Dallas Arboretum Parking", "8720 Garland Rd, Dallas, TX", "p2", mockPlace),
];

const installGoogle = (fetchImpl) => {
  window.google = {
    maps: {
      places: {
        AutocompleteSessionToken: vi.fn(),
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions:
            fetchImpl ?? vi.fn().mockResolvedValue({ suggestions: makeSuggestions() }),
        },
      },
    },
  };
};

const setup = (props = {}) => {
  const onChange = props.onChange ?? vi.fn();
  const onPlaceSelect = props.onPlaceSelect ?? vi.fn();
  render(
    <PlaceAutocompleteInput
      aria-label="Venue location"
      value={props.value ?? ""}
      onChange={onChange}
      onPlaceSelect={onPlaceSelect}
      placeholder="Start typing…"
    />
  );
  return { onChange, onPlaceSelect, input: screen.getByLabelText("Venue location") };
};

beforeEach(() => {
  mockPlace.fetchFields.mockClear();
});

afterEach(() => {
  delete window.google;
});

describe("PlaceAutocompleteInput", () => {
  it("fetches suggestions debounced while typing", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ suggestions: makeSuggestions() });
    installGoogle(fetchSpy);
    const { input } = setup();

    fireEvent.change(input, { target: { value: "Dallas Arb" } });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });

    const req = fetchSpy.mock.calls[0][0];
    expect(req.input).toBe("Dallas Arb");
    expect(req.includedRegionCodes).toEqual(["us"]);
    expect(req.sessionToken).toBeDefined();
  });

  it("renders Google-style suggestions with Powered by Google attribution", async () => {
    installGoogle();
    const { input } = setup();
    fireEvent.change(input, { target: { value: "Dallas Arb" } });

    expect(await screen.findByText("Dallas Arboretum and Botanical Garden")).toBeInTheDocument();
    expect(screen.getByText("8525 Garland Rd, Dallas, TX")).toBeInTheDocument();
    expect(screen.getByText(/powered by google/i)).toBeInTheDocument();
  });

  it("selecting a suggestion fetches place details and reports all fields", async () => {
    installGoogle();
    const { input, onPlaceSelect } = setup();
    fireEvent.change(input, { target: { value: "Dallas Arb" } });

    fireEvent.click(await screen.findByText("Dallas Arboretum and Botanical Garden"));
    await waitFor(() => expect(onPlaceSelect).toHaveBeenCalledTimes(1));

    expect(mockPlace.fetchFields).toHaveBeenCalledWith({
      fields: ["displayName", "formattedAddress", "id", "location", "googleMapsURI"],
    });
    expect(onPlaceSelect).toHaveBeenCalledWith({
      name: "Dallas Arboretum and Botanical Garden",
      address: "8525 Garland Rd, Dallas, TX 75218",
      placeId: "ChIJtestPlaceId",
      lat: 32.8235,
      lng: -96.7165,
      url: "https://maps.google.com/?cid=test",
    });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("supports keyboard navigation: ArrowDown + Enter selects", async () => {
    installGoogle();
    const { input, onPlaceSelect } = setup();
    fireEvent.change(input, { target: { value: "Dallas Arb" } });
    await screen.findByRole("listbox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onPlaceSelect).toHaveBeenCalledTimes(1));
  });

  it("shows a no-results state when Google returns nothing", async () => {
    installGoogle(vi.fn().mockResolvedValue({ suggestions: [] }));
    const { input } = setup();
    fireEvent.change(input, { target: { value: "zzzz nowhere" } });

    expect(await screen.findByText(/no matching places/i)).toBeInTheDocument();
  });

  it("does not query Google for empty input and keeps manual typing working", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ suggestions: makeSuggestions() });
    installGoogle(fetchSpy);
    const onChange = vi.fn();
    const selectSpy = vi.fn();

    const Stateful = () => {
      const [v, setV] = useState("");
      return (
        <PlaceAutocompleteInput
          aria-label="Venue location"
          value={v}
          onChange={x => { onChange(x); setV(x); }}
          onPlaceSelect={selectSpy}
        />
      );
    };
    render(<Stateful />);
    const input = screen.getByLabelText("Venue location");

    // type → suggestion fetch happens once
    fireEvent.change(input, { target: { value: "Dallas Arb" } });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onChange).toHaveBeenCalledWith("Dallas Arb");

    // clear → no further Google request
    fireEvent.change(input, { target: { value: "" } });
    await new Promise(r => setTimeout(r, 400));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("degrades to a plain input when the Google request fails", async () => {
    installGoogle(vi.fn().mockRejectedValue(new Error("API down")));
    const onChange = vi.fn();
    const { input } = setup({ onChange });

    fireEvent.change(input, { target: { value: "Dallas Arb" } });
    await new Promise(r => setTimeout(r, 400));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).toHaveBeenCalledWith("Dallas Arb");
    expect(input.value).toBe("");
  });

  it("never loads Google when the API key is missing — plain input only", async () => {
    delete window.google;
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const fetchSpy = vi.fn();
    const onChange = vi.fn();
    const { input } = setup({ onChange });

    fireEvent.change(input, { target: { value: "8525 Garland" } });
    await new Promise(r => setTimeout(r, 400));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).toHaveBeenCalledWith("8525 Garland");
    vi.unstubAllEnvs();
  });
});
