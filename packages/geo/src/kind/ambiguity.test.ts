import { expect, test } from "bun:test";
import {
  buildRegistry,
  composeLocale,
  createEngine,
  type Engine,
  type Kind,
  type Language,
  type LiteralMatch,
  type LiteralMatcher,
  type Locale,
  type MatchCtx,
  NoCandidateError,
  UnitParseError,
  type Vocabulary,
} from "@smartput/core";
import { arabic as coreAr } from "@smartput/core/locale/ar";
import { german as coreDe } from "@smartput/core/locale/de";
import { english as coreEn } from "@smartput/core/locale/en";
import { spanish as coreEs } from "@smartput/core/locale/es";
import { french as coreFr } from "@smartput/core/locale/fr";
import { hindi as coreHi } from "@smartput/core/locale/hi";
import { indonesian as coreId } from "@smartput/core/locale/id";
import { italian as coreIt } from "@smartput/core/locale/it";
import { japanese as coreJa } from "@smartput/core/locale/ja";
import { korean as coreKo } from "@smartput/core/locale/ko";
import { dutch as coreNl } from "@smartput/core/locale/nl";
import { polish as corePl } from "@smartput/core/locale/pl";
import { portuguese as corePt } from "@smartput/core/locale/pt";
import { russian as coreRu } from "@smartput/core/locale/ru";
import { turkish as coreTr } from "@smartput/core/locale/tr";
import { ukrainian as coreUk } from "@smartput/core/locale/uk";
import { chinese as coreZh } from "@smartput/core/locale/zh";
import { date } from "@smartput/date";
import { dateRange } from "@smartput/date-range";
import { datetime } from "@smartput/datetime";
import datetimeAr from "@smartput/datetime/locale/ar";
import datetimeDe from "@smartput/datetime/locale/de";
import datetimeEn from "@smartput/datetime/locale/en";
import datetimeEs from "@smartput/datetime/locale/es";
import datetimeFr from "@smartput/datetime/locale/fr";
import datetimeHi from "@smartput/datetime/locale/hi";
import datetimeId from "@smartput/datetime/locale/id";
import datetimeIt from "@smartput/datetime/locale/it";
import datetimeJa from "@smartput/datetime/locale/ja";
import datetimeKo from "@smartput/datetime/locale/ko";
import datetimeNl from "@smartput/datetime/locale/nl";
import datetimePl from "@smartput/datetime/locale/pl";
import datetimePt from "@smartput/datetime/locale/pt";
import datetimeRu from "@smartput/datetime/locale/ru";
import datetimeTr from "@smartput/datetime/locale/tr";
import datetimeUk from "@smartput/datetime/locale/uk";
import datetimeZh from "@smartput/datetime/locale/zh";
import { datetimeRange } from "@smartput/datetime-range";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_AR from "@smartput/kinds/locale/ar";
import BUILTIN_DE from "@smartput/kinds/locale/de";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_ES from "@smartput/kinds/locale/es";
import BUILTIN_FR from "@smartput/kinds/locale/fr";
import BUILTIN_HI from "@smartput/kinds/locale/hi";
import BUILTIN_ID from "@smartput/kinds/locale/id";
import BUILTIN_IT from "@smartput/kinds/locale/it";
import BUILTIN_JA from "@smartput/kinds/locale/ja";
import BUILTIN_KO from "@smartput/kinds/locale/ko";
import BUILTIN_NL from "@smartput/kinds/locale/nl";
import BUILTIN_PL from "@smartput/kinds/locale/pl";
import BUILTIN_PT from "@smartput/kinds/locale/pt";
import BUILTIN_RU from "@smartput/kinds/locale/ru";
import BUILTIN_TR from "@smartput/kinds/locale/tr";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import BUILTIN_ZH from "@smartput/kinds/locale/zh";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import { measure } from "@smartput/measure";
import measureAr from "@smartput/measure/locale/ar";
import measureDe from "@smartput/measure/locale/de";
import measureEn from "@smartput/measure/locale/en";
import measureEs from "@smartput/measure/locale/es";
import measureFr from "@smartput/measure/locale/fr";
import measureHi from "@smartput/measure/locale/hi";
import measureId from "@smartput/measure/locale/id";
import measureIt from "@smartput/measure/locale/it";
import measureJa from "@smartput/measure/locale/ja";
import measureKo from "@smartput/measure/locale/ko";
import measureNl from "@smartput/measure/locale/nl";
import measurePl from "@smartput/measure/locale/pl";
import measurePt from "@smartput/measure/locale/pt";
import measureRu from "@smartput/measure/locale/ru";
import measureTr from "@smartput/measure/locale/tr";
import measureUk from "@smartput/measure/locale/uk";
import measureZh from "@smartput/measure/locale/zh";
import { number } from "@smartput/number";
import numberAr from "@smartput/number/locale/ar";
import numberDe from "@smartput/number/locale/de";
import numberEn from "@smartput/number/locale/en";
import numberEs from "@smartput/number/locale/es";
import numberFr from "@smartput/number/locale/fr";
import numberHi from "@smartput/number/locale/hi";
import numberId from "@smartput/number/locale/id";
import numberIt from "@smartput/number/locale/it";
import numberJa from "@smartput/number/locale/ja";
import numberKo from "@smartput/number/locale/ko";
import numberNl from "@smartput/number/locale/nl";
import numberPl from "@smartput/number/locale/pl";
import numberPt from "@smartput/number/locale/pt";
import numberRu from "@smartput/number/locale/ru";
import numberTr from "@smartput/number/locale/tr";
import numberUk from "@smartput/number/locale/uk";
import numberZh from "@smartput/number/locale/zh";
import { RANGE_KINDS } from "@smartput/range";
import { money, snapshot } from "@smartput/rate";
import moneyAr from "@smartput/rate/locale/ar";
import moneyDe from "@smartput/rate/locale/de";
import moneyEn from "@smartput/rate/locale/en";
import moneyEs from "@smartput/rate/locale/es";
import moneyFr from "@smartput/rate/locale/fr";
import moneyHi from "@smartput/rate/locale/hi";
import moneyId from "@smartput/rate/locale/id";
import moneyIt from "@smartput/rate/locale/it";
import moneyJa from "@smartput/rate/locale/ja";
import moneyKo from "@smartput/rate/locale/ko";
import moneyNl from "@smartput/rate/locale/nl";
import moneyPl from "@smartput/rate/locale/pl";
import moneyPt from "@smartput/rate/locale/pt";
import moneyRu from "@smartput/rate/locale/ru";
import moneyTr from "@smartput/rate/locale/tr";
import moneyUk from "@smartput/rate/locale/uk";
import moneyZh from "@smartput/rate/locale/zh";
import { time } from "@smartput/time";
import { timeRange } from "@smartput/time-range";
import { Glob } from "bun";
import { placeVocabulary } from "../locale/vocabulary";
import { definePlace } from "./place";
import { ADMIN1, CITIES, COUNTRIES } from "./places.fixture";
import type { CityRow } from "./types";

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
const geo = definePlace({ countries: COUNTRIES, cities: CITIES, admin1: ADMIN1 });

