import { expect, test } from "bun:test";
import {
  buildRegistry,
  createEngine,
  Decimal,
  type Kind,
  NoCandidateError,
} from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { place } from "@smartput/geo";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { datetime } from "./datetime";
import en from "./locale/en";
import { TEST_NOW, TEST_ZONE } from "./temporal";

const make = (kinds: Kind[]) =>
  createEngine({
    locales: [coreEn],
    kinds,
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

const withGeo = make([...BUILTIN_KINDS, datetime, place]);
const withoutGeo = make([...BUILTIN_KINDS, datetime]);

/** The same engine `corpus.test.ts` builds, with geo added to it. */
const corpusEngine = createEngine({
  locales: [coreEn],
  kinds: [...BUILTIN_KINDS, datetime, place],
  packs: [en],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

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
  const sig = buildRegistry([datetime, place], [], "en").ops.get(BRIDGE_KEY);
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
  const registry = buildRegistry([...BUILTIN_KINDS, datetime], [], "en");
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
  // "japan" survives only as datetime's own ZONES alias; "ukraine" is nothing.
  expect(withoutGeo.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
  expect(() => withoutGeo.evaluate("3pm in ukraine")).toThrow(NoCandidateError);
});

test("datetime declares the bridge without depending on geo", async () => {
  // The dependency direction is the design (spec §3.1), so it is asserted here
  // as well as in check-deps: a stray `import type` would satisfy every test
  // above and quietly reverse it.
  const source = await Bun.file(new URL("./datetime.ts", import.meta.url)).text();
  expect(source).not.toContain("@smartput/geo");
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
  expect(pkg.dependencies["@smartput/geo"]).toBeUndefined();
  expect(pkg.devDependencies["@smartput/geo"]).toBe("workspace:*");
});
