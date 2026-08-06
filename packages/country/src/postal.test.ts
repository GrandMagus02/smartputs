import { expect, test } from "bun:test";
import {
  AmbiguityError,
  buildRegistry,
  createEngine,
  defineKind,
  type Kind,
  type LiteralMatch,
  type MatchCtx,
  NUMBER_FALLBACK_WEIGHT,
  type PlaceMeta,
  type UnitLexeme,
} from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime } from "@smartput/datetime";
import datetimeEn from "@smartput/datetime/locale/en";
import { PlaceDistance, UnpositionedPlaceError } from "@smartput/distance";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createPostalLiteral } from "@smartput/zip";
import { Glob } from "bun";
import { COUNTRIES } from "./data/countries";
import { RESERVED_WORDS } from "./data/reserved";
import { formatPlace } from "./format";
import { createPlaceLiteral, MIN_NAME_LENGTH } from "./matcher";
import { place } from "./place";

/**
 * Spec §6.2. The subject is the shipped `place` itself, now that M6.3 has
 * registered the postal literal into it — while `place.ts` was still another
 * agent's file this was a replica assembled here, and a replica is a second
 * definition to drift.
 *
 * Tested beside the real name matcher rather than alone, because most of what
 * this file has to prove is what registering the postal literal costs everything
 * already in the engine, and a kind with no names in it would prove that against
 * a strawman.
 */
const postalPlace = place;

const COUNTRY_UNITS: Record<string, UnitLexeme> = {};
for (const row of COUNTRIES) {
  COUNTRY_UNITS[row.a2] = {
    aliases: row.aliases.filter((a) => a.length >= MIN_NAME_LENGTH),
    symbol: row.name,
  };
}

/** datetime's test clock, copied for the reason `ambiguity.test.ts` copies it:
 * `temporal.ts` is not a published entry point of that package. */
const TEST_NOW = 1_768_478_400_000;
const TEST_ZONE = "UTC";