/**
 * The country names as an English vocabulary, for the engines below that read
 * English and nothing else — and for `speaking` when the language it is handed
 * is English.
 *
 * A `place` no language has spoken for is indexed by the registry's R2 pass
 * under its own unit keys, which are the alpha-2 codes — so without this,
 * "10 km" would be ambiguous with Comoros. Hoisted to a constant rather than
 * called at each engine because a `Vocabulary` is frozen data: one table, read
 * many times.
 */
const PLACES = placeVocabulary(COUNTRIES);

/**
 * Geo and the two kinds its own op needs. Deliberately not the engine `full`
 * builds: the two disagree about "tokyo", and which of them is right depends
 * entirely on what else is loaded — see "tokyo" below.
 */
const places = createEngine({
  // `lengthEn` because this engine replays `packages/geo/corpus/kind/en.tsv`,
  // whose distance rows record spelled answers ("878.399 kilometres"), and
  // length's words are a vocabulary now rather than a field on the kind.
  locales: [composeLocale(coreEn, [lengthEn, PLACES])],
  kinds: [number, length, geo],
});

/** datetime's test clock, copied rather than imported — `temporal.ts` is not a
 * published entry point of that package and adding one for a neighbour's test
 * would widen its API for a constant. Kept honest by the corpus replay, which
 * fails on any drift. */
const TEST_NOW = 1_768_478_400_000;
const TEST_ZONE = "UTC";

