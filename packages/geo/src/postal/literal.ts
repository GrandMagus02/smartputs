import {
  Decimal,
  type LiteralMatch,
  type LiteralMatcher,
  type MatchCtx,
  NUMBER_FALLBACK_WEIGHT,
  type PlaceMeta,
} from "@smartput/core";
import type { PostalCountry } from "../kind/types";

const PLACE_KIND = "place";

/**
 * Below this a single-word alias is an ISO code rather than a name, which is
 * what `qualifier` and `shadowed` below both turn on.
 *
 * The same figure `@smartput/country`'s matcher exports as `MIN_NAME_LENGTH`,
 * and respelled here rather than imported because the dependency runs the other
 * way: the place kind names `createPostalLiteral`, so this package cannot name
 * that one back. Two spellings of one number is exactly the drift `RANK_STEP`'s
 * header refuses to allow, so it is not left to a comment —
 * `country/src/postal-agreement.test.ts` imports both and asserts they are
 * equal, and a change to either fails there.
 */
export const MIN_ALIAS_LENGTH = 4;

/**
 * The gap kept between one reading of a span and the next.
 *
 * Readings have to be separated and not merely ordered, and the gap has to be
 * the same one the name matcher keeps: §6.1's weights are a ranking the solver
 * then scores against a single `ambiguityEpsilon`. Four countries share the
 * British format and three share Sweden's `123 45`, so emitting them at one
 * weight would turn `SW1A 1AA` — spec §2's "unambiguous shape" row — into an
 * `AmbiguityError` naming Jersey and Guernsey. Ranking by the population *value*
 * fails the same way, because the scale §6.1 uses for cities caps at `+2` and
 * Czechia, Sweden and Slovakia all sit above the cap.
 *
 * Where the name matcher clamps each reading down to its neighbour, every
 * reading here descends from one base: the readings of a code are the same
 * country reached through the same digits, differing only in whose format the
 * digits happen to fit, so there is no per-reading figure §6.1 gives them to
 * preserve.
 *
 * Respelled rather than imported for `MIN_ALIAS_LENGTH`'s reason, and pinned to
 * the matcher's by the same test.
 */
export const RANK_STEP = 0.5;

/**
 * §6.1 gives a country `+3`, and what this matcher produces is a country's
 * Value reached through a code instead of through a name.
 *
 * Not the scoped `+4`. That row is paid for being explicit about *which* of
 * several places the user meant, and a code is explicit about nothing: every
 * reading it yields comes off the same country row, differing only in which
 * country's format the digits happen to fit.
 */
const POSTAL_WEIGHT = 3;

/**
 * Spec §6.2's headline: `90210` is a number, and the *weight* is what says so.
 *
 * Derived from the constant rather than written as `-1`, because the number it
 * has to lose to is core's and not this package's — a matcher that hardcodes
 * `-1` is one bump of `NUMBER_FALLBACK_WEIGHT` away from silently winning. One
 * `RANK_STEP` below it is the smallest gap that clears the epsilon.
 */
const BARE_NUMERIC_WEIGHT = NUMBER_FALLBACK_WEIGHT - RANK_STEP;

/**
 * "SW1A 1AA", "123 45", "AZ 1000", "1234-567 lisboa" — two words is the widest
 * shape in the shipped table, and the walk stops there rather than reading on
 * for a third that no format can complete.
 */
const MAX_CODE_WORDS = 2;

/** The code plus a country qualifier on one side of it (spec §6.2). */
const MAX_WORDS = MAX_CODE_WORDS + 1;

/**
 * GeoNames issues ids for features, and a postal code is not one, so there is no
 * honest id to put here and `0` is not an id it hands out.
 *
 * It is also load-bearing for the formatter: `formatPlace` tells a country from
 * a city by comparing this against the country's own id, so a code that carried
 * the country's id would render as "United Kingdom" instead of "SW1A 1AA, GB".
 * Coordinates of the code's own are what would make this a real feature, and
 * those need the provider path (spec §8) — until then the Value is the country,
 * addressed by a code.
 */
export const NO_GEONAME_ID = 0;

/**
 * The locale's keyword surface words, for the reason the name matcher hardcodes
 * the same set: `in` is India, `to` is Tonga, `as` is American Samoa and `by` is
 * Belarus, and a claim that eats one of them takes the conversion grammar with
 * it. Only an alias can ever reach this set, so the word-ops are carried for
 * symmetry rather than because a country is named "minus".
 *
 * Duplicated rather than imported: the matcher does not export it, and eleven
 * strings are cheaper than a dependency that would have to run uphill.
 * `RESERVED_WORDS` looks like the better answer and is not — it holds "us" and
 * "usa", because `us` is a microsecond, and refusing those would refuse spec
 * §6.2's own example.
 */
