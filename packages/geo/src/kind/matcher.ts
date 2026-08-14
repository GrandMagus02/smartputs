import {
  Decimal,
  type LiteralMatch,
  type LiteralMatcher,
  type MatchCtx,
  type PlaceMeta,
} from "@smartput/core";
import { RESERVED_WORDS } from "./reserved";
import type { Admin1Row, CityRow, CountryRow } from "./types";

const PLACE_KIND = "place";

/**
 * Spec §5.1. The generator emits no alias longer than this, so the bound is not
 * a filter on the data: it is what stops the walk from reading a whole sentence
 * looking for a fifth word that can never complete a name.
 *
 * It bounds the *whole* claim, scope included, so "sydney new south wales" is
 * the longest scoped form there is. Giving the scope a budget of its own was
 * the alternative and it buys nothing: no division name is four words, and one
 * bound is one thing to reason about when a claim comes out longer than a user
 * expected.
 */
const MAX_WORDS = 4;

/** Spec §6.1, in full. Every weight this file emits is one of these four. */
const COUNTRY_WEIGHT = 3;
const CAPITAL_WEIGHT = 2;
const CITY_WEIGHT_CAP = 2;
const SCOPED_WEIGHT = 4;

/**
 * Below this, a single-word alias is an ISO code rather than a name — see
 * `claimable`. Exported because the kind draws the same line: a name is safe to
 * put in the global alias index and a code is not.
 */
export const MIN_NAME_LENGTH = 4;

/**
 * The gap kept between one reading of a span and the next.
 *
 * §6.1's weights rank the readings of a name and nothing more, and a ranking
 * that the solver has to score is not the same object: confidences are a softmax
 * over summed weights, and `evaluate` throws `AmbiguityError` when the top two
 * land within `ambiguityEpsilon` of each other. San José, CR at `+2` against San
 * Jose, CA at `+1.9996` is a decided ranking and a coin flip once scored — 0.0001
 * apart in confidence against a 0.05 default — so emitting the tabled figures
 * verbatim turned `san jose` and `springfield`, both corpus rows, into errors
 * the moment the runner-up became reachable.
 *
 * `0.5` is `pratt.ts`'s own figure for exactly this question: half a point is
 * 0.62 against 0.38, well outside the epsilon. Exported because `postal.ts`
 * separates its readings for the same reason and against the same epsilon, and
 * two spellings of one constant are two things to keep in step.
 */
export const RANK_STEP = 0.5;

/**
 * The locale's keyword surface words, which `MatchCtx` does not expose.
 *
 * `in` is India, `to` is Tonga, `as` is American Samoa and `by` is Belarus, so
 * without this "japan to france" loses its conversion keyword to a country and
 * never parses — and the literal fold is destructive, so there is no second
 * reading to fall back on. `isUnitAlias` cannot see it: a keyword is not a unit.
 *
 * Hardcoded rather than adding `isKeyword` to `MatchCtx`, which is a change to
 * core's matcher contract for one plugin's two-letter codes. Same trade datetime
 * makes when it hardcodes English plural suffixes in `chrono-bridge.ts`.
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
 * Spec §6.1's population scale. Ten times the people is a third of a point, so
 * a city rises smoothly out of the noise instead of stepping between tiers, and
 * the cap keeps the largest of them below a country.
 *
 * A capital is flat rather than scaled because that is what the row of the table
 * says, and because the reason it is weighted at all is that it is a seat of
 * government: Nuku'alofa is 22 000 people and is still what "nuku'alofa" means.
 */
function cityWeight(row: CityRow): number {
  if (row.capital) return CAPITAL_WEIGHT;
  // GeoNames writes 0 where it has no figure, and log10(0) is -Infinity.
  if (row.population <= 0) return 0;
  return Math.min(Math.log10(row.population) / 3, CITY_WEIGHT_CAP);
}

interface CountryHit {
  readonly row: CountryRow;
  readonly weight: number;
}

/**
 * Alpha-2 ascending. Not `localeCompare`, which orders by the *host's* locale
 * and would let two machines rank two countries differently; an alpha-2 is two
 * ASCII letters, where `<` is already the alphabet.
 */
