import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import type { Place } from "./place";
import { applyFilters, cacheKey, GeocodeError, type GeocodeHit, toQuery } from "./query";

function place(over: Partial<Place> = {}): Place {
  return {
    geonameId: 1,
    name: "Berlin",
    zone: "Europe/Berlin",
    currency: "",
    lat: 52.52,
    lon: 13.405,
    population: 3_600_000,
    country: "de",
    admin1: "16",
    postal: "",
    ...over,
  };
}

function hit(over: Partial<GeocodeHit> = {}): GeocodeHit {
  return {
    place: place(over.place),
    kind: "city",
    score: 0.5,
    matched: "berlin",
    source: "stub",
    ...over,
  };
}

test("a bare string is sugar for a query", () => {
  expect(toQuery("berlin")).toEqual({ text: "berlin" });
  expect(toQuery({ text: "berlin", limit: 3 })).toEqual({ text: "berlin", limit: 3 });
});

test("the cache key folds text the way the trie does", () => {
  expect(cacheKey(toQuery("  BERLIN  "))).toBe(cacheKey(toQuery("berlin")));
});

test("the cache key separates queries that differ only by a filter", () => {
  const a = cacheKey({ text: "paris", countries: ["fr"] });
  const b = cacheKey({ text: "paris", countries: ["us"] });
  expect(a).not.toBe(b);
});

test("the cache key is order-insensitive on set-like filters", () => {
  const a = cacheKey({
    text: "paris",
    countries: ["us", "fr"],
    kinds: ["city", "admin"],
  });
  const b = cacheKey({
    text: "paris",
    countries: ["fr", "us"],
    kinds: ["admin", "city"],
  });
  expect(a).toBe(b);
});

test("the cache key ignores the signal, which is not part of the question", () => {
  const controller = new AbortController();
  expect(cacheKey({ text: "paris", signal: controller.signal })).toBe(
    cacheKey({ text: "paris" }),
  );
});

test("countries filter, case-insensitively", () => {
  const hits = [hit(), hit({ place: place({ geonameId: 2, country: "fr" }) })];
  expect(applyFilters(hits, { text: "x", countries: ["DE"] })).toHaveLength(1);
});

test("kinds filter", () => {
  const hits = [hit(), hit({ kind: "postal" })];
  expect(applyFilters(hits, { text: "x", kinds: ["postal"] })).toHaveLength(1);
});

test("a bbox drops what falls outside it", () => {
  const inside = hit();
  const outside = hit({ place: place({ geonameId: 2, lat: -33.87, lon: 151.21 }) });
  const q = { text: "x", bbox: [13, 52, 14, 53] } as const;
  expect(applyFilters([inside, outside], { ...q })).toEqual([inside]);
});

test("near never removes a result — it is a bias, not a filter", () => {
  const hits = [hit(), hit({ place: place({ geonameId: 2, lat: -33.87, lon: 151.21 }) })];
  expect(applyFilters(hits, { text: "x", near: { lat: 52.5, lon: 13.4 } })).toHaveLength(
    2,
  );
});

test("GeocodeError is a SmartputError and carries its causes", () => {
  const causes = [new Error("a"), new Error("b")];
  const err = new GeocodeError("every provider failed", causes);
  expect(err).toBeInstanceOf(SmartputError);
  expect(err.name).toBe("GeocodeError");
  expect(err.causes).toEqual(causes);
});
