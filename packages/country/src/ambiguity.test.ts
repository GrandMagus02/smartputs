import { expect, test } from "bun:test";
import { ADMIN1, CITIES } from "@smartput/city";
import type { CityRow } from "@smartput/city/types";
import {
  buildRegistry,
  composeLocale,
  createEngine,
  type Engine,
  type Kind,
  type LiteralMatch,
  type LiteralMatcher,
  type MatchCtx,
  NoCandidateError,
  UnitParseError,
} from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { dateRange } from "@smartput/date-range";
import { datetime } from "@smartput/datetime";
import datetimeEn from "@smartput/datetime/locale/en";
import { datetimeRange } from "@smartput/datetime-range";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import { number } from "@smartput/number";
import { RANGE_KINDS } from "@smartput/range";
import { money, snapshot } from "@smartput/rate";
import { time } from "@smartput/time";
import { timeRange } from "@smartput/time-range";
import { Glob } from "bun";
import placeEn from "./locale/en";
import { definePlace } from "./place";

/**
 * Spec §9's ambiguity table, which M6.1 recorded as unwritable: every row of it
 * needs either the T1 gazetteer or the postal literal, and M6.1 shipped neither.
 *
 * Cities make the table reachable, and three of its rows turn out not to hold.
 * Each of those is asserted here as it actually behaves, with the reason beside
 * it, rather than dropped or softened into something that passes: `suggest()`
 * cannot return a second place at all, "paris texas" wants a city below the
 * tier's floor, and "tokyo" is a place only in an engine without datetime. The
 * postal row is M6.3's and is asserted in its pre-M6.3 form so that milestone
 * cannot move it in silence.
 *
 * The file is also the regression net for the whole tier. Six thousand names
 * entered a trie that sits in front of a *destructive* fold, so the only honest
 * proof that no other kind lost a reading is to replay every corpus in the repo
 * with this kind registered — see "the corpora" below, which is the half of this
 * file that matters more than any single ambiguity row.
 */
const geo = definePlace({ cities: CITIES, admin1: ADMIN1 });

/**
 * Geo and the two kinds its own op needs. Deliberately not the engine `full`
 * builds: the two disagree about "tokyo", and which of them is right depends
 * entirely on what else is loaded — see "tokyo" below.
 */
const places = createEngine({
  // `lengthEn` because this engine replays `packages/country/corpus/en.tsv`,
  // whose distance rows record spelled answers ("878.399 kilometres"), and
  // length's words are a vocabulary now rather than a field on the kind.
  // `placeEn` because a country's names are one too — and because a `place` no
  // language has spoken for is indexed under its own unit keys, which are the
  // alpha-2 codes, and "10 km" would be ambiguous with Comoros.
  locales: [composeLocale(coreEn, [lengthEn, placeEn])],
  kinds: [number, length, geo],
});

/** datetime's test clock, copied rather than imported — `temporal.ts` is not a
 * published entry point of that package and adding one for a neighbour's test
 * would widen its API for a constant. Kept honest by the corpus replay, which
 * fails on any drift. */
const TEST_NOW = 1_768_478_400_000;
const TEST_ZONE = "UTC";

/** Everything a real consumer registers at once, which is where a name that
 * belongs to two kinds actually has to be decided. */
const full = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, placeEn, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime, geo],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The same, with geo left out — the control for every "registering geo costs
 * nothing" claim below. No `placeEn` either: a vocabulary for a kind the
 * registry never registered is a wiring error, and the control has no place
 * kind to speak for. */
const without = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const registry = buildRegistry(
  [number, length, geo],
  [composeLocale(coreEn, [lengthEn, placeEn])],
);
const matchCtx: MatchCtx = {
  locale: "en",
  now: 0,
  timeZone: "UTC",
  isUnitAlias: (text) => registry.aliasIndex.has(text.toLowerCase()),
};

/** Narrowed through a function because a module-level `const` does not stay
 * narrowed inside the closure below. */
function matcherOf(kind: Kind): LiteralMatcher {
  const m = kind.literals?.[0];
  if (m === undefined) throw new Error("the kind registers no matcher");
  return m;
}