function byCode(a: CountryHit, b: CountryHit): number {
  if (a.row.a2 === b.row.a2) return 0;
  return a.row.a2 < b.row.a2 ? -1 : 1;
}

interface CityHit {
  readonly row: CityRow;
  readonly weight: number;
}

interface TrieNode {
  /**
   * Keyed on one lowercased word, which is what a name-shaped alias index has to
   * be: core's own alias index is keyed on a single segmented word and that is
   * exactly why "new zealand" cannot be an alias (spec §5.1).
   *
   * "paris texas" is another edge on this same map — a scoped match is a walk,
   * not an operation (spec §5.2) — so admin1 needed no new structure, only a
   * third payload beside the two below.
   */
  readonly next: Map<string, TrieNode>;
  /**
   * Every country of this alias, largest first.
   *
   * One of them until M6.4, because every country weighs a flat `+3`: both
   * Congos reached the solver on identical scores and turned `congo` from a
   * decided answer into an `AmbiguityError` naming two countries no further
   * input could separate. What expired that is `RANK_STEP` — the readings are
   * pushed apart on the way out, so the runner-up is listed without ever being
   * close enough to make the winner a coin flip. The tiebreak §6.1 was missing
   * is the one it already spends on cities: population.
   */
  countries?: CountryHit[];
  /** Every city of this alias, heaviest first. */
  cities?: CityHit[];
  /**
   * `Admin1Row.key` for every division of this alias, read only in the scoped
   * position. Kept as keys rather than rows because that is the whole of what
   * the scope test needs — a division is deliberately not a place (see
   * `Admin1Row`), so there is nothing else on the row worth carrying here.
   */
  admin1?: string[];
}

/** The division a city sits in, in `Admin1Row.key`'s spelling. */
function admin1Key(row: CityRow): string | null {
  return row.admin1 === "" ? null : `${row.country.toUpperCase()}.${row.admin1}`;
}

/** Descends, creating as it goes. Null for an alias the walk could never reach. */
function nodeFor(root: TrieNode, alias: string): TrieNode | null {
  const words = alias.split(" ");
  if (words.length > MAX_WORDS || words.some((w) => w.length === 0)) return null;

  let node = root;
  for (const word of words) {
    let next = node.next.get(word);
    if (next === undefined) {
      next = { next: new Map() };
      node.next.set(word, next);
    }
    node = next;
  }
  return node;
}

function buildTrie(
  countries: readonly CountryRow[],
  cities: readonly CityRow[],
  admin1: readonly Admin1Row[],
): TrieNode {
  const root: TrieNode = { next: new Map() };
  const registered = new Set(countries.map((c) => c.a2));

  // "congo" is both Congos and "soudan" is both Mali and Sudan, and over the
  // whole table those two names are the entirety of it — which is why one row
  // per node survived three milestones before the cost of it showed.
  const named: TrieNode[] = [];
  for (const row of countries) {
    const hit: CountryHit = { row, weight: COUNTRY_WEIGHT };
    for (const alias of row.aliases) {
      const node = nodeFor(root, alias);
      if (node === null) continue;
      if (node.countries === undefined) {
        node.countries = [];
        named.push(node);
      }
      node.countries.push(hit);
    }
  }
  // §6.1 ranks by population everywhere it has a choice, so it ranks here too.
  // Alpha-2 underneath it is a tiebreak nobody will meet — no two countries of
  // one alias share a population — and it is here so the order is a fact about
  // the data rather than about the generator's row order, which is free to move.
  for (const node of named) {
    node.countries?.sort((a, b) => b.row.population - a.row.population || byCode(a, b));
  }

  const populated: TrieNode[] = [];
  for (const row of cities) {
    // `LiteralMatch.unit` has to name a unit the kind registered, and the kind
    // registers one per country (spec §4.1). A city whose country is missing
    // from this table has no unit to be claimed under, so it is not carried at
    // all — a claim naming an unregistered unit fails later and less legibly.
    if (!registered.has(row.country)) continue;
    const hit: CityHit = { row, weight: cityWeight(row) };
    for (const alias of row.aliases) {
      const node = nodeFor(root, alias);
      if (node === null) continue;
      if (node.cities === undefined) {
        node.cities = [];
        populated.push(node);
      }
      node.cities.push(hit);
    }
  }
  // Sorted once here rather than searched at match time: the order is the
  // answer to both "which unscoped city is this" and "which of the ones in the
  // named division", so both readings are a first-match on the same array.
  for (const node of populated) {
    node.cities?.sort(
      (a, b) => b.weight - a.weight || b.row.population - a.row.population,
    );
  }

  for (const row of admin1) {
    for (const alias of row.aliases) {
      const node = nodeFor(root, alias);
      if (node === null) continue;
      if (node.admin1 === undefined) node.admin1 = [];
      node.admin1.push(row.key);
    }
  }

  return root;
}