// ---- the seventeen languages ----

/**
 * The rate snapshot every money engine here is built against, so the rows are
 * arithmetic rather than a live quote.
 *
 * Every currency `@smartput/currency` knows a rate for, and not the two the
 * English and Ukrainian tables need, for the reason `@smartput/rate`'s own
 * corpus test gives: a language's word for the franc or the zloty cannot be
 * read back if the franc has no rate, because `MissingRateError` arrives before
 * the vocabulary is ever consulted. The figures are that file's, copied so the
 * two nets replay the same rows against the same arithmetic.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 170,
  CHF: 0.94,
  PLN: 4.28,
  UAH: 45.5,
  CAD: 1.5,
  AUD: 1.68,
  SEK: 11.2,
  NOK: 11.7,
  CZK: 24.8,
});

/**
 * One language's ingredients, in the order the engines below take them.
 *
 * A tuple rather than seventeen object literals, and a tuple rather than a bare
 * list of ids: which language file meets which vocabularies is the seam a
 * broken vocabulary breaks at, and every corpus test in the repo keeps it on
 * the page for that reason. Deriving the engines from the id — a map from
 * `"de"` to five dynamic imports — would read shorter and hide it.
 *
 * The built-in half is already an array: `BUILTIN_DE` is every built-in kind's
 * German words. The other four are the vocabularies of the packages whose
 * corpora need an engine `@smartput/kinds` does not build — `datetime`,
 * `measure`, `number` and `money`.
 */
type LanguageRow = readonly [
  id: string,
  language: Language,
  builtins: readonly Vocabulary[],
  datetime: Vocabulary,
  number: Vocabulary,
  measure: Vocabulary,
  money: Vocabulary,
];

/**
 * Every language this repository publishes a vocabulary in, which since the
 * fifteen-language milestone is every language every kind package publishes.
 *
 * The list is the registry the net below is generated from: a language added to
 * `@smartput/kinds` and left out here would leave its corpora unreplayed, and
 * the discovery check turns that into a failure rather than a silence.
 */
const LANGUAGES: readonly LanguageRow[] = [
  ["ar", coreAr, BUILTIN_AR, datetimeAr, numberAr, measureAr, moneyAr],
  ["de", coreDe, BUILTIN_DE, datetimeDe, numberDe, measureDe, moneyDe],
  ["en", coreEn, BUILTIN_EN, datetimeEn, numberEn, measureEn, moneyEn],
  ["es", coreEs, BUILTIN_ES, datetimeEs, numberEs, measureEs, moneyEs],
  ["fr", coreFr, BUILTIN_FR, datetimeFr, numberFr, measureFr, moneyFr],
  ["hi", coreHi, BUILTIN_HI, datetimeHi, numberHi, measureHi, moneyHi],
  ["id", coreId, BUILTIN_ID, datetimeId, numberId, measureId, moneyId],
  ["it", coreIt, BUILTIN_IT, datetimeIt, numberIt, measureIt, moneyIt],
  ["ja", coreJa, BUILTIN_JA, datetimeJa, numberJa, measureJa, moneyJa],
  ["ko", coreKo, BUILTIN_KO, datetimeKo, numberKo, measureKo, moneyKo],
  ["nl", coreNl, BUILTIN_NL, datetimeNl, numberNl, measureNl, moneyNl],
  ["pl", corePl, BUILTIN_PL, datetimePl, numberPl, measurePl, moneyPl],
  ["pt", corePt, BUILTIN_PT, datetimePt, numberPt, measurePt, moneyPt],
  ["ru", coreRu, BUILTIN_RU, datetimeRu, numberRu, measureRu, moneyRu],
  ["tr", coreTr, BUILTIN_TR, datetimeTr, numberTr, measureTr, moneyTr],
  ["uk", coreUk, BUILTIN_UK, datetimeUk, numberUk, measureUk, moneyUk],
  ["zh", coreZh, BUILTIN_ZH, datetimeZh, numberZh, measureZh, moneyZh],
];