const literal = matcherOf(geo);

/** Every reading the trie claims for `input`, ranked, read straight rather than
 * through an engine: a weight is what §6.1 is written in, and the engine reports
 * a confidence instead. */
function claims(input: string): readonly LiteralMatch[] {
  const result = literal(input, 0, matchCtx);
  if (result === null) return [];
  return Array.isArray(result) ? result : [result as LiteralMatch];
}

/** The winning reading, which is what a §6.1 ranking decides. */
function claim(input: string): LiteralMatch {
  const match = claims(input)[0];
  if (match === undefined) throw new Error(`nothing claimed "${input}"`);
  return match;
}

const rows = (alias: string) => CITIES.filter((c) => c.aliases.includes(alias));
const id = (match: LiteralMatch) => Number(match.canonical.toString());

// ---- §9: "paris" ranks France, and the ranking is §6.1's ----

test("paris is the French one", () => {
  const r = places.evaluate("paris");
  expect(r.kind).toBe("place");
  // The city's id, not France's 3017382: "paris" reaches the capital through the
  // trie, and the country only lends it the unit it renders under.
  expect(r.value.canonical.toString()).toBe("2988507");
  expect(r.value.unit).toBe("fr");
});

test("a capital outranks a city many times its size", () => {
  // §6.1's two-and-a-half lines of weight table, on the three aliases where the
  // shipped table makes each of them decide something.
  //
  // Athens is the "paris texas" shape the spec names, with a Paris the tier does
  // carry: the Greek capital at a flat +2 against Athens, Georgia at +1.70, both
  // present, one chosen.
  expect(claim("athens").weight).toBe(2);
  expect(id(claim("athens"))).toBe(264371);
  expect(
    rows("athens")
      .map((c) => c.country)
      .sort(),
  ).toEqual(["gr", "us"]);

  // San José is the case that proves the capital rule is not population in
  // disguise: 335 007 people against San Jose, California's 997 368, and the
  // capital still wins — by 0.0004, which is exactly how close §6.1 puts them.
  expect(claim("san jose").weight).toBe(2);
  expect(id(claim("san jose"))).toBe(3621849);
  const sanJoseCa = rows("san jose").find((c) => c.country === "us") as CityRow;
  expect(sanJoseCa.population).toBeGreaterThan(900_000);
  expect(Math.log10(sanJoseCa.population) / 3).toBeLessThan(2);
});

test("between cities that are nobody's capital, population is the whole ranking", () => {
  // Three Springfields, none of them a seat of government, so §6.1's log10 scale
  // is the only thing separating them and the biggest wins. The spec's own row
  // predicts Illinois; the table says Missouri is 170 188 to Illinois' 114 394,
  // and the weight is a function of the data, not of the example.
  const springfields = rows("springfield");
  expect(springfields.map((c) => c.admin1).sort()).toEqual(["IL", "MA", "MO"]);
  expect(id(claim("springfield"))).toBe(4409896);
  expect(claim("springfield").weight).toBeCloseTo(Math.log10(170188) / 3, 12);
});

test("suggest() reports the winner and the runners-up behind it", () => {
  // §12.3's first defect, closed. `LiteralMatcher` returned `LiteralMatch | null`
  // through M6.2, so the fold received one claim per offset and the alternatives
  // never became candidates the solver could rank; M6.3 widened it to an array
  // and the fold now groups every reading that reaches the same end.
  expect(rows("springfield")).toHaveLength(3);
  const suggested = places.suggest("springfield");
  expect(suggested).toHaveLength(3);
  expect(suggested.map((r) => r.value.canonical.toString())).toEqual([
    "4409896",
    "4951788",
    "4250542",
  ]);

  // And ranked, not merely listed: `evaluate` still decides, which is what §6.1
  // means by "a ranking, not a decision". The weights §6.1 tables put the top two
  // 0.0127 apart, close enough to be a coin flip once softmaxed, so the matcher
  // spaces its readings — see RANK_STEP.
  expect(places.evaluate("springfield").value.canonical.toString()).toBe("4409896");
  expect(suggested[0]?.confidence ?? 0).toBeGreaterThan(
    (suggested[1]?.confidence ?? 0) + 0.05,
  );
});