const engineOf = (kind: Kind) =>
  createEngine({
    locales: [coreEn],
    kinds: [...BUILTIN_KINDS, datetime, kind],
    packs: [datetimeEn],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

/** Everything a real consumer registers, with codes. */
const codes = engineOf(postalPlace);

/**
 * The same engine with the postal literal left out — the control for every
 * "registering this costs nothing" claim below. Deliberately not "no geo at
 * all": the names have to stay on both sides for the difference between the two
 * to be this one matcher.
 *
 * Assembled here rather than taken as the shipped `place`, which is what it was
 * while `place.ts` still registered names alone. M6.3 wired the postal literal
 * into the kind, so `place` is now the treatment and not the control, and using
 * it would have made every comparison below a tautology that passes.
 */
const namesPlace: Kind = defineKind({
  id: "place",
  value: { mode: "opaque", units: COUNTRY_UNITS },
  literals: [createPlaceLiteral(COUNTRIES)],
  ops: [new PlaceDistance(COUNTRIES).op],
  format: formatPlace,
});

const names = engineOf(namesPlace);

const registry = buildRegistry(
  [...BUILTIN_KINDS, datetime, postalPlace],
  [datetimeEn],
  "en",
);
const ctx: MatchCtx = {
  locale: "en",
  now: TEST_NOW,
  timeZone: TEST_ZONE,
  isUnitAlias: (text) => registry.aliasIndex.has(text.toLowerCase()),
};

const literal = createPostalLiteral(COUNTRIES);

/** What the matcher claims for `input`, read straight rather than through an
 * engine: §6.2 is written in weights and the engine reports a confidence. */
function readings(input: string, at: MatchCtx = ctx): LiteralMatch[] {
  const result = literal(input, 0, at);
  if (result === null) return [];
  return Array.isArray(result) ? [...result] : [result as LiteralMatch];
}

const units = (input: string) => readings(input).map((m) => m.unit);
/** Narrowed the way `formatPlace` narrows it: `LiteralMatch.meta` is optional
 * and untyped, and a place's is a `PlaceMeta`. */
const metaOf = (m: LiteralMatch) => m.meta as Partial<PlaceMeta>;

// ---- §6.2: a code that cannot be a number is a place wherever it appears ----

test("a code carrying a letter is claimed unqualified", () => {
  expect(units("SW1A 1AA")[0]).toBe("gb");
  expect(units("M5V 3L9")).toEqual(["ca"]);
  expect(units("100-0001")).toEqual(["jp"]);
  expect(units("1234 AB")).toEqual(["nl"]);
  expect(units("AZ 1000")).toEqual(["az"]);
});

test("a code carrying a separator is claimed unqualified", () => {
  // Spec §2's own row. Both readings of "01310-100" cannot survive: the claim
  // spans three tokens, so there is no subtraction left underneath it, and the
  // spec's table is what decides which of the two it is.
  expect(units("01310-100")).toEqual(["br"]);
  expect(units("123 45")).toEqual(["cz", "se", "sk"]);
});

test("the claim spans the code and nothing more", () => {
  expect(readings("SW1A 1AA to japan")[0]?.length).toBe("SW1A 1AA".length);
  expect(readings("us 90210")[0]?.length).toBe("us 90210".length);
});

test("a code is a conversion target, like every other place claim", () => {
  expect(readings("M5V 3L9")[0]?.targetable).toBe(true);
});

// ---- §6.1's ranking, applied to the countries that share a format ----

test("countries sharing a format arrive ranked and never tied", () => {
  // Four countries accept the British format and three accept Sweden's. Emitted
  // at one weight each they would reach the solver on identical scores and turn
  // spec §2's "unambiguous shape" row into an AmbiguityError naming Jersey.
  const uk = readings("SW1A 1AA");
  expect(uk.map((m) => m.unit)).toEqual(["gb", "je", "im", "gg"]);
  for (let i = 1; i < uk.length; i += 1)
    expect(uk[i - 1]?.weight ?? 0).toBeGreaterThan(uk[i]?.weight ?? 0);

  expect(codes.evaluate("SW1A 1AA").value.unit).toBe("gb");
  expect(codes.suggest("SW1A 1AA").map((r) => r.value.unit)).toEqual([
    "gb",
    "je",
    "im",
    "gg",
  ]);
});

test("a code renders itself over its country's facts", () => {
  // `name` is the code and `geonameId` is not the country's, which is the pair
  // `formatPlace` reads to decide it is looking at something inside a country
  // rather than at the country itself.
  expect(codes.evaluate("SW1A 1AA").formatted).toBe(
    "SW1A 1AA, GB — GBP, +44, Europe/London, 66M",
  );
  // The surface as typed, not the lowercased word the trie walks on.
  expect(metaOf(readings("m5v 3l9")[0] as LiteralMatch).name).toBe("m5v 3l9");
  expect(metaOf(readings("M5V 3L9")[0] as LiteralMatch).name).toBe("M5V 3L9");
});

test("a country with no postal system is never claimed", () => {
  const withoutFormat = new Set(
    COUNTRIES.filter((c) => c.postalRegex === "").map((c) => c.a2),
  );
  expect(withoutFormat.size).toBeGreaterThan(50);
  for (const probe of ["SW1A 1AA", "90210", "1234 AB", "123 45", "01310-100"])
    for (const unit of units(probe)) expect(withoutFormat.has(unit)).toBe(false);
});

// ---- The normalization GeoNames' column 14 needs ----

test("the anchors are reapplied, not trusted", () => {
  // GeoNames writes the British format as `^A|B$`, which as written means
  // "starts with A, or ends with B". Read verbatim it claims "GIR0AAX".
  expect(readings("GIR0AAX")).toEqual([]);
  // Ireland's carries no `$` at all, so verbatim it claims any tail.
  expect(readings("D02AF30XYZ")).toEqual([]);
  // Canada's carries a trailing space *after* its `$`; without the trim the
  // pattern would demand one and no Canadian code would ever claim.
  expect(units("M5V 3L9")).toEqual(["ca"]);
  // Eight rows are an example code rather than a pattern, and one of them is
  // Nauru's. Anchoring is the whole of what makes them usable.
  expect(units("NRU68")).toEqual(["nr"]);
});

test("the format table is case-insensitive, as the input is not", () => {
  // `normalize()` does not case-fold, and GeoNames writes its letter classes
  // uppercase, so a lowercased code would miss every one of them.
  expect(units("m5v 3l9")).toEqual(["ca"]);
  expect(units("sw1a 1aa")[0]).toBe("gb");
});

test("no word the engine needs is a postal code", () => {
  // The 805 words `RESERVED_WORDS` holds are the engine's own vocabulary —
  // keywords, numerals, months, weekdays, chrono's patterns and every builtin
  // unit alias. A format that accepted one of them would eat it, since a claim
  // over a word carries no digits for the fold to leave behind.
  const claimed = [...RESERVED_WORDS].filter((word) => readings(word).length > 0);
  expect(claimed).toEqual([]);
});

// ---- §6.2: the qualified form ----

test("a country named in front of the code claims the pair as one literal", () => {
  expect(units("us 90210")).toEqual(["us"]);
  expect(units("japan 100-0001")).toEqual(["jp"]);
  // The code still has to fit the country named: 90210 is not a Japanese one.
  expect(readings("japan 90210")).toEqual([]);
});

test("a country named behind the code claims the pair as one literal", () => {
  expect(units("100-0001 japan")).toEqual(["jp"]);
  expect(readings("100-0001 japan")[0]?.length).toBe("100-0001 japan".length);
});

test("naming a country is how the other fifty-nine are reached", () => {
  expect(units("mexico 90210")).toEqual(["mx"]);
  expect(units("90210 mexico")).toEqual(["mx"]);
  expect(units("90210")).toEqual(["us"]);
});

test("a keyword is never a qualifier", () => {
  // `in` is India, `to` is Tonga, `as` is American Samoa. India's format accepts
  // six digits, so without the guard "in 110001" would eat the conversion
  // keyword — and there is no second reading of a two-token claim to fall back
  // on.
  expect(readings("in 110001")).toEqual([]);
  expect(readings("110001 in")).toEqual([]);
  expect(codes.evaluate("3pm in japan").formatted).toBe(
    names.evaluate("3pm in japan").formatted,
  );
});

test("a short qualifier must be the alpha-2, not the alpha-3", () => {
  // The alpha-3 column is where "and" is Andorra, "ago" is Angola, "are" the
  // Emirates and "can" Canada, and `foldLiterals` runs before `foldNumerals`, so
  // a claim there would reach into "two hundred and 123". Enumerating the short
  // codes that are also English words is the alternative `claimable` already
  // rejected in `matcher.ts`: the list fails destructively on the one it forgets.
  expect(readings("and 123")).toEqual([]);
  expect(readings("are 12345")).toEqual([]);
  expect(readings("per 123456")).toEqual([]);
  // The cost of the same rule, recorded rather than discovered later.
  expect(readings("usa 90210")).toEqual([]);
  expect(units("us 90210")).toEqual(["us"]);
});

test("a trailing qualifier that is a unit stays the unit", () => {
  // `kg` is Kyrgyzstan, and a two-token claim is the only reading those two
  // tokens have — so "123456 kg" has to stay the mass it is without geo.
  expect(readings("123456 kg")).toEqual([]);
  expect(codes.evaluate("123456 kg").formatted).toBe(
    names.evaluate("123456 kg").formatted,
  );

  // The guard is asked only of a qualifier below `MIN_NAME_LENGTH`, because
  // above it the answer says nothing: the kind registers each country's own name
  // as a unit, so `isUnitAlias` reports "japan" and "mexico" too. That is the
  // trap `scopeFrom` fell into in M6.2, where "athens georgia" threw.
  expect(units("100-0001 japan")).toEqual(["jp"]);
  expect(units("90210 mexico")).toEqual(["mx"]);

  // And it is asked of the *engine*, not of a list. Nothing in this repo owns
  // "us", so "12345 us" is a ZIP here; register microseconds under that alias
  // and it goes back to being a duration.
  expect(units("12345 us")).toEqual(["us"]);
  const withMicros: MatchCtx = {
    ...ctx,
    isUnitAlias: (t) => t === "us" || ctx.isUnitAlias(t),
  };
  expect(readings("12345 us", withMicros)).toEqual([]);
});

test("a unit symbol inside the code's own shape stays the unit", () => {
  // The Netherlands' format is `#### @@`, which is not merely postcode-shaped:
  // it is exactly a four-digit quantity beside a two-letter symbol. The letters
  // are part of the *code* here rather than a qualifier beside it, so the
  // qualifier guard above never sees them, and `lettered` waves a lettered span
  // through wherever it appears — which made "1234 kg" a Dutch postcode and not
  // a mass, and "1000 ms" a postcode and not a duration. Found by sweeping every
  // registered unit alias against a number of every width.
  for (const input of ["1234 kg", "1000 ms", "5000 mi", "1234 cm", "2000 ft"]) {
    expect(readings(input)).toEqual([]);
    expect(answer(codes, input)).toBe(answer(names, input));
  }

  // The cost, stated: a genuine `#### @@` code whose letters spell a registered
  // symbol loses its *unqualified* reading. "1234 kg" is a real Kerkrade
  // postcode, and naming the country in front is how it is still reached —
  // which is the trade §6.2 already makes for "90210" against "us 90210".
  expect(units("nl 1234 kg")).toEqual(["nl"]);
  // Letters nobody registered were never in doubt.
  expect(units("1234 ab")).toEqual(["nl"]);

  // And the guard is the qualifier guard's rule, not a denylist: it asks the
  // engine, and only of a word too short to be a name.
  expect(units("1234 lisboa")).toEqual([]);
  expect(units("1234-567 lisboa")).toEqual(["pt"]);
});

// ---- §6.2's hard constraint: ordinary numbers are untouched ----

test("a bare numeric code is a number, with the place beneath it", () => {
  const r = codes.evaluate("90210");
  expect(r.kind).toBe("number");
  expect(r.formatted).toBe("90,210");

  const suggested = codes.suggest("90210");
  expect(suggested.map((s) => s.kind)).toEqual(["number", "place"]);
  expect(suggested[1]?.value.unit).toBe("us");
  expect(suggested[1]?.formatted).toBe("90210, US — USD, +1, America/New_York, 327M");
});

test("the weight is what makes it a number, and it is derived from core's", () => {
  const claim = readings("90210")[0];
  expect(claim?.weight).toBeLessThan(NUMBER_FALLBACK_WEIGHT);
  // Not merely below it: far enough below to clear the 0.05 ambiguityEpsilon,
  // which is what stops `90210` being an AmbiguityError instead of a number.
  expect(NUMBER_FALLBACK_WEIGHT - (claim?.weight ?? 0)).toBeGreaterThanOrEqual(0.5);
});

test("a bare numeric code claims one country, not the sixty that fit it", () => {
  // Sixty countries accept five bare digits and forty-three accept four. They
  // are not alternatives a user could pick between, because the shape carries no
  // country in it at all.
  expect(units("90210")).toEqual(["us"]);
  expect(units("1234")).toEqual(["bd"]);
  expect(units("123456")).toEqual(["cn"]);
});

test("a bare numeric code is claimed only as a whole input", () => {
  expect(readings("90210 + 1")).toEqual([]);
  expect(readings("90210 km")).toEqual([]);
  expect(readings("90210 to 10001")).toEqual([]);
  // Same span, same digits, nothing else in the input.
  expect(units("90210")).toEqual(["us"]);
});

test("a separator code is claimed only as a whole input either", () => {
  // "12345-6789" is a ZIP+4 and a subtraction, and the claim would span all
  // three tokens with no arithmetic reading left underneath. Alone it is the
  // code, which is the same ruling spec §2 makes for "01310-100"; inside an
  // expression the arithmetic wins because the claim is never made.
  expect(units("12345-6789")).toEqual(["us"]);
  expect(readings("12345-6789 * 2")).toEqual([]);
  expect(readings("12345-6789 + 1")).toEqual([]);
});

/**
 * The milestone's own list, plus the shapes this matcher is most likely to have
 * eaten. Asserted against the engine without the postal literal rather than
 * against a literal string, because a row that moved in both engines at once
 * would still be a regression — just not this matcher's.
 */
const UNTOUCHED = [
  "10 km",
  "90210 + 1",
  "1 kg + 500 g",
  "two hundred and five km",
  "3 days ago",
  "12345 - 6789",
  "12345-6789 * 2",
  "205 + 500 + 123456",
  "2026 - 1990",
  "3pm in japan",
  "japan to ukraine",
  "20% of 50",
  "100 gb in mb",
];

for (const input of UNTOUCHED) {
  test(`registering the postal literal does not move "${input}"`, () => {
    const before = names.evaluate(input);
    const after = codes.evaluate(input);
    expect(`${input} => ${after.kind} ${after.formatted}`).toBe(
      `${input} => ${before.kind} ${before.formatted}`,
    );
    // Not only the answer: the alternatives too. A dead place candidate under
    // every number would show up here as an extra row long before it showed up
    // as a wrong answer.
    expect(codes.suggest(input).map((s) => s.kind)).toEqual(
      names.suggest(input).map((s) => s.kind),
    );
  });
}

test("no ordinary number becomes ambiguous", () => {
  for (const input of UNTOUCHED)
    expect(() => codes.evaluate(input)).not.toThrow(AmbiguityError);
});

/**
 * The regression net that matters more than any row above.
 *
 * Sixty countries accept five bare digits, so the honest proof that no other
 * kind lost a reading is to replay every input the repo asserts anywhere. The
 * corpora are compared engine against engine rather than against their own
 * expected columns: this file is about the *difference* one matcher makes, and
 * an input that throws in both is as much a match as one that evaluates in both.
 */
const ROOT = new URL("../../../", import.meta.url);

const answer = (engine: typeof codes, input: string): string => {
  try {
    const r = engine.evaluate(input);
    return `${r.kind} ${r.value.canonical.toString()} ${r.formatted}`;
  } catch (e) {
    return `throws ${(e as Error).constructor.name}`;
  }
};

// Discovered from the filesystem rather than listed, for the reason
// `ambiguity.test.ts` discovers them: a corpus added later would otherwise be
// absent from this net and nobody would notice until it broke.
const corpora = [...new Glob("packages/*/corpus/*.tsv").scanSync(ROOT.pathname)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

test("every corpus in the repo is replayed", () => {
  expect(corpora.length).toBeGreaterThan(3);
});

for (const file of corpora) {
  const raw = await Bun.file(new URL(file, ROOT)).text();
  const inputs = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split("\t")[0] as string);

  test(`${file} reads the same with the postal literal registered`, () => {
    expect(inputs.length).toBeGreaterThan(5);
    for (const input of inputs)
      expect(`${input} => ${answer(codes, input)}`).toBe(
        `${input} => ${answer(names, input)}`,
      );
  });
}

// ---- What the matcher does claim that nothing else wanted ----

test("a word in front of four digits can be a Maltese code, and costs nothing", () => {
  // Malta's format is three letters, an optional space and four digits, so
  // "ago 1234" is one. Recorded rather than guarded against: nothing in the
  // engine reads a unit *before* its quantity, so the input this claim takes
  // over is one that threw `UnitParseError` in every engine without geo.
  expect(units("ago 1234")).toEqual(["mt"]);
  expect(() => names.evaluate("ago 1234")).toThrow();
  // The shape a guard would have to refuse is the same one "AZ 1000" and
  // "SE123 45" need, which is why there is no guard.
  expect(units("AZ 1000")).toEqual(["az"]);
});

// ---- The invariants every place Value holds, held by a code too ----

test("a code's unit is a registered country and its meta agrees", () => {
  const registered = new Set(COUNTRIES.map((c) => c.a2));
  for (const probe of ["SW1A 1AA", "M5V 3L9", "01310-100", "123 45", "us 90210", "90210"])
    for (const match of readings(probe)) {
      expect(registered.has(match.unit)).toBe(true);
      expect(metaOf(match).country).toBe(match.unit);
      expect(match.kind).toBe("place");
      expect(match.length).toBeGreaterThan(0);
      // No id of its own until the provider path (spec §8) gives a code one,
      // and `formatPlace` reads exactly that to tell it from its country.
      expect(metaOf(match).geonameId).toBe(0);
    }
});

test("a code refuses to be measured rather than borrowing its country's position", () => {
  // The Value carries its country's coordinates so the rest of it stays usable,
  // and that made every pair of codes in one country measure zero:
  // "SW1A 1AA to EH1 1YZ" is London to Edinburgh and came back "0 kilometres".
  // A wrong answer delivered confidently is the one thing this engine refuses
  // everywhere else, so the op throws and the message names the remedy.
  expect(() => codes.evaluate("SW1A 1AA to EH1 1YZ")).toThrow(UnpositionedPlaceError);
  // Either side is enough, and a positioned place on the other does not rescue it.
  expect(() => codes.evaluate("SW1A 1AA to japan")).toThrow(UnpositionedPlaceError);
  // Countries and cities are untouched: they have positions of their own.
  expect(codes.evaluate("japan to france").kind).toBe("length");
});