/**
 * One language's locale, with the gazetteer composed into it.
 *
 * One locale and not two, and the `locale` argument to `placeVocabulary` is why
 * that is possible. A country's words are its *names* and the names are the
 * data's, so the function produces the vocabulary its table implies in whatever
 * language that table is in — and `@smartput/geo`'s own `live()` door passes
 * `language.id` for exactly this: a caller asks the provider for `lang: "fr"`
 * and composes the answer into their French locale. This package's fixture is
 * the English table, so what these engines install is English names *declared
 * as* the language's own. That is the shape a French consumer's engine has, and
 * it is the only shape that leaves the question this file asks isolated.
 *
 * The alternative was tried and does not hold, and it is worth recording why,
 * because it is what the Ukrainian entries did while English and Ukrainian were
 * the only two languages here: composing the English vocabulary into a second
 * `composeLocale(coreEn, [PLACES])` beside the language's own installs the
 * English *language*, not just its place names, and `buildKeywords` folds every
 * installed language's connectives into one table. English "to" is a keyword
 * and French "to" is the téraoctet, so under the two-locale engine
 * `packages/datasize/corpus/fr.tsv`'s "1 to / 4" stops parsing — with the
 * gazetteer removed and the second locale kept, identically so. Six thousand
 * city names were never what broke it, and a net that reported them as the
 * cause would be worse than no net.
 *
 * What survives from that arrangement is the claim it was there to make. The
 * names go into the same alias index as the language's units, folded under the
 * language's own casing rules, in front of the same destructive fold. If six
 * thousand of them could shadow a German, a Japanese or a Cyrillic unit word,
 * this is where it shows — and the question is sharper away from English rather
 * than softer. Essen is a city of half a million and the German for eating;
 * Turkish folds a dotless i where nothing else does; and every Cyrillic corpus
 * in the repo now reads its rows with six thousand Latin proper nouns in the
 * index beside its units.
 */
function speaking(language: Language, vocabularies: readonly Vocabulary[]): Locale[] {
  const places = language === coreEn ? PLACES : placeVocabulary(COUNTRIES, language.id);
  return [composeLocale(language, [...vocabularies, places])];
}

/**
 * One shape of registration, built in all seventeen languages and keyed by id.
 *
 * Four of these below, one per engine any corpus in the repo needs, because the
 * alternative — a `Suite` literal per file — is 357 of them.
 */
function engineTable(build: (row: LanguageRow) => Engine): ReadonlyMap<string, Engine> {
  return new Map(LANGUAGES.map((row) => [row[0], build(row)]));
}

/** Narrowed through a function for the reason `matcherOf` below is: an index
 * lookup is `Engine | undefined`, and a missing language here is a wiring
 * error rather than a corpus that fails. */
function engineFor(table: ReadonlyMap<string, Engine>, id: string): Engine {
  const engine = table.get(id);
  if (engine === undefined) throw new Error(`no engine for "${id}"`);
  return engine;
}

/**
 * Every built-in kind and the gazetteer, which is the pairing the per-package
 * corpora were never read against: each of them proves its rows with two or
 * three kinds registered, and this asks whether the answer survives the other
 * sixteen plus six thousand city names — in every language that states them.
 */
const BUILTINS = engineTable(([id, language, builtins]) =>
  createEngine({
    locales: speaking(language, builtins),
    kinds: [...BUILTIN_KINDS, geo],
    format: id,
  }),
);

/**
 * The same plus `datetime`, whose corpora are the only ones here that pin a
 * clock: a kind whose values are instants is a corpus over `now`, so both it
 * and the zone have to be fixed or "9:30" would mean a different thing
 * tomorrow.
 */
const DATETIMES = engineTable(([id, language, builtins, datetimeWords]) =>
  createEngine({
    locales: speaking(language, [...builtins, datetimeWords]),
    kinds: [...BUILTIN_KINDS, datetime, geo],
    format: id,
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  }),
);

/**
 * `measure` gets its own table because it is not in `BUILTIN_KINDS` at all —
 * its mm/cm aliases collide with `length`, so the roster leaves it out and a
 * consumer who wants it registers it without them. Geo is still in front.
 */
const MEASURES = engineTable(([id, language, , , numberWords, measureWords]) =>
  createEngine({
    locales: speaking(language, [numberWords, measureWords]),
    kinds: [number, measure, geo],
    format: id,
  }),
);

/**
 * Money and the rates it converts through, which is the one table here whose
 * output half is not a translation: `money`'s format hook renders through
 * `@smartput/currency`, so every language prints a sign and an amount and only
 * the *input* half — "5 доларів", "خمسة دولارات", "5 달러를" — is the language.
 */
