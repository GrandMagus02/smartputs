import { expect, test } from "bun:test";
import { ADMIN1, CITIES } from "@smartput/city";
import {
  buildRegistry,
  createEngine,
  type Kind,
  type LiteralMatch,
  type MatchCtx,
  type OpaqueSpec,
  type Registry,
} from "@smartput/core";
import en from "@smartput/core/locale/en";
import { length } from "@smartput/length";
import { number } from "@smartput/number";
import { COUNTRIES } from "./data/countries";
import { MIN_NAME_LENGTH } from "./matcher";
import { definePlace, place } from "./place";

const engine = createEngine({ locales: [en], kinds: [number, length, place] });
const registry = buildRegistry([number, length, place], [], "en");
const units = registry.kinds.get("place")?.units;

/**
 * The other half of the factory: the same kind with T1 loaded. Built here rather
 * than in a `beforeAll` because every assertion below is about the difference
 * between the two, so both have to exist side by side in one process — which is
 * also the only proof that `definePlace` returns an independent Kind and not a
 * mutated singleton.
 */
const cityPlace = definePlace({ cities: CITIES, admin1: ADMIN1 });
const cityEngine = createEngine({ locales: [en], kinds: [number, length, cityPlace] });
const cityRegistry = buildRegistry([number, length, cityPlace], [], "en");
const cityUnits = cityRegistry.kinds.get("place")?.units;

/**
 * The name matcher, which is the first of the two the kind registers — the
 * postal one is `postal.test.ts`'s subject and has its own file.
 *
 * Every reading it claims, ranked, since M6.3 lets one span have several and a
 * matcher with one still returns it bare.
 */
function nameReadingsOf(kind: Kind) {
  const m = kind.literals?.[0];
  if (m === undefined) throw new Error("the kind registers no matcher");
  return (input: string, offset: number, ctx: MatchCtx): readonly LiteralMatch[] => {
    const result = m(input, offset, ctx);
    if (result === null) return [];
    return Array.isArray(result) ? result : [result as LiteralMatch];
  };
}

const matchCtx: MatchCtx = {
  locale: "en",
  now: 0,
  timeZone: "UTC",
  isUnitAlias: (text) => registry.aliasIndex.has(text.toLowerCase()),
};

/** Every global-index key that any place unit put there, in either build. */
function placeAliases(reg: Registry): string[] {
  return [...reg.aliasIndex.entries()]
    .filter(([, entries]) => entries.some((e) => e.kind === "place"))
    .map(([key]) => key);
}

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

