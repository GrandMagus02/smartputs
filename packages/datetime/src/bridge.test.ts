import { expect, test } from "bun:test";
import {
  buildRegistry,
  composeLocale,
  createEngine,
  Decimal,
  type Kind,
  NoCandidateError,
  type Vocabulary,
} from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { place } from "@smartput/country";
import placeEn from "@smartput/country/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { datetime } from "./datetime";
import datetimeEn from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

/**
 * `vocabularies` rather than a constant list because half the engines below
 * register `place` and half deliberately do not, and a vocabulary for a kind
 * the registry never registered is a wiring error. It has to be `placeEn`
 * exactly when `place` is in `kinds`: a kind no language has spoken for is
 * indexed under its own unit keys, and `place`'s are the ISO alpha-2 codes —
 * which is how "pm" became Saint Pierre and "3pm" a country, the very
 * regression the first test below is the net for.
 */
const make = (kinds: Kind[], vocabularies: readonly Vocabulary[] = []) =>
  createEngine({
    locales: [composeLocale(coreEn, [...BUILTIN_EN, datetimeEn, ...vocabularies])],
    kinds,
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

const withGeo = make([...BUILTIN_KINDS, datetime, place], [placeEn]);
const withoutGeo = make([...BUILTIN_KINDS, datetime]);

/** The same engine `corpus.test.ts` builds, with geo added to it. */
const corpusEngine = make([...BUILTIN_KINDS, datetime, place], [placeEn]);

const CORPUS = (await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text())
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

/** The op table entry both halves of this file are about. */
const BRIDGE_KEY = "in|datetime|place";

// ---- half one: geo registered ----

test("a place is a conversion target", () => {
  // Asia/Tokyo the long way round: geo claims "japan" as a country literal and
  // datetime reads the zone off its meta, never having heard of a country.
  expect(withGeo.evaluate("15:00 in japan").formatted).toBe("2026-01-16 00:00 JST");
  expect(withGeo.evaluate("noon in ukraine").formatted).toBe("2026-01-15 14:00 Kyiv");
  expect(withGeo.evaluate("15:00 in united states").formatted).toBe(
    "2026-01-15 10:00 ET",
  );
});

test("the target zone need not be a datetime unit", () => {
  // The point of the bridge: America/Argentina/Buenos_Aires is not in ZONES, so
  // this conversion is unreachable through datetime's own units, and the zone
  // falls through the formatter as its own id rather than a symbol.
  const r = withGeo.evaluate("15:00 in argentina");
  expect(r.value.unit).toBe("America/Argentina/Buenos_Aires");
  expect(r.formatted).toBe("2026-01-15 12:00 America/Argentina/Buenos_Aires");
});

test("registering geo leaves this plugin's own readings alone", () => {
  // The regression this file caught: geo shipping every ISO code as a unit alias
  // made "pm" Saint Pierre and Miquelon and "ago" Angola, and the accept-gate
  // refuses a match whose letter runs are all units — so "3pm" resolved to a
  // country and "3 days ago" to nothing. Geo's alias index now carries names
  // only, and the corpus below is the assertion that it stays that way.
  expect(withGeo.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
  expect(withGeo.evaluate("3 days ago").formatted).toBe("2026-01-12 00:00 UTC");
  expect(withGeo.evaluate("in 3 days").formatted).toBe("2026-01-18 00:00 UTC");
});

test("the whole corpus reads the same with geo registered", () => {
  // Cheaper than a second corpus file and stricter than a sample: a plugin that
  // adds an alias to a global index can only be shown harmless input by input.
  for (const line of CORPUS) {
    const [input, , , formatted] = line.split("\t");
    expect(`${input} => ${corpusEngine.evaluate(input as string).formatted}`).toBe(
      `${input} => ${formatted}`,
    );
  }
});

test("a place carrying no zone is an unknown unit, not a Temporal RangeError", () => {
  // A place reached by its *unit alias* rather than by a claimed literal gets
  // evaluate.ts's stand-in right-hand side, which carries no zone at all.
  const sig = buildRegistry([datetime, place]).ops.get(BRIDGE_KEY);
  const afternoon = withoutGeo.evaluate("3pm").value;
  const bare = { kind: "place", unit: "jp", canonical: new Decimal(1861060) };
  const ctx = { self: afternoon, locale: "en", input: "3pm in jp" };
  expect(() => sig?.apply(afternoon, bare, ctx)).toThrow(NoCandidateError);
  expect(() => sig?.apply(afternoon, bare, ctx)).toThrow('Unknown unit "jp"');
  expect(() =>
    sig?.apply(afternoon, { ...bare, meta: { zone: "Mars/Olympus" } }, ctx),
  ).toThrow(NoCandidateError);
});

// ---- half two: geo absent, which is the claim of spec §3.1 ----

test("the signature is declared even when place is not a registered kind", () => {
  const registry = buildRegistry([...BUILTIN_KINDS, datetime]);
  expect(registry.kinds.has("place")).toBe(false);
  // Registry pass 4 never validates that a signature's operands name registered
  // kinds, so the entry is built and simply never keyed: no kind claims `place`,
  // so the solver cannot produce that operand.
  expect(registry.ops.has(BRIDGE_KEY)).toBe(true);
});

test("an engine without geo builds and behaves exactly as it did", () => {
  expect(withoutGeo.evaluate("3pm in tokyo").formatted).toBe("2026-01-16 00:00 JST");
  expect(withoutGeo.evaluate("3pm in nyc").formatted).toBe("2026-01-15 10:00 ET");
  expect(withoutGeo.evaluate("today").formatted).toBe("2026-01-15 00:00 UTC");
  expect(withoutGeo.evaluate("today + 3 d").formatted).toBe("2026-01-18 00:00 UTC");
  expect(withoutGeo.evaluate("tomorrow - today").formatted).toBe("1 day");
  expect(withoutGeo.evaluate("2 km + 300 m").formatted).toBe("2.3 kilometres");
});

test("a country is not a conversion target without geo", () => {
  // "japan" is a word this package's own vocabulary ships, so it reads with no
  // geo anywhere. "argentina" is only ever a country — the engine at the top of
  // this file reads it because `place` is registered there, and this one cannot.
  //
  // The example used to be "ukraine", back when the spelled-out zone names were
  // a `LocalePack` a caller opted into separately from the kind's own aliases.
  // Those two tiers are one `Vocabulary` now, so "ukraine" reaches Europe/Kyiv
  // wherever "kyiv" does, and a country with no zone behind it is what the
  // claim needs.
  expect(withoutGeo.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
  expect(() => withoutGeo.evaluate("15:00 in argentina")).toThrow(NoCandidateError);
});

test("datetime declares the bridge without depending on geo", async () => {
  // The dependency direction is the design (spec §3.1), so it is asserted here
  // as well as in check-deps: a stray `import type` would satisfy every test
  // above and quietly reverse it.
  const source = await Bun.file(new URL("./datetime.ts", import.meta.url)).text();
  expect(source).not.toContain("@smartput/country");
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
  expect(pkg.dependencies["@smartput/country"]).toBeUndefined();
  expect(pkg.devDependencies["@smartput/country"]).toBe("workspace:*");
});