// ---- §9: "paris texas" resolves to the Texan one ----

test("a scope reaches the city the ranking passed over", () => {
  // §5.2's walk, which is what "paris texas" is asking for. Each of these picks
  // a row the unscoped claim ranked below the winner, and each is +4 — the user
  // named a division, so the weight stops being a guess.
  for (const [input, geonameId] of [
    ["springfield illinois", 4250542],
    ["springfield massachusetts", 4951788],
    ["san jose california", 5392171],
    ["cambridge massachusetts", 4931972],
  ] as const) {
    const match = claim(input);
    expect(`${input} -> ${id(match)} @${match.weight}`).toBe(
      `${input} -> ${geonameId} @4`,
    );
    expect(match.length).toBe(input.length);
  }
  // A country scopes by the same walk. Naming the winner's own country changes
  // nothing about the answer, which is the point: a scope narrows, it does not
  // re-rank, so an explicit "athens greece" and a bare "athens" agree.
  expect(id(claim("athens greece"))).toBe(264371);
  // And the unscoped Cambridge is the English one, which is what makes the
  // Massachusetts row above a scope doing work rather than restating a default.
  expect(id(claim("cambridge"))).toBe(2653941);
});

test("paris texas needs a Paris this tier does not carry", () => {
  // The spec row itself, and it fails on data rather than on matching. T1 is
  // "over 100 000 people, plus every seat of government"; Paris, Texas is 25 171
  // and neither. So the trie has one Paris, the scope finds no US row to select,
  // and the claim falls back to the unscoped French city — leaving "texas"
  // dangling as a word nothing parses.
  expect(rows("paris").map((c) => c.country)).toEqual(["fr"]);
  expect(claim("paris texas").length).toBe("paris".length);
  expect(() => places.evaluate("paris texas")).toThrow();
  // Nothing is wrong with Texas: a city the tier does carry scopes by it.
  expect(id(claim("houston texas"))).toBe(4699066);
});

test("a division whose name is also a country still scopes", () => {
  // §9's headline row. It failed while `scopeFrom` refused a division whose
  // first word is a registered unit alias — and every country name is one, so
  // Georgia the state was unreachable and "athens georgia" degraded to the Greek
  // Athens with "georgia" left over.
  //
  // That guard is right for the country branch and redundant here: a scope is by
  // construction the second word of a multi-word claim, and the division only
  // wins when one of the candidate cities really is in it, which is a stronger
  // check than the guard was.
  expect(rows("athens").some((c) => c.admin1 === "GA")).toBe(true);
  expect(id(claim("athens georgia"))).toBe(4180386);
  expect(claim("athens georgia").length).toBe("athens georgia".length);
  // Unscoped, and scoped by the country instead, both still reach Greece.
  expect(id(claim("athens"))).toBe(264371);
  expect(id(claim("athens greece"))).toBe(264371);
  // Ohio's name is nobody's country, so the same input shape works.
  expect(id(claim("columbus ohio"))).toBe(4509177);
  // And the country reading of "georgia" alone is untouched by any of it.
  expect(places.evaluate("georgia").value.unit).toBe("ge");
});

test("a keyword is never eaten as a scope", () => {
  // The one thing the removed guard was load-bearing for is covered by the
  // KEYWORDS check beside it: "in" has to survive as the conversion keyword, or
  // "paris in ukraine" claims "paris in" as a city in Indiana.
  const r = places.evaluate("paris in ukraine");
  expect(r.kind).toBe("length");
});

// ---- §9: "georgia" ranks the country above the state ----

test("georgia is the country, and the state is not a place at all", () => {
  const r = places.evaluate("georgia");
  expect(r.value.canonical.toString()).toBe("614540");
  expect(r.value.unit).toBe("ge");
  expect(claim("georgia").weight).toBe(3);
  // Not a ranking that happens to come out right: a division is deliberately not
  // a place (see `Admin1Row`), so US.GA has no id, no position and nothing for
  // the country's +3 to be compared against.
  expect(ADMIN1.some((a) => a.key === "US.GA" && a.aliases.includes("georgia"))).toBe(
    true,
  );
  expect(rows("georgia")).toEqual([]);
});

