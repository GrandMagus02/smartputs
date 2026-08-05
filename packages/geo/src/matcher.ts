import {
  Decimal,
  type LiteralMatcher,
  type MatchCtx,
  type PlaceMeta,
} from "@smartput/core";
import type { CountryRow } from "./types";

const PLACE_KIND = "place";

/**
 * Spec §5.1. The generator emits no alias longer than this, so the bound is not
 * a filter on the data: it is what stops the walk from reading a whole sentence
 * looking for a fifth word that can never complete a name.
 */
const MAX_WORDS = 4;

/** Spec §6.1. Cities arrive in M6.2 with population-scaled weights. */
const COUNTRY_WEIGHT = 3;

/**
 * Below this, a single-word alias is an ISO code rather than a name — see
 * `claimable`. Exported because the kind draws the same line: a name is safe to
 * put in the global alias index and a code is not.
 */
export const MIN_NAME_LENGTH = 4;

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

interface PlaceHit {
  readonly row: CountryRow;
  /** Spec §6.1's table lives on the node, so M6.2 adds rows and not a branch. */
  readonly weight: number;
}

interface TrieNode {
  /**
   * Keyed on one lowercased word, which is what a name-shaped alias index has to
   * be: core's own alias index is keyed on a single segmented word and that is
   * exactly why "new zealand" cannot be an alias (spec §5.1).
   *
   * M6.2's `paris texas` is another edge on this same map — a scoped match is a
   * walk, not an operation (spec §5.2) — so admin1 and country children need no
   * new structure here.
   */
  readonly next: Map<string, TrieNode>;
  hit?: PlaceHit;
}

function buildTrie(rows: readonly CountryRow[]): TrieNode {
  const root: TrieNode = { next: new Map() };

  for (const row of rows) {
    for (const alias of row.aliases) {
      const words = alias.split(" ");
      if (words.length > MAX_WORDS || words.some((w) => w.length === 0)) continue;

      let node = root;
      for (const word of words) {
        let next = node.next.get(word);
        if (next === undefined) {
          next = { next: new Map() };
          node.next.set(word, next);
        }
        node = next;
      }

      // "congo" is both Congos and "soudan" is both Mali and Sudan. §6.1 ranks
      // by population everywhere else it has a choice, so it ranks here too;
      // the runner-up is suggest()'s to surface once M6.2 gives it one.
      if (node.hit === undefined || node.hit.row.population < row.population) {
        node.hit = { row, weight: COUNTRY_WEIGHT };
      }
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
 * The one matcher this kind registers for names (spec §5.1). Longest match
 * wins, and a match is always a whole number of words, which is what makes
 * "newark" impossible to read as "new" — the fold's token-boundary check is a
 * second net, not the first one.
 */
export function createPlaceLiteral(rows: readonly CountryRow[]): LiteralMatcher {
  const root = buildTrie(rows);

  return (input, offset, ctx) => {
    const { words, ends } = scan(input, offset);

    let node = root;
    let best: { hit: PlaceHit; end: number; words: number } | null = null;

    for (let i = 0; i < words.length; i += 1) {
      const next = node.next.get(words[i] as string);
      if (next === undefined) break;
      node = next;
      if (node.hit !== undefined) {
        best = { hit: node.hit, end: ends[i] as number, words: i + 1 };
      }
    }

    if (best === null) return null;
    // Only a one-word claim can be another kind's token: two words in a row are
    // nobody's unit and nobody's keyword.
    if (best.words === 1) {
      const surface = input.slice(offset, ends[0] as number);
      if (!claimable(words[0] as string, surface, ctx)) return null;
    }

    const { row } = best.hit;
    return {
      kind: PLACE_KIND,
      unit: row.a2,
      canonical: new Decimal(row.geonameId),
      meta: Object.freeze({
        geonameId: row.geonameId,
        zone: row.zone,
        currency: row.currency,
        lat: row.lat,
        lon: row.lon,
        population: row.population,
        country: row.a2,
      } satisfies PlaceMeta),
      length: best.end - offset,
      weight: best.hit.weight,
      // A place is a conversion target: it is the right operand of
      // "japan to ukraine", "3pm in japan" and "100 usd in japan", and all
      // three signatures read the `meta` above. Opting in is what carries this
      // Value to `apply` instead of core's meta-less stand-in.
      targetable: true,
    };
  };
}