const KEYWORDS = new Set([
  "in",
  "to",
  "as",
  "of",
  "by",
  "plus",
  "minus",
  "times",
  "multiplied",
  "over",
  "divided",
]);

/**
 * `PostalCountry.postalRegex` is GeoNames' column 14 verbatim, and it is not a
 * uniform shape. 74 of 252 rows are empty; 8 are an example code rather than a
 * pattern ("FIQQ 1ZZ", "96799", "NRU68"); Canada's carries a trailing space
 * *after* its `$`; Ireland's has no `$` at all; and the United Kingdom's is
 * `^A|B$`, which as written means "starts with A, or ends with B" and matches
 * far more than a postcode.
 *
 * So the anchors are stripped and reapplied around a non-capturing group. That
 * is the whole normalization, and it is what fixes the last two: an unanchored
 * pattern becomes anchored, and a top-level alternation ends up inside both
 * anchors instead of splitting them. Rewriting the *insides* — turning the
 * `(?:AD)*` country prefixes into `?`, say — is deliberately not done: those
 * are a real way people write the code, and editing a source pattern's
 * quantifiers is guessing at data the generator committed on purpose.
 *
 * Case-insensitive because GeoNames writes the letter classes uppercase and
 * `normalize()` does not case-fold, so "m5v 3l9" would otherwise miss. No `u`
 * flag: every shipped row compiles with it today, but it rejects escapes the
 * others accept, and a regeneration that adds one should lose that country's
 * codes rather than throw on import.
 */
function compile(source: string): RegExp | null {
  let body = source.trim();
  if (body.startsWith("^")) body = body.slice(1);
  if (body.endsWith("$")) body = body.slice(0, -1);
  body = body.trim();
  if (body === "") return null;

  try {
    const re = new RegExp(`^(?:${body})$`, "i");
    // A pattern that accepts the empty string accepts every span, since the
    // walk below only ever offers it whole words.
    return re.test("") ? null : re;
  } catch {
    return null;
  }
}

interface PostalRow {
  readonly row: PostalCountry;
  readonly test: RegExp;
}

/**
 * A trailing word some kind has registered as a unit, which a claim spanning it
 * would take away with nothing left underneath: the fold keeps the single token
 * beneath a one-token claim, and a two-token claim has no such fallback.
 *
 * Asked only of a short word, exactly as `claimable` asks it. A unit symbol
 * short enough to collide with a code always is short, and above that length the
 * answer is useless: the kind this matcher belongs to registers every country's
 * own name as a unit, so `isUnitAlias` reports "mexico" and this would refuse
 * every long word there is. That is the trap `scopeFrom` fell into in M6.2,
 * where "athens georgia" threw because every country name is a registered alias.
 */
function shadowed(word: string, ctx: MatchCtx): boolean {
  return word.length < MIN_ALIAS_LENGTH && ctx.isUnitAlias(word);
}

const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const LETTER = /\p{L}/u;
const DIGITS_ONLY = /^\d+$/;

function isWordChar(input: string, i: number): boolean {
  const ch = input[i];
  return ch !== undefined && WORD_CHAR.test(ch);
}

/**
 * `-` sits inside "01310-100", "L-1234" and "MD-2001" and is also subtraction.
 * It counts as part of a word only between two word characters, which is what
 * keeps "12345 - 6789" three tokens; what it cannot do is tell "12345-6789"
 * from a ZIP+4, and that is what the whole-input rule below is for.
 *
 * No apostrophe, unlike the name matcher's: no postal format contains one, and
 * carrying it would let "japan's" reach the qualifier index.
 */