// ---- §9: "tokyo" is a zone in one sentence and a place in the other ----

test("tokyo is a zone in one sentence and a place in the other", () => {
  // §9's row, and §12.3's second defect closed with it. Through M6.2 only one
  // reading ever survived: `cityClaimable` refused any single word `isUnitAlias`
  // reported, so with datetime loaded geo never claimed "tokyo" — which kept
  // "3pm in tokyo" working and cost "tokyo to kyoto" its distance, seventeen
  // names in all.
  //
  // The fold is what changed, not the weights. A claim over a single token now
  // keeps that token beside it, so geo's city and datetime's zone are both
  // candidates and the signature decides: `in | datetime | place` has no
  // competitor and neither does `in | place | place`, which is exactly what §6.3
  // said would happen once both readings could reach the solver.
  expect(full.evaluate("3pm in tokyo").formatted).toBe("2026-01-16 00:00 JST");
  expect(full.evaluate("3pm in tokyo").formatted).toBe(
    without.evaluate("3pm in tokyo").formatted,
  );

  // Byte-identical in both engines, where M6.2 had this one throwing under
  // datetime and answering without it.
  for (const engine of [full, places]) {
    const r = engine.evaluate("tokyo to kyoto");
    expect(r.kind).toBe("length");
    expect(r.value.canonical.toString()).toBe("364743");
  }

  // The other sixteen names datetime used to take, spot-checked across the shape
  // of the two signatures that share them.
  expect(full.evaluate("paris to berlin").kind).toBe("length");
  expect(full.evaluate("kyiv to warsaw").kind).toBe("length");
  expect(full.evaluate("chicago to denver").kind).toBe("length");
  expect(full.evaluate("3pm in london").formatted).toBe(
    without.evaluate("3pm in london").formatted,
  );

  // A city datetime has never heard of was always a place in either engine, and
  // still is — the fix took nothing away from the words that never collided.
  expect(full.evaluate("kyoto to osaka").kind).toBe("length");
});

// ---- §9: "90210" stays a number ----

test("90210 is a number, in every engine this package can be part of", () => {
  // §6.2's headline, now with the matcher that could have broken it registered.
  for (const engine of [places, full]) {
    const r = engine.evaluate("90210");
    expect(r.kind).toBe("number");
    expect(r.value.canonical.toString()).toBe("90210");
    expect(r.formatted).toBe("90,210");
  }
  // With the place reading beneath it, which is the rest of §6.2's promise and
  // what M6.3 added. The number stays on top because the postal claim weighs
  // less than core's `NUMBER_FALLBACK_WEIGHT`, not because the fold hid it.
  expect(places.suggest("90210").map((r) => r.kind)).toEqual(["number", "place"]);
});

// ---- the regression net ----

/**
 * Every corpus in the repo, replayed through the engine its owning package
 * builds *plus* this kind. Cheaper than a second corpus per package and stricter
 * than a sample: a trie in front of a destructive fold can only be shown
 * harmless input by input.
 */
interface Suite {
  /** Repo-relative, so the discovery check below can compare paths directly. */
  readonly file: string;
  readonly engine: Engine;
  /** en-complete.tsv records completions, so it is replayed through complete(). */
  readonly completion?: true;
  /**
   * The `kinds` narrowing the owning package's own corpus test passes.
   *
   * Only `date` and `time` need one, and they need it for a reason that is the
   * whole point of their design: both readings are weighted -5 so that an
   * unnarrowed "today" keeps answering as a `datetime`, so their corpora record
   * a reading nobody gets by accident. Replaying those rows unnarrowed here
   * would assert the opposite of what the owning package asserts. The narrowing
   * costs this file nothing it cares about — a place claim that ate "friday"
   * would still show up, because `place` is not in the list and the row would
   * fail to read at all.
   */
  readonly kinds?: readonly string[];
}

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