const RATES = engineTable(([id, language, , , , , moneyWords]) =>
  createEngine({
    locales: speaking(language, [moneyWords]),
    kinds: [number, money, geo],
    format: id,
    rates,
  }),
);

/** Everything a real consumer registers at once, which is where a name that
 * belongs to two kinds actually has to be decided. The English row of the
 * datetime table rather than a fourth hand-built engine, so the ambiguity rows
 * below and `packages/datetime/corpus/en.tsv` cannot drift apart. */
const full = engineFor(DATETIMES, "en");

/** The same, with geo left out — the control for every "registering geo costs
 * nothing" claim below. No `PLACES` either: a vocabulary for a kind the
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
  [composeLocale(coreEn, [lengthEn, PLACES])],
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
  /** The two `-complete.tsv` tables record completions rather than evaluations,
   * so they are replayed through `complete()`. */
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
  locales: [composeLocale(coreEn, [...BUILTIN_EN, PLACES, datetimeEn])],
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
  locales: [composeLocale(coreEn, [...BUILTIN_EN, PLACES])],
  kinds: [...BUILTIN_KINDS, ...RANGE_KINDS, geo],
});

/**
 * The kind packages whose corpora are replayed as a set, one entry per package
 * and seventeen files each.
 *
 * Written out rather than globbed so that a package appearing here is a
 * decision: `measure` is deliberately absent (it is not in `BUILTIN_KINDS`) and
 * gets its own engine table above, and a kind package added later shows up as a
 * discovery-check failure instead of being swept in with an engine nobody chose
 * for it.
 */
const BUILTIN_CORPORA = [
  "angle",
  "area",
  "boolean",
  "datarate",
  "datasize",
  "duration",
  "energy",
  "kinds",
  "length",
  "mass",
  "number",
  "percent",
  "power",
  "speed",
  "temperature",
  "tempo",
  "volume",
] as const;

/**
 * Every corpus a language carries, generated from the language table rather
 * than listed.
 *
 * Twenty-one files per language: the engine's own corpus, the seventeen
 * built-in kinds', and one each for the three packages that need an engine
 * `@smartput/kinds` does not build. Listing 357 suites by hand would be a
 * transcription exercise whose only failure mode is a typo, and the discovery
 * check below already turns a file this generator misses into a red test.
 *
 * That is the whole question this file asks, now asked seventeen times over:
 * `@smartput/mass` proves "3 lbs" reads with `number` and `mass` registered,
 * and only here does it have to survive sixteen other kinds and six thousand
 * city names as well — and only here does "3 كيلوغرامات" have to.
 */
const LANGUAGE_SUITES: readonly Suite[] = LANGUAGES.flatMap(([id]) => [
  { file: `packages/core/corpus/${id}.tsv`, engine: engineFor(BUILTINS, id) },
  ...BUILTIN_CORPORA.map((pkg) => ({
    file: `packages/${pkg}/corpus/${id}.tsv`,
    engine: engineFor(BUILTINS, id),
  })),
  { file: `packages/datetime/corpus/${id}.tsv`, engine: engineFor(DATETIMES, id) },
  { file: `packages/measure/corpus/${id}.tsv`, engine: engineFor(MEASURES, id) },
  { file: `packages/rate/corpus/${id}.tsv`, engine: engineFor(RATES, id) },
]);

const SUITES: readonly Suite[] = [
  ...LANGUAGE_SUITES,
  // The two completion tables, listed by hand because they are the only two
  // corpora in the repo replayed through `complete()` rather than `evaluate()`
  // — a row is a fragment and the first row it offers — and because
  // `@smartput/core` writes them in English and Ukrainian alone, so there is no
  // per-language shape for the generator above to take.
  {
    file: "packages/core/corpus/en-complete.tsv",
    engine: engineFor(BUILTINS, "en"),
    completion: true,
  },
  {
    file: "packages/core/corpus/uk-complete.tsv",
    engine: engineFor(BUILTINS, "uk"),
    completion: true,
  },
  { file: "packages/geo/corpus/kind/en.tsv", engine: places },
  // The range milestone's six, English-only because their corpora are. `date`
  // and `time` carry their owning corpus test's narrowing; the three range
  // kinds win outright and take none.
  { file: "packages/date/corpus/en.tsv", engine: ranges, kinds: ["date", "duration"] },
  { file: "packages/time/corpus/en.tsv", engine: ranges, kinds: ["time", "duration"] },
  { file: "packages/date-range/corpus/en.tsv", engine: ranges },
  { file: "packages/time-range/corpus/en.tsv", engine: ranges },
  { file: "packages/datetime-range/corpus/en.tsv", engine: ranges },
  { file: "packages/range/corpus/en.tsv", engine: selections },
];