const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;

/**
 * `-` and `'` sit inside aliases ("guinea-bissau", "people's republic of
 * china") but are also an operator and a possessive. They count as part of a
 * word only between two word characters, which keeps "japan - france" three
 * tokens and "japan's" a word the trie does not carry.
 */
const INNER = new Set(["-", "'"]);

function isWordChar(input: string, i: number): boolean {
  const ch = input[i];
  return ch !== undefined && WORD_CHAR.test(ch);
}

function wordEnd(input: string, start: number): number {
  let i = start;
  while (i < input.length) {
    if (isWordChar(input, i)) {
      i += 1;
      continue;
    }
    const ch = input[i];
    if (ch !== undefined && INNER.has(ch) && i > start && isWordChar(input, i + 1)) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

/**
 * The words a claim could span, with the offset each one ends at.
 *
 * Stops at the first thing that is not a single space, so an operator or a
 * parenthesis ends the run — the matcher never has to know what those are, only
 * that a name is not written across one.
 */
function scan(input: string, offset: number): { words: string[]; ends: number[] } {
  const words: string[] = [];
  const ends: number[] = [];
  let i = offset;

  while (words.length < MAX_WORDS) {
    const end = wordEnd(input, i);
    if (end === i) break;
    // `toLowerCase`, not `toLocaleLowerCase`: the trie is ASCII, and a Turkish
    // fold turns "INDIA" into "ındia" and loses the match.
    words.push(input.slice(i, end).toLowerCase());
    ends.push(end);
    if (input[end] !== " ") break;
    i = end + 1;
  }

  return { words, ends };
}

/**
 * Spec §5.1's first guard, narrowed to codes.
 *
 * The spec exempts a country outright, on the grounds that country names are
 * never one letter and never collide. That reasoning covers names and not the
 * alpha-2 and alpha-3 codes sitting beside them in the same alias list: `km` is
 * Comoros and a kilometre, `gb` is the United Kingdom and a gigabyte, `in` is
 * India and an inch. Exempting those hands another kind's token to a place, and
 * the fold is destructive, so "10 km" would have no length reading left.
 *
 * `isUnitAlias` only covers the codes another *kind* claims, and the ones that
 * hurt most are claimed by nobody: `and` is Andorra, `ago` is Angola, `is` is
 * Iceland, `it` is Italy. A lowercase code is therefore refused outright, so
 * "two hundred and five g" keeps its number and "3 days ago" keeps its date —
 * and a code written the way an ISO code is written, "japan to UA", still
 * claims. Enumerating the short codes that are also English words was the
 * alternative; it fails destructively on the one word the list forgets, where
 * this fails by not recognising a lowercase code, which the country's name
 * always covers.
 */
function claimable(word: string, surface: string, ctx: MatchCtx): boolean {
  if (KEYWORDS.has(word)) return false;
  if (word.length >= MIN_NAME_LENGTH) return true;
  if (ctx.isUnitAlias(word)) return false;
  return surface !== word;
}

/**
 * The same question for a city, and answered far more strictly.
 *
 * A country name is a proper noun that no locale uses for anything else, which
 * is what earns countries the exemption above. City names are not: Nice, Mobile
 * and Reading are all over 100 000 people, and a table that reaches down to the
 * towns finds March, Boring and Why. So a single-word city is refused whenever
 * the word belongs to something else — a keyword or numeral or unit, via
 * `RESERVED_WORDS` — or is too short to be a name at all.
 *
 * `RESERVED_WORDS` is imported rather than passed in with the tables, even
 * though it costs the countries-only build a few kilobytes it never reads. The
 * guard is a property of the matcher and not of the data a caller supplies: as
 * a parameter it is one forgotten argument away from a table that eats "march",
 * and a mistake here is one the corpora would have to catch. The generator
 * applies the same set to CITIES before emitting, so this is the second of two
 * nets.
 *
 * `ctx.isUnitAlias` was the third until M6.3 and is gone, which is spec §6.3's
 * defect closing. Yielding was the only non-destructive answer a matcher had
 * while the fold kept one claim per offset: "tokyo" is an alias of datetime's
 * Asia/Tokyo, so claiming it took the zone away and cost "3pm in tokyo", and
 * refusing it took the city away and cost "tokyo to kyoto" — seventeen names,
 * all of them datetime's. The fold now keeps the word beside the claim, so both
 * readings reach the solver and the weights decide; there is nothing left to
 * yield to. `RESERVED_WORDS` stays because the words it holds are not readings
 * to be ranked — "march" and "may" and "one" are the engine's own vocabulary,
 * and a claim over one of them competes with a *numeral*, which never reaches
 * the solver as a candidate at all.
 *
 * No keyword check: `RESERVED_WORDS` is derived from core's keyword list among
 * its sources, and `reserved.test.ts` asserts every one of them is in it.
 */
function cityClaimable(word: string): boolean {
  if (word.length < MIN_NAME_LENGTH) return false;
  return !RESERVED_WORDS.has(word);
}

interface Scoped {
  readonly hit: CityHit;
  readonly end: number;
}

/**
 * Spec §5.2. Having matched a city, keep walking: a division of its country or
 * the country itself, starting from the root at word `from`.
 *
 * Deliberately not an op. Making `paris in us` a scope filter would have
 * overloaded `in | place | place` with two intents — distance and filtering —
 * and forced a runtime branch on feature class inside one `apply`. Here scope is
 * a longer walk down the map already being walked, and the signature keeps
 * meaning exactly one thing.
 *
 * The scope's first word is guarded, and by two different rules, because the two
 * tables were filtered differently. ADMIN1 has been through `RESERVED_WORDS`,
 * which contains every country short code and every keyword, so "oh" and "wa"
 * are safe to read while Oregon's "or" is already gone. The country table has
 * not been through anything — it carries every alpha-2 raw — so a country scope
 * has to answer `claimable`, the same rule the first word of any claim answers.
 * Without it "nuku'alofa to japan" scopes the Tongan capital by Tonga's own `to`
 * and swallows the conversion keyword.
 */
function scopeFrom(
  root: TrieNode,
  cities: readonly CityHit[],
  words: readonly string[],
  ends: readonly number[],
  from: number,
  input: string,
  ctx: MatchCtx,
): Scoped | null {
  if (from >= words.length) return null;
  const first = words[from] as string;
  const start = (ends[from - 1] as number) + 1;
  const surface = input.slice(start, ends[from] as number);

  const path: TrieNode[] = [];
  let node = root;
  for (let i = from; i < words.length; i += 1) {
    const next = node.next.get(words[i] as string);
    if (next === undefined) break;
    node = next;
    path.push(next);
  }

  // Longest scope first, for the reason the base walk prefers the longest name:
  // "nova scotia" is a division and "nova" is not one the user meant.
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const at = path[i] as TrieNode;
    const end = ends[from + i] as number;

    // `isUnitAlias` is deliberately NOT consulted here, though it is on every
    // other branch. In the scoped position the word is the second half of a
    // two-word claim, and the `find` below already proves the scope: it only
    // succeeds when one of the candidate cities really is in that division, so a
    // word that is also a unit alias cannot produce a false claim. Guarding on
    // it instead cost §9's headline row — "georgia" is a country alias, so
    // `athens georgia` skipped this branch, asked the country branch for an
    // Athens in Georgia-the-country, and threw.
    if (at.admin1 !== undefined && !KEYWORDS.has(first)) {
      const keys = at.admin1;
      const hit = cities.find((c) => {
        const key = admin1Key(c.row);
        return key !== null && keys.includes(key);
      });
      if (hit !== undefined) return { hit, end };
    }

    // Every country of the scope word, largest first, so the answer is the
    // biggest one that really holds a city of the name. "brazzaville congo" is
    // what that buys: the Republic of the Congo is the runner-up of "congo",
    // and while the node carried one country the scope asked the DRC, missed,
    // and degraded to the unscoped city — a worse reading of an input where the
    // user had already been explicit.
    if (at.countries !== undefined && claimable(first, surface, ctx)) {
      for (const { row } of at.countries) {
        const hit = cities.find((c) => c.row.country === row.a2);
        if (hit !== undefined) return { hit, end };
      }
    }
  }

  return null;
}

/**
 * Ranked readings of one span, pushed apart until consecutive ones are at least
 * `RANK_STEP` from each other.
 *
 * A clamp downwards and never a lift, so the winner keeps the figure §6.1 tables
 * for it exactly — which matters because the winner's weight is the one that
 * leaves this package: it is what a place scores against a datetime zone or a
 * currency in "3pm in tokyo", and a Tokyo that got heavier for having homonyms
 * would let the size of the gazetteer decide a question between two kinds.
 * Normalising the whole run onto one base, the way `postal.ts` can, is what that
 * rules out: there every reading is the same country reached through a code, and
 * here `+3` against `+2` is a real difference the solver is entitled to see.
 *
 * Spacing rather than dropping the runners-up, because the ranking is the answer
 * to §12.3's first defect: `suggest("springfield")` has to return three.
 */
function spaced(readings: readonly LiteralMatch[]): LiteralMatch[] {
  const out: LiteralMatch[] = [];
  let ceiling = Number.POSITIVE_INFINITY;

  for (const reading of readings) {
    const own = reading.weight ?? 0;
    const weight = Math.min(own, ceiling);
    ceiling = weight - RANK_STEP;
    out.push(weight === own ? reading : { ...reading, weight });
  }

  return out;
}

/**
 * The one matcher this kind registers for names (spec §5.1). Longest match
 * wins, and a match is always a whole number of words, which is what makes
 * "newark" impossible to read as "new" — the fold's token-boundary check is a
 * second net, not the first one.
 *
 * Longest wins; heaviest does not decide. Every reading of the winning span
 * leaves here ranked, heaviest first, and the solver ranks that against what
 * other kinds claim — which is spec §6.1's "each is a ranking, not a decision"
 * becoming true for the first time. Before M6.3 the contract was one claim per
 * offset, so `suggest("springfield")` returned one result where CITIES holds
 * three of the name.
 *
 * A lone reading is returned as itself rather than wrapped. The contract takes
 * either, and a claim on "japan" has exactly one reading in the same sense it
 * always did; wrapping it would push every caller through `[0]` to say nothing.
 *
 * `cities` and `admin1` are optional and default to empty, so the one-argument
 * call is not a special case of the three-argument one: with no cities the trie
 * has no city payload, `scopeFrom` is never reached, and `place` — which is
 * built from countries alone — behaves as it did before cities existed.
 */
export function createPlaceLiteral(
  countries: readonly CountryRow[],
  cities: readonly CityRow[] = [],
  admin1: readonly Admin1Row[] = [],
): LiteralMatcher {
  const root = buildTrie(countries, cities, admin1);
  // A city has no currency of its own (see `CityRow`); it borrows its country's,
  // because `PlaceMeta.currency` is what rates reads and it must not be blank
  // for "100 usd in chicago".
  const currencyOf = new Map(countries.map((c) => [c.a2, c.currency]));

  // Everything that distinguishes a country claim from a city one is already in
  // `meta`: §4.1 says the unit is the country and §4.2 says the canonical is the
  // GeoNames id, and both are fields of it.
  const claim = (meta: PlaceMeta, length: number, weight: number): LiteralMatch => ({
    kind: PLACE_KIND,
    unit: meta.country,
    canonical: new Decimal(meta.geonameId),
    meta: Object.freeze(meta),
    length,
    weight,
    // A place is a conversion target: it is the right operand of
    // "japan to ukraine", "3pm in japan" and "100 usd in japan", and all three
    // signatures read the `meta` above. Opting in is what carries this Value to
    // `apply` instead of core's meta-less stand-in.
    targetable: true,
  });

  const cityClaim = (hit: CityHit, offset: number, end: number, weight: number) =>
    claim(
      {
        geonameId: hit.row.geonameId,
        name: hit.row.name,
        // The city's own zone, not its country's: "3pm in chicago" is not
        // "3pm in washington", which is the entire reason T1 exists.
        zone: hit.row.zone,
        currency: currencyOf.get(hit.row.country) ?? "",
        lat: hit.row.lat,
        lon: hit.row.lon,
        population: hit.row.population,
        country: hit.row.country,
      },
      end - offset,
      weight,
    );

  return (input, offset, ctx) => {
    const { words, ends } = scan(input, offset);

    const path: TrieNode[] = [];
    let node = root;
    for (const word of words) {
      const next = node.next.get(word);
      if (next === undefined) break;
      node = next;
      path.push(next);
    }
    if (path.length === 0) return null;

    // A scoped claim is both longer and heavier than every unscoped one, so it
    // is tried first and never has to be compared against them. Longest city
    // name first: "san francisco california" scopes San Francisco, and the
    // question of whether "san" alone scopes better never arises.
    for (let i = path.length - 1; i >= 0; i -= 1) {
      const carried = (path[i] as TrieNode).cities;
      if (carried === undefined) continue;
      const scoped = scopeFrom(root, carried, words, ends, i + 1, input, ctx);
      // No guard on the city word here. A scoped claim is two words at minimum
      // and two words in a row are nobody's unit and nobody's keyword — the same
      // exemption a multi-word name has had since M6.1.
      if (scoped !== null)
        return cityClaim(scoped.hit, offset, scoped.end, SCOPED_WEIGHT);
    }

    for (let i = path.length - 1; i >= 0; i -= 1) {
      const at = path[i] as TrieNode;
      if (at.countries === undefined && at.cities === undefined) continue;

      // Only a one-word claim can be another kind's token: two words in a row
      // are nobody's unit and nobody's keyword.
      const single = i === 0;
      const word = words[0] as string;
      const surface = input.slice(offset, ends[0] as number);
      const end = ends[i] as number;
      const readings: LiteralMatch[] = [];

      // Countries before cities, which is §6.1's +3 against at most +2 read as
      // ordering rather than as a comparison — those two never tie, so scoring
      // them and sorting would be a longer way to write this line. It is an
      // ordering and no longer a return: "singapore" is a country and a city of
      // the name, and the city is now the runner-up rather than nothing.
      //
      // Two countries of one name *do* tie, at the same flat +3, and this is the
      // one ranking in the file that no weight decides — `spaced` separates them
      // afterwards, off the order sorted into the node. So both Congos are
      // ranked ahead of any city of the name, which is what §6.1 says a country
      // is worth and not an artefact of where the loop puts them.
      if (at.countries !== undefined && (!single || claimable(word, surface, ctx))) {
        for (const { row, weight } of at.countries) {
          readings.push(
            claim(
              {
                geonameId: row.geonameId,
                name: row.name,
                zone: row.zone,
                currency: row.currency,
                lat: row.lat,
                lon: row.lon,
                population: row.population,
                country: row.a2,
              },
              end - offset,
              weight,
            ),
          );
        }
      }

      // Already sorted, at build time, by the weight §6.1 tables — so the other
      // Athens and the other two Springfields arrive behind the winner in the
      // order the spec ranks them, and nothing here re-decides it.
      if (at.cities !== undefined && (!single || cityClaimable(word))) {
        for (const hit of at.cities)
          readings.push(cityClaim(hit, offset, end, hit.weight));
      }

      // Longest match wins, and a refused claim does not fall back to a shorter
      // one. Backtracking would mean "chicago" refused as a city could still be
      // read as some prefix, and a prefix is exactly the reading §5.1 spends
      // MAX_WORDS and the token-boundary rule making impossible.
      if (readings.length === 0) return null;
      return readings.length === 1 ? (readings[0] as LiteralMatch) : spaced(readings);
    }

    return null;
  };
}