/**
 * The six range-milestone kinds, registered together the way a consumer would.
 *
 * One engine for all five of their corpora rather than one per package: each
 * package's own corpus test builds the narrowest engine that can read its rows,
 * and this file's question is the opposite one — what happens when everything is
 * loaded at once and six thousand city names are in front of the fold. "to" is
 * Tonga and "and" is Andorra, so `from today to friday` is the single most
 * exposed input the milestone shipped.
 */
const ranges = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, placeEn, datetimeEn])],
  kinds: [
    ...BUILTIN_KINDS,
    datetime,
    date,
    time,
    dateRange,
    timeRange,
    datetimeRange,
    geo,
  ],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/**
 * The selection kinds in front of the gazetteer, which is the pairing they are
 * most exposed by: "to" is Tonga and "first" begins no city name, so every row
 * in `@smartput/range`'s corpus runs past six thousand names on its way to a
 * two-position answer.
 *
 * A separate engine from `ranges` above rather than another kind in it, because
 * `index` claims every bare integer and `date-range`'s corpus is full of them —
 * loading both would test a combination no consumer builds and tell us nothing
 * about either.
 */
const selections = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, placeEn])],
  kinds: [...BUILTIN_KINDS, ...RANGE_KINDS, geo],
});

const SUITES: readonly Suite[] = [
  {
    file: "packages/core/corpus/en.tsv",
    engine: createEngine({
      locales: [composeLocale(coreEn, [...BUILTIN_EN, placeEn])],
      kinds: [...BUILTIN_KINDS, geo],
    }),
  },
  {
    file: "packages/core/corpus/en-complete.tsv",
    engine: createEngine({
      locales: [composeLocale(coreEn, [...BUILTIN_EN, placeEn])],
      kinds: [...BUILTIN_KINDS, geo],
    }),
    completion: true,
  },
  { file: "packages/datetime/corpus/en.tsv", engine: full },
  {
    file: "packages/rate/corpus/en.tsv",
    engine: createEngine({
      locales: [composeLocale(coreEn, [placeEn])],
      kinds: [number, money, geo],
      rates,
    }),
  },
  { file: "packages/country/corpus/en.tsv", engine: places },
  // The range milestone's five. `date` and `time` carry their owning corpus
  // test's narrowing; the three range kinds win outright and take none.
  { file: "packages/date/corpus/en.tsv", engine: ranges, kinds: ["date", "duration"] },
  { file: "packages/time/corpus/en.tsv", engine: ranges, kinds: ["time", "duration"] },
  { file: "packages/date-range/corpus/en.tsv", engine: ranges },
  { file: "packages/time-range/corpus/en.tsv", engine: ranges },
  { file: "packages/datetime-range/corpus/en.tsv", engine: ranges },
  { file: "packages/range/corpus/en.tsv", engine: selections },
];

const ROOT = new URL("../../../", import.meta.url);