function wordEnd(input: string, start: number): number {
  let i = start;
  while (i < input.length) {
    if (isWordChar(input, i)) {
      i += 1;
      continue;
    }
    if (input[i] === "-" && i > start && isWordChar(input, i + 1)) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

/** Words a claim could span, with the offset each ends at. Stops at anything
 * that is not a single space, so an operator or a paren ends the run. */
function scan(input: string, offset: number): number[] {
  const ends: number[] = [];
  let i = offset;

  while (ends.length < MAX_WORDS) {
    const end = wordEnd(input, i);
    if (end === i) break;
    ends.push(end);
    if (input[end] !== " ") break;
    i = end + 1;
  }

  return ends;
}

/**
 * Spec §6.2's postal literal: a code is a place, and most codes are also
 * numbers.
 *
 * Three shapes reach a claim, and the difference between them is not the format
 * but whether the span has any other reading to lose. The fold keeps a claim's
 * *word* beside it, so a claim over a single number token still leaves the
 * number underneath — but a claim over two tokens is the only reading of those
 * two tokens there is. That, and not the regexes, is what the rules below are
 * about:
 *
 * - **Qualified** — `us 90210`, `100-0001 japan`. One literal, never an
 *   operation, which is §6.2's ruling and §5.2's before it: `90210 as us` as a
 *   grammar would give the `in | place | place` signature a second intent
 *   beside distance, and a signature that means two things is what the whole
 *   matcher exists to avoid.
 * - **Unqualified with a letter** — `SW1A 1AA`, `M5V 3L9`, `AD123`. Nothing else
 *   in the engine reads those characters as a quantity, so they are claimed
 *   wherever they appear.
 * - **Unqualified with no letter** — `90210`, `01310-100`, `123 45`. Claimed
 *   only when the span is the *entire* input. Sixty countries have a format that
 *   fits five bare digits and forty-three fit four, so without this every
 *   3-to-6-digit number in every expression would carry a dead place candidate
 *   the solver has to try; and "12345-6789" would stop being a subtraction. A
 *   bare code is a lookup, and the moment an operator or a unit sits beside it
 *   the user is doing arithmetic.
 *
 * On top of that a digits-only span weighs `BARE_NUMERIC_WEIGHT`, which is what
 * makes `evaluate("90210")` the number and `suggest("90210")` the number with
 * the place behind it. The other two shapes have no number reading left to lose
 * and take the ordinary `POSTAL_WEIGHT`.
 *
 * `countries` is the same array the kind registers its units from, so every
 * `unit` this emits names something registered — a claim naming a unit the kind
 * does not have is dropped by the fold, less legibly than it is refused here.
 */
export function createPostalLiteral(countries: readonly PostalCountry[]): LiteralMatcher {
  const formats: PostalRow[] = [];
  for (const row of countries) {
    const test = compile(row.postalRegex);
    if (test !== null) formats.push({ row, test });
  }
  // Sorted once, so every `filter` below comes out ranked and nothing at match
  // time re-decides the order. Population for §6.1's reason, and `a2` under it
  // so two uninhabited territories do not swap places between builds.
  formats.sort(
    (a, b) => b.row.population - a.row.population || a.row.a2.localeCompare(b.row.a2),
  );

  // Single-word aliases only. A multi-word qualifier ("united states 90210") is
  // a fourth word this walk does not have, and the code is what a user writes
  // beside a code anyway.
  const byAlias = new Map<string, PostalRow[]>();
  for (const entry of formats) {
    for (const alias of entry.row.aliases) {
      if (alias.includes(" ")) continue;
      const at = byAlias.get(alias);
      if (at === undefined) byAlias.set(alias, [entry]);
      else at.push(entry);
    }
  }

  const meta = (row: PostalCountry, code: string): PlaceMeta => ({
    geonameId: NO_GEONAME_ID,
    // The code itself, so the line reads "SW1A 1AA, GB". Everything under it is
    // the country's, because without a provider (spec §8) the country is all a
    // code knows — including the coordinates, which is why a code-to-code
    // distance is a country-to-country one and says so in `meta`.
    name: code,
    zone: row.zone,
    currency: row.currency,
    lat: row.lat,
    lon: row.lon,
    population: row.population,
    country: row.a2,
  });

  const claims = (
    rows: readonly PostalRow[],
    code: string,
    length: number,
    base: number,
  ): LiteralMatch | readonly LiteralMatch[] => {
    const readings = rows.map((entry, rank) => ({
      kind: PLACE_KIND,
      unit: entry.row.a2,
      canonical: new Decimal(NO_GEONAME_ID),
      meta: Object.freeze(meta(entry.row, code)),
      length,
      weight: base - rank * RANK_STEP,
      // Same opt-in a name claim takes: a code is the right operand of
      // "3pm in us 90210" and "100 usd in us 90210", and both read this `meta`.
      targetable: true,
    }));
    return readings.length === 1 ? (readings[0] as LiteralMatch) : readings;
  };

  /**
   * A country named beside the code. Refused when it is a keyword, and when it
   * is shorter than a name it must be the alpha-2 — the form `us 90210` is
   * actually written in. The alpha-3 column is where "and" is Andorra, "ago" is
   * Angola, "are" the Emirates and "can" Canada, and `claimable` in the name matcher
   * already rejected enumerating the short codes that are English words: the
   * list fails destructively on the one it forgets. The cost is that `usa 90210`
   * is not claimed while `us 90210` is.
   */
  const qualifier = (alias: string, code: string): PostalRow[] => {
    if (KEYWORDS.has(alias)) return [];
    const rows = byAlias.get(alias);
    if (rows === undefined) return [];
    if (alias.length < MIN_ALIAS_LENGTH && !rows.some((e) => e.row.a2 === alias))
      return [];
    return rows.filter((e) => e.test.test(code));
  };

  return (input, offset, ctx: MatchCtx) => {
    const ends = scan(input, offset);
    if (ends.length === 0) return null;
    const startOf = (i: number) => (i === 0 ? offset : (ends[i - 1] as number) + 1);
    const word = (i: number) => input.slice(startOf(i), ends[i] as number).toLowerCase();

    // Longest first, and a shorter span is tried only because the longer one
    // matched nothing — the same rule the name matcher walks its trie by.
    for (let total = ends.length; total >= 1; total -= 1) {
      const end = ends[total - 1] as number;

      if (total >= 2) {
        // Qualifier in front. Nothing is guarded against `isUnitAlias` here: a
        // unit is written *after* its quantity, so "us 90210" is never a
        // duration and "kg 123456" is never a mass.
        const after = input.slice(startOf(1), end);
        const leading = qualifier(word(0), after);
        if (leading.length > 0)
          return claims(leading, after, end - offset, POSTAL_WEIGHT);

        // Qualifier behind, which is exactly where a unit goes — and the claim
        // spans both tokens, so making it takes the quantity's unit away with no
        // reading left underneath. `kg` is Kyrgyzstan, so "123456 kg" has to
        // stay the mass it is without geo. Spec §2 lists `90210 us` beside
        // `us 90210`, and this is the one place the two forms are not
        // interchangeable: `us` claims only because no kind in this repo
        // registers microseconds under it.
        const trailingWord = word(total - 1);
        const code = input.slice(offset, ends[total - 2] as number);
        const trailing = shadowed(trailingWord, ctx) ? [] : qualifier(trailingWord, code);
        if (trailing.length > 0)
          return claims(trailing, code, end - offset, POSTAL_WEIGHT);
      }

      if (total > MAX_CODE_WORDS) continue;

      // The same question the qualifier branch asks, of a word that is part of
      // the *code* rather than beside it — because the Netherlands' format is
      // `#### @@`, which is not merely postcode-shaped but exactly the shape of
      // a four-digit quantity and a two-letter unit symbol. Without this
      // "1234 kg" is a Dutch postcode and not a mass, and so is "1000 ms",
      // "5000 mi" and every other quantity of that width: the claim spans both
      // tokens, so it takes the unit away with no reading left underneath, and
      // `lettered` waves it through wherever it appears.
      //
      // A unit is written after its quantity and a postcode's letters are not,
      // so the collision is one-directional and so is the guard. It costs the
      // unqualified reading of a genuine `#### @@` code whose letters spell a
      // registered symbol — "1234 kg" is a real Kerkrade postcode — and that is
      // the reading `1234 kg nl` and `nl 1234 kg` still reach, which is the
      // trade §6.2 already makes for `90210` against `us 90210`.
      if (total >= 2 && shadowed(word(total - 1), ctx)) continue;

      const code = input.slice(offset, end);
      // See the header: a span of digits and separators is claimed only as a
      // whole input. Asked before the formats are tried rather than after,
      // because it is the answer for every number in every expression and the
      // question it saves is 178 regexes wide.
      const lettered = LETTER.test(code);
      if (!lettered && (offset !== 0 || end !== input.length)) continue;

      const rows = formats.filter((e) => e.test.test(code));
      if (rows.length === 0) continue;

      if (lettered || !DIGITS_ONLY.test(code))
        return claims(rows, code, end - offset, POSTAL_WEIGHT);

      // One reading, where a lettered shape gets all of them. Sixty countries
      // accept five bare digits and they are not alternatives a user could pick
      // between — the shape carries no country in it at all, which is the same
      // reason `buildTrie` keeps one Congo. Sixty rows under the number in a
      // launcher list would bury the number's own. Naming a country is how a
      // user reaches the other fifty-nine, and that is the qualified form above.
      return claims(rows.slice(0, 1), code, end - offset, BARE_NUMERIC_WEIGHT);
    }

    return null;
  };
}