test("the kind declares two matchers and one op", () => {
  // Names and codes (spec §5.1, §6.2). Both are registered in every build,
  // because a postal format is T0 data — one column of COUNTRIES — and gating it
  // on `cities` would tie a country's own format to a gazetteer.
  expect(place.literals).toHaveLength(2);
  expect(definePlace({ cities: CITIES, admin1: ADMIN1 }).literals).toHaveLength(2);
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

test("the countries-only build knows no city", () => {
  // Asserted on the matcher as well as through the engine: an engine throw only
  // says nothing read "kyiv", while a null claim says the trie never carried it,
  // which is what "@smartput/geo" alone not paying for T1 actually means.
  expect(nameReadingsOf(place)("kyiv", 0, matchCtx)).toEqual([]);
  expect(() => engine.evaluate("kyiv")).toThrow();
});

test("a kind built with the city table reads one", () => {
  const r = cityEngine.evaluate("kyiv");
  expect(r.kind).toBe("place");
  // The city's own GeoNames id, not Ukraine's — the difference between reading
  // the city and falling through to the country it happens to sit in.
  expect(r.value.canonical.toString()).toBe("703448");
});

test("a city's unit is its country, which is why the unit is always registered", () => {
  // The invariant `properties.test.ts` asserts over T0, restated where T1 can
  // break it: a city is not a unit, so its Value has to borrow one, and the only
  // unit that describes it is its country's alpha-2. `LiteralMatch.unit` naming
  // something unregistered is a resolver error, not a bad reading.
  const v = cityEngine.evaluate("kyiv").value;
  const meta = v.meta as Record<string, unknown>;
  expect(v.unit).toBe("ua");
  expect(meta.country).toBe(v.unit);
  expect(cityUnits?.has(v.unit)).toBe(true);
});

test("every city alias that claims still resolves to a registered country unit", () => {
  const readings = nameReadingsOf(cityPlace);
  let claimed = 0;
  for (const row of CITIES) {
    for (const alias of row.aliases) {
      // Empty where the alias is a word the matcher refuses; the property is
      // about what a claim looks like, not about which row wins. Every reading
      // is checked and not just the winner — a runner-up naming a unit the kind
      // does not register is the same resolver error, and it is now reachable.
      for (const match of readings(alias, 0, matchCtx)) {
        claimed += 1;
        const meta = match.meta as Record<string, unknown>;
        expect(match.kind).toBe("place");
        expect(cityUnits?.has(match.unit)).toBe(true);
        expect(meta.country).toBe(match.unit);
        expect(match.canonical.toString()).toBe(String(meta.geonameId));
      }
    }
  }
  expect(claimed).toBeGreaterThan(CITIES.length / 2);
});

test("cities are not units, in either build", () => {
  // COUNTRY_UNITS is the same table both ways round. Six thousand more opaque
  // units would be six thousand more rows in a global alias index that no weight
  // can undo a claim from — the whole reason a city is reachable only by trie.
  expect(cityUnits?.size).toBe(units?.size);
  const codes = new Set(COUNTRIES.map((c) => c.a2));
  for (const unit of cityUnits?.keys() ?? []) expect(codes.has(unit)).toBe(true);
  expect(cityUnits?.has("703448")).toBe(false);
});

test("no place alias below MIN_NAME_LENGTH reaches the global index, in either build", () => {
  // The M6.1 finding, re-run with T1 present: "km" is Comoros and "pm" is Saint
  // Pierre, and putting either in cost twelve corpus rows their reading. The
  // filter is on COUNTRY_UNITS, so this passes for the second build only as long
  // as loading cities does not start registering units of its own.
  for (const reg of [registry, cityRegistry]) {
    const short = placeAliases(reg).filter((a) => a.length < MIN_NAME_LENGTH);
    expect(short).toEqual([]);
  }
  // The stronger statement, and the one that actually holds T1 out: passing the
  // city table changes the global index by nothing at all.
  expect(placeAliases(cityRegistry)).toEqual(placeAliases(registry));
});

const placeSource = await Bun.file(new URL("./place.ts", import.meta.url)).text();

test("the entry point never pulls the city table into a bundle", () => {
  // The factory only saves a consumer the ~180 KB of T1 if `place.ts` reaches it
  // through the caller's argument. One static import re-links the table into
  // every build of "@smartput/country" and the seam is worth nothing, so it is
  // asserted on the source rather than trusted to review.
  //
  // The split moved the tables to `@smartput/city`, which makes the import that
  // would do it a package name rather than a path — and `import type` from
  // `@smartput/city/types` is the one form that is fine, because it compiles
  // away. So the pattern below refuses a value import of that package and lets
  // the type one through.
  expect(placeSource).not.toMatch(/^import\s+(?!type\b)[^;]*"@smartput\/city/m);
  expect(placeSource).toMatch(/^import type .*"@smartput\/city\/types"/m);
});

test("and neither does anything the entry point re-exports", async () => {
  // The line above reads one file, which was the whole entry point until M6.4
  // widened it. `index.ts` now re-exports two more modules, and a static import
  // three hops away links the gazetteer just as thoroughly as one in `place.ts`
  // — so the claim is made about the graph rather than about the one file that
  // used to be all of it. Bundling and weighing the output was the alternative:
  // it measures the real thing, and it makes the failure "the number moved"
  // instead of naming the import that moved it.
  const seen = new Set<string>();
  const reached: string[] = [];
  const sources: string[] = [];

  const walk = async (from: URL): Promise<void> => {
    if (seen.has(from.href)) return;
    seen.add(from.href);
    reached.push(from.pathname.split("/").slice(-2).join("/"));

    const source = await Bun.file(from).text();
    sources.push(source);
    // Static forms only, which is the point: `import()` is a split and it is how
    // `@smartput/city` is meant to be reached. The body may span lines —
    // `index.ts`'s own re-exports do — so the only thing it may not cross is the
    // semicolon that ends the statement, which is what keeps one match from
    // running into the next statement's specifier.
    for (const [, spec] of source.matchAll(
      /(?:^|\n)(?:import|export)[^;]*?from\s+"(\.[^"]+)"/g,
    )) {
      await walk(new URL(`${spec}.ts`, from));
    }
  };

  await walk(new URL("./index.ts", import.meta.url));

  expect(reached).toContain("src/place.ts");
  expect(reached).toContain("src/completion.ts");
  expect(reached).toContain("src/postal-formats.ts");
  // Nothing the entry point re-exports may name the gazetteer as a value. The
  // relative walk above cannot see across a package boundary, so the check that
  // holds T1 out is this one: a bare `@smartput/city` anywhere in the graph is
  // the whole table, and only the erased `import type` form is allowed.
  for (const source of sources) {
    expect(source).not.toMatch(/^import\s+(?!type\b)[^;]*"@smartput\/city/m);
  }
});