async function corpusRows(file: string): Promise<string[][]> {
  const raw = await Bun.file(new URL(file, ROOT)).text();
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

test("every corpus in the repo is replayed", () => {
  // Discovered from the filesystem rather than listed, for the reason
  // check-deps.ts discovers packages: a corpus added in a later milestone would
  // otherwise be absent from this net and nobody would notice until it broke.
  const found = [...new Glob("packages/*/corpus/*.tsv").scanSync(ROOT.pathname)]
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
  expect(found).toEqual(SUITES.map((s) => s.file).sort());
});

for (const { file, engine, completion, kinds } of SUITES) {
  const rows = await corpusRows(file);

  test(`${file} reads the same with 6000 city names registered`, () => {
    expect(rows.length).toBeGreaterThan(10);
    for (const [input, kind, second, text] of rows) {
      // The whole row in one string, so a failure names the input that moved
      // instead of reporting a bare "expected X received Y".
      const actual = completion
        ? (() => {
            const top = engine.complete(input as string)[0];
            return `${top?.kind}:${top?.unit} ${top?.text}`;
          })()
        : (() => {
            const r = engine.evaluate(
              input as string,
              // Spread rather than `{ kinds }`: the repo compiles with
              // `exactOptionalPropertyTypes`, so an explicit `undefined` is not
              // the same as an absent option.
              kinds === undefined ? {} : { kinds: [...kinds] },
            );
            return `${r.kind} ${r.value.canonical.toString()} ${r.formatted}`;
          })();
      const expected = completion
        ? `${kind}:${second} ${text}`
        : `${kind} ${second} ${text}`;
      expect(`${input} => ${actual}`).toBe(`${input} => ${expected}`);
    }
  });
}

/**
 * The readings most exposed to a place claim, spelled out beside the corpus
 * rather than trusted to it.
 *
 * Word math is where a destructive claim does the most damage, because the words
 * are ordinary: "and" is Andorra, "ago" is Angola, "to" is Tonga, "km" is
 * Comoros, "nice" and "mobile" and "reading" are cities of over 100 000 people.
 * A corpus row that stopped covering one of these would just disappear; a row
 * here has to be deleted on purpose.
 */
const EXPOSED: ReadonlyArray<readonly [string, string]> = [
  ["two hundred and five km", "205 kilometres"],
  ["ten km plus five km", "15 kilometres"],
  ["twenty two kg", "22 kilograms"],
  ["3 days ago", "2026-01-12 00:00 UTC"],
  ["in 3 days", "2026-01-18 00:00 UTC"],
  ["3pm", "2026-01-15 15:00 UTC"],
  ["10 km", "10 kilometres"],
  ["2 km + 300 m", "2.3 kilometres"],
  ["100 gb in mb", "100,000 megabytes"],
  ["march", "2026-03-01 00:00 UTC"],
  ["20% of 50", "10"],
  ["one hundred and twenty three", "123"],
];

test("the readings a city name could have eaten are untouched", () => {
  for (const [input, formatted] of EXPOSED) {
    // Against the geo-free engine as well as against the literal, because the
    // claim being *made* is what this file is about: a row that changed in both
    // engines at once would still be a regression, just not geo's.
    const before = (() => {
      try {
        return without.evaluate(input).formatted;
      } catch (e) {
        return `throws ${(e as Error).constructor.name}`;
      }
    })();
    const after = (() => {
      try {
        return full.evaluate(input).formatted;
      } catch (e) {
        return `throws ${(e as Error).constructor.name}`;
      }
    })();
    expect(`${input} => ${after}`).toBe(`${input} => ${before}`);
    expect(`${input} => ${after}`).toBe(`${input} => ${formatted}`);
  }
});

test("what a city name changes is only ever nothing into something", () => {
  // The general form of the claim above, and the reason "march" survives while
  // "nice" does not need to. Every ordinary English word T1 adds — Nice, Mobile,
  // Reading, Split, all four over 100 000 people — was input the engine had no
  // reading for at all, so a destructive claim destroys nothing.
  for (const word of ["nice", "mobile", "reading", "split"]) {
    expect(() => without.evaluate(word)).toThrow();
    expect(full.evaluate(word).kind).toBe("place");
  }
  // Beside a quantity the word is still unreadable, and the only thing geo
  // changes is which SmartputError says so: a claimed place where a unit was
  // expected is a parse failure rather than a missing candidate. Recorded
  // because it is the one observable difference the corpora cannot show, and
  // because a caller that switches on the error class deserves to know.
  for (const input of ["5 nice", "10 mobile"]) {
    expect(() => without.evaluate(input)).toThrow(NoCandidateError);
    expect(() => full.evaluate(input)).toThrow(UnitParseError);
  }
});

/**
 * Every prefix of every builtin unit alias — the fragments on which a unit is
 * the answer.
 *
 * This is the completion half of "registering geo costs nothing", which M6.4
 * needs and the corpora above only sample: `en-complete.tsv` is 49 rows, and the
 * kind now answers on every keystroke in the language.
 */
function unitPrefixes(): string[] {
  const registry = buildRegistry(BUILTIN_KINDS, [composeLocale(coreEn, BUILTIN_EN)]);
  const out = new Set<string>();
  for (const alias of registry.aliasIndex.keys()) {
    if (!/^[a-z ]+$/.test(alias)) continue;
    for (let n = 1; n <= alias.length; n += 1) out.add(alias.slice(0, n));
  }
  return [...out];
}

/**
 * The fragments where a place leads, listed rather than counted.
 *
 * Twelve of the thirteen are a *shorter* name winning on `prefixQuality` alone
 * — "kenia" is five letters where "kelvin" is six, "togo" four where "tonne" is
 * five — which is the alias index's own rule applied to a place, and a ranking
 * anyone can explain. The thirteenth, `li`, is a true tie at -3.00 between
 * "libia" and "liter", decided by core's last resort of kind id ascending, and
 * it is in the list rather than fixed because a per-kind thumb on that tie is
 * the very thing the rebase below removed.
 *
 * `hor` reads the same way: `@smartput/power` put "horsepower" in the alias
 * index, which made "hor" a unit prefix for the first time, and Horlivka is
 * eight letters against horsepower's ten. Nothing about the ranking changed —
 * a fragment that no unit used to claim simply appeared.
 *
 * `bo` is the newest, and it arrived by a different route worth naming.
 * `@smartput/boolean` ships no vocabulary in any language, so R2's floor
 * indexes its sentinel unit under its own id, `bool`, tagged `"*"` — making
 * "bo" a unit prefix for the first time, which Bolivia then leads. It is here
 * rather than fixed because fixing it belongs to whoever owns that kind: five
 * of the six wordless sentinels (`calendar-day`, `wall-clock`, `date-span`,
 * `datetime-span`, `range-slice`, `index-position`) stay un-typeable by having
 * a hyphen in the id, which the lexer cannot produce inside a word, and `bool`
 * is the one that does not. Renaming it would retire this entry; so would
 * giving core a real "sentinel unit, never index" notion. Neither is a change
 * to how places rank, which is what this test is about.
 *
 * A weight advantage is the ranking nobody can explain, and this list is how the
 * difference stays visible: at spec §6.1's own figures, which is what the
 * completer carried before it was registered anywhere, 56 of these 294 prefixes
 * handed their first row to a place and `me` completed Mesa rather than metre.
 * §6.1's numbers rank one place against another in the matcher; `complete()`
 * adds them to a score whose other rows — every unit in the engine — carry no
 * such term at all, so `completion.ts` rebases them onto core's own origin.
 */
const PLACE_LED: readonly string[] = [
  "bo",
  "ce",
  "fa",
  "he",
  "hec",
  "hor",
  "ke",
  "li",
  "meg",
  "pe",
  "per",
  "te",
  "ter",
  "to",
];

test("a place does not take the first completion row from a unit", () => {
  const fragments = unitPrefixes();
  expect(fragments.length).toBeGreaterThan(200);

  const led: string[] = [];
  for (const fragment of fragments) {
    const before = without.complete(fragment)[0];
    const after = full.complete(fragment)[0];
    if (before === undefined || after === undefined) continue;
    if (after.kind === "place" && before.kind !== "place") {
      led.push(fragment);
      continue;
    }
    // Whatever wins, it is the same row in both engines unless a place took it.
    // The stronger half of the claim: geo may not reorder the units either.
    expect(`${fragment} => ${after.kind}:${after.unit}`).toBe(
      `${fragment} => ${before.kind}:${before.unit}`,
    );
  }

  expect(led.sort()).toEqual([...PLACE_LED]);
});

test("and pushes at most one unit off the end of the ten", () => {
  // The row cap's justification, asserted where it can be seen rather than left
  // in the comment that states it. Core merges every kind into one list of ten,
  // so `DEFAULT_LIMIT` does not set how many places are interesting — it sets
  // how many units a place may displace. At eight, seven of these prefixes lost
  // eleven rows between them and `ki` offered eight cities, three of them Kira,
  // Kita and Kisi. The two fixes are independent, which is why both are here:
  // the rebase above decides the first row (56 taken, then 12), the cap decides
  // the body (11 rows lost, then 1).
  let dropped = 0;
  for (const fragment of unitPrefixes()) {
    const kept = new Set(
      full
        .complete(fragment)
        .filter((c) => c.kind !== "place")
        .map((c) => `${c.kind}:${c.unit}`),
    );
    dropped += without
      .complete(fragment)
      .filter((c) => !kept.has(`${c.kind}:${c.unit}`)).length;
  }
  expect(dropped).toBeLessThanOrEqual(1);
});