/**
 * The corpora this net cannot replay, and why each one is not a gap.
 *
 * The discovery check below compares the filesystem against `SUITES` *plus*
 * this map, so a corpus is either replayed or excluded on the record — a file
 * that is neither fails, which is the property that made this check worth
 * having. Before P6 the check compared against `SUITES` alone and had been red
 * since the per-package corpora landed, which is exactly the failure mode a
 * silent exclusion list would have reintroduced.
 *
 * Every entry here is excluded for the same underlying reason: column 0 is not
 * a sentence an engine reads. There is no ambiguity for a gazetteer to create
 * in a string no engine ever sees.
 */
const UNREPLAYED: Readonly<Record<string, string>> = {
  "packages/shared/corpus/en.tsv":
    "the micro path — a UnitTable, a parser and a formatter, with no engine underneath and no registry for a place name to enter",
  "packages/shared/corpus/uk.tsv":
    "the same, against the Ukrainian table that file declares",
  "packages/currency/corpus/en.tsv":
    "`parseAmount` and `formatAmount`, the engine-free door; a row's columns are a parse outcome and a rendering, not a kind and a canonical",
  "packages/currency/corpus/uk.tsv":
    "the same, rendered through a Ukrainian `formatNumber`",
  "packages/timezone/corpus/en.tsv":
    "a zone alias and its symbol, read by a table lookup and `parseOffsetZone`; the package ships no kind at all",
  "packages/range-core/corpus/en.tsv":
    "instants, zones and boundaries — the interval algebra below every range kind, one layer under anything with a vocabulary",
  "packages/distance/corpus/en.tsv":
    "two alpha-2 codes and a distance in metres; the op is handed finished Values, and the sentence half is `packages/geo/corpus/kind/en.tsv` above",
  "packages/geo/corpus/en.tsv":
    "a search query and the hit that must rank first, replayed through a `Geo` over a pinned gazetteer; the package registers no kind, so there is no engine here for a city name to be claimed by and nothing for this net to re-read",
  "packages/geo/corpus/uk.tsv":
    "the same, in Cyrillic — and the reason it is a second file rather than a translation is that a place's words are the provider's, not this repository's",
  "packages/geo/corpus/gazetteer/en.tsv":
    "not a corpus of inputs at all: it is the pinned table the two files above are searched against, rows of gazetteer data rather than sentences, and there is nothing in it for an engine to read",
  "packages/geo/corpus/gazetteer/uk.tsv":
    "the same table in Cyrillic, and excluded for the same reason",
};

/** The repository root: this file is `packages/geo/src/kind/`, so four up. */
const ROOT = new URL("../../../../", import.meta.url);

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
  const found = [...new Glob("packages/*/corpus/**/*.tsv").scanSync(ROOT.pathname)]
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
  expect(found).toEqual(
    [...SUITES.map((s) => s.file), ...Object.keys(UNREPLAYED)].sort(),
  );
});

/**
 * The exclusion list cannot be padded with names, which is what would turn it
 * from a record into a way out. Every key has to be a corpus that exists.
 */
test("every excluded corpus is a real file", () => {
  const found = new Set(
    [...new Glob("packages/*/corpus/**/*.tsv").scanSync(ROOT.pathname)].map((p) =>
      p.replaceAll("\\", "/"),
    ),
  );
  expect(Object.keys(UNREPLAYED).filter((f) => !found.has(f))).toEqual([]);
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

  // A subset rather than an equality, because the list is a census of the
  // shipped gazetteer and this suite runs on a fixture: 6,247 cities put a place
  // first at fourteen of these prefixes, and forty-odd put one first at a
  // handful. What has to hold either way is that every prefix where a place
  // leads is one the census already knew about — a *new* entry means geo has
  // started taking a row it did not take before, which is the regression.
  expect(PLACE_LED).toEqual(expect.arrayContaining(led));
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
