import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import { type Place, PlaceProviderError, placeSnapshot } from "./place";

function place(over: Partial<Place> & Pick<Place, "name">): Place {
  return {
    geonameId: 0,
    zone: "",
    currency: "",
    lat: 0,
    lon: 0,
    population: 0,
    country: "us",
    admin1: "",
    postal: "",
    ...over,
  };
}

const PARIS_FR = place({
  geonameId: 2988507,
  name: "Paris",
  country: "fr",
  population: 2138551,
  zone: "Europe/Paris",
  currency: "EUR",
  lat: 48.85341,
  lon: 2.3488,
});
const PARIS_TX = place({
  geonameId: 4717560,
  name: "Paris",
  country: "us",
  admin1: "TX",
  population: 25171,
  zone: "America/Chicago",
});
const PARIS_IL = place({
  geonameId: 4905599,
  name: "Paris",
  admin1: "IL",
  population: 8875,
});
const BEVERLY = place({
  name: "Beverly Hills",
  admin1: "CA",
  postal: "90210",
  lat: 34.0901,
  lon: -118.4065,
});

const snap = placeSnapshot("2026-08-05", [PARIS_TX, PARIS_FR, PARIS_IL, BEVERLY]);

test("the snapshot carries the date it was taken", () => {
  expect(snap.asOf).toBe("2026-08-05");
});

test("a name resolves to the largest place that answers to it", () => {
  // Not the insertion order: PARIS_TX is first in the array above precisely so
  // that a snapshot which returned it would fail here.
  expect(snap.find("Paris")).toBe(PARIS_FR);
});

test("lookup is case- and whitespace-insensitive", () => {
  expect(snap.find("  BEVERLY   hills ")).toBe(BEVERLY);
});

test("a postal code is one more name the row answers to", () => {
  expect(snap.find("90210")).toBe(BEVERLY);
});

test("a name nobody carries is null, not a throw", () => {
  expect(snap.find("atlantis")).toBeNull();
});

test("a country hint narrows to that country", () => {
  expect(snap.find("paris", { country: "US" })?.geonameId).toBe(PARIS_TX.geonameId);
});

test("an admin1 hint narrows within a country", () => {
  expect(snap.find("paris", { country: "us", admin1: "il" })?.geonameId).toBe(
    PARIS_IL.geonameId,
  );
});

test("a hint that selects nothing is null, not the unhinted winner", () => {
  // Deliberately the opposite of the matcher's rule in spec §5.2, where a scope
  // that selects nothing is dropped and the unscoped city claimed. That fallback
  // exists because the literal fold is destructive and a refused claim leaves
  // the token dangling. `find` has a caller who can read null, and handing back
  // Paris, France to one that asked for Japan is a wrong answer where null is a
  // true one.
  expect(snap.find("paris", { country: "jp" })).toBeNull();
});

test("the snapshot is frozen", () => {
  expect(Object.isFrozen(snap)).toBe(true);
});

test("a later snapshot of the same places is independent of the array it was built from", () => {
  const rows: Place[] = [PARIS_FR];
  const s = placeSnapshot("2026-08-05", rows);
  rows.push(PARIS_TX);
  expect(s.find("paris", { country: "us" })).toBeNull();
});

test("the provider error extends SmartputError and names the provider", () => {
  // Spec §7: `instanceof SmartputError` is the discriminator this codebase's own
  // engine branches on, so an error that does not extend it is invisible to a
  // consumer following the convention.
  const err = new PlaceProviderError("geonames", "request failed: 503");
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.provider).toBe("geonames");
  expect(err.name).toBe("PlaceProviderError");
  expect(err.message).toContain("geonames");
  expect(err.message).toContain("503");
  // Not "Rate provider ...", which is what reusing RateProviderError would have
  // printed at a user who never asked about a rate.
  expect(err.message).not.toContain("Rate");
});
