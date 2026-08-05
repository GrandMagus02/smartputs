import { expect, test } from "bun:test";
import { buildRegistry, createEngine, type OpaqueSpec } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { length } from "@smartput/length";
import { number } from "@smartput/number";
import { place } from "./place";

const engine = createEngine({ locales: [en], kinds: [number, length, place] });
const registry = buildRegistry([number, length, place], [], "en");
const units = registry.kinds.get("place")?.units;

test("countries are the units, keyed by alpha-2", () => {
  expect(units?.has("jp")).toBe(true);
  expect(units?.has("ua")).toBe(true);
  expect(units?.get("jp")?.lexeme.symbol).toBe("Japan");
  expect(units?.get("gb")?.lexeme.aliases).toContain("united kingdom");
});

test("a country's codes are not aliases, because the alias index is global", () => {
  // An alias is indexed for every kind at once, so "km" as Comoros makes "10 km"
  // ambiguous with the kilometre, "pm" as Saint Pierre makes "3pm" a country,
  // and "ago" as Angola makes "3 days ago" unparseable. The codes stay in the
  // matcher's trie, where the fold offers them a guard the index cannot.
  expect(units?.get("gb")?.lexeme.aliases).not.toContain("gb");
  expect(units?.get("gb")?.lexeme.aliases).not.toContain("gbr");
  const short = [...(units?.values() ?? [])].flatMap((u) =>
    u.lexeme.aliases.filter((a) => a.length < 4),
  );
  expect(short).toEqual([]);
});

test("identity rides on canonical, so no equals is declared", () => {
  // canonical is the GeoNames id (spec §4.2) and the default equals compares
  // canonicals, so declaring one would only be a second definition to drift.
  expect((place.value as OpaqueSpec).equals).toBeUndefined();
});

test("the kind declares one matcher and one op", () => {
  expect(place.literals).toHaveLength(1);
  expect(place.ops).toHaveLength(1);
});

test("a bare country evaluates to a place", () => {
  const r = engine.evaluate("japan");
  expect(r.kind).toBe("place");
  expect(r.value.unit).toBe("jp");
  expect(r.value.canonical.toString()).toBe("1861060");
});

test("the value carries the bridge meta datetime and rates read", () => {
  const meta = engine.evaluate("japan").value.meta as Record<string, unknown>;
  expect(meta.zone).toBe("Asia/Tokyo");
  expect(meta.currency).toBe("JPY");
  expect(meta.country).toBe("jp");
  expect(meta.geonameId).toBe(1861060);
  expect(meta.lat).toBe(35.6895);
  expect(meta.lon).toBe(139.69171);
  expect(meta.population).toBe(126529100);
});

test("a multi-word name is one literal", () => {
  const r = engine.evaluate("united kingdom");
  expect(r.kind).toBe("place");
  expect(r.value.unit).toBe("gb");
});

test("place to place is a distance, and says what it assumed", () => {
  const r = engine.evaluate("japan to ukraine");
  expect(r.kind).toBe("length");
  expect(r.meta.assumptions.map((a) => a.code)).toContain("great-circle");
});

test("the conversion target keeps its own identity", () => {
  // The target of `in` is normally a unit label with no value behind it, and
  // the stand-in the evaluator makes for it borrows the LEFT operand's meta.
  // If that stand-in reached this signature, every distance would be zero.
  expect(engine.evaluate("japan to ukraine").value.canonical.toString()).toBe("8198981");
  expect(engine.evaluate("japan to japan").value.canonical.toString()).toBe("0");
});

test("a distance is an ordinary length afterwards", () => {
  // The point of returning a length rather than a place-shaped answer: every
  // conversion the length kind already generated works on the result.
  const r = engine.evaluate("france to germany in mi");
  expect(r.kind).toBe("length");
  expect(r.formatted).toBe("545.81183389008192157798457 miles");
});
