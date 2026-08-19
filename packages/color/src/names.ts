import type { LiteralMatch, LiteralMatcher } from "@smartput/kind";
import type { Color } from "@urcolor/core";
import {
  type BaseMatch,
  colorClaim,
  DEFAULT_KEYWORD_WEIGHT,
  DEFAULT_SYNTAX_WEIGHT,
} from "./matcher";

/**
 * A colour-naming dataset, as this package needs it.
 *
 * `@urcolor/i18n`'s `ColorNames` satisfies it structurally, and that is the
 * whole of the coupling: nothing in this file imports that package, so a
 * consumer who wants CSS syntax and no datasets links none of it. The shape is
 * the contract — the same rule that keeps the kind packages from importing each
 * other — and it means a caller can hand in a table of their own brand's names
 * without wrapping it in anything.
 *
 * `@smartput/color/i18n` is the door that builds one from `@urcolor/i18n`.
 */
export interface ColorNameLookup {
  /** This dataset's name for a colour, or `undefined` when it has none. */
  of(color: Color): string | undefined;
  /** The representative colour for a term, or `undefined` when unknown. */
  colorOf(term: string): Color | undefined;
  /** BCP-47, so a formatter can pick the dataset that matches the engine's locale. */
  resolvedOptions(): { locale: string };
}

/**
 * How many words a claimed term may span.
 *
 * Three covers "very light blue" and "dark slate gray" and stops well short of
 * a sentence. The cost of raising it is not lookup time but destruction: a
 * multi-word claim replaces every token it covers and leaves no `fallback`, so
 * a matcher that reached for six words could eat a clause.
 */
export const MAX_TERM_WORDS = 3;

/**
 * A multi-word term scores what unambiguous CSS syntax scores, and a
 * single-word one scores what a bare CSS keyword does.
 *
 * The asymmetry is the ambiguity, not the dataset: "blue" is a word people
 * write about moods and Mondays, while nobody types "sky blue" by accident.
 * The single-word claim also keeps the word's ordinary reading beside it, so
 * weighting it down costs nothing that was not already recoverable; the
 * multi-word claim does not, which is the other half of why it has to be worth
 * more before it is made at all.
 */
export const DEFAULT_TERM_WEIGHT = DEFAULT_KEYWORD_WEIGHT;
export const DEFAULT_PHRASE_WEIGHT = DEFAULT_SYNTAX_WEIGHT;

export interface NameLiteralOptions {
  /** Summed into a one-word claim ("blue"). */
  termWeight?: number;
  /** Summed into a claim spanning two or three words ("sky blue"). */
  phraseWeight?: number;
}

/**
 * The run of `count` words starting at `offset`, with the exact source text
 * between them, or `null` when the input runs out first.
 *
 * Sliced from the source rather than joined from a split, so the returned
 * length is a real offset into `input` and a claim built from it lands on a
 * token boundary — two spaces between words, or a newline, would make a joined
 * string the wrong length.
 */
const LETTER = /[\p{L}\p{M}]/u;

function wordRun(input: string, offset: number, count: number): string | null {
  let i = offset;
  let end = offset;
  for (let word = 0; word < count; word += 1) {
    if (word > 0) {
      let gap = i;
      while (gap < input.length && (input[gap] === " " || input[gap] === "\t")) gap += 1;
      if (gap === i) return null;
      i = gap;
    }
    const start = i;
    while (i < input.length && LETTER.test(input[i] as string)) i += 1;
    if (i === start) return null;
    end = i;
  }
  return input.slice(offset, end);
}

/**
 * Colour terms in every language a dataset was loaded for.
 *
 * Longest first and every dataset asked, because the fold keeps whichever
 * readings reach the furthest end and hands all of them to the solver: two
 * datasets that both know "blue" are two candidates, which is what lets the
 * solver be told to prefer one rather than making that choice here.
 */
export function createNameLiteral(
  lookups: readonly ColorNameLookup[],
  opts: NameLiteralOptions = {},
): LiteralMatcher {
  const termWeight = opts.termWeight ?? DEFAULT_TERM_WEIGHT;
  const phraseWeight = opts.phraseWeight ?? DEFAULT_PHRASE_WEIGHT;

  return (input, offset, ctx) => {
    const claims: LiteralMatch[] = [];
    for (let count = MAX_TERM_WORDS; count >= 1; count -= 1) {
      const run = wordRun(input, offset, count);
      if (run === null) continue;
      const term = run.toLowerCase();
      // Ruling R4 again: a word an installed vocabulary spells as a unit is
      // that unit's. It can only bite on a one-word term — "lab" is a colour
      // space here and a colour term nowhere — but the guard is cheap and the
      // rule is the registry's, not this matcher's.
      if (count === 1 && ctx.isUnitAlias(term)) continue;
      for (const lookup of lookups) {
        const color = lookup.colorOf(term);
        if (color === undefined) continue;
        claims.push(
          colorClaim(color, run.length, count === 1 ? termWeight : phraseWeight),
        );
      }
    }
    return claims.length === 0 ? null : claims;
  };
}

/**
 * The longest term at `offset` that some dataset knows, as a `BaseMatch`.
 *
 * The reader half of {@link createNameLiteral}, for `expression.ts`: the
 * matcher makes a claim and stops, while a phrase needs the end offset so it
 * can keep reading. Only the first dataset that answers is reported, because a
 * base is a position in a phrase rather than a reading to be ranked — the
 * ambiguity between two datasets is real and is settled by the literal, which
 * offers the solver all of them.
 */
export function readTerm(
  lookups: readonly ColorNameLookup[],
  input: string,
  offset: number,
  isUnitAlias: (text: string) => boolean,
): BaseMatch | null {
  for (let count = MAX_TERM_WORDS; count >= 1; count -= 1) {
    const run = wordRun(input, offset, count);
    if (run === null) continue;
    const term = run.toLowerCase();
    if (count === 1 && isUnitAlias(term)) continue;
    for (const lookup of lookups) {
      const color = lookup.colorOf(term);
      if (color === undefined) continue;
      return {
        color,
        unit: "hex",
        end: offset + run.length,
        weight: count === 1 ? DEFAULT_TERM_WEIGHT : DEFAULT_PHRASE_WEIGHT,
      };
    }
  }
  return null;
}

/**
 * The dataset that answers for `locale`, or the first one loaded.
 *
 * An engine formatting in English with only a Korean dataset installed still
 * gets a name — the caller loaded exactly one dataset and meant it — rather
 * than falling through to a hex string that says nothing about why.
 */
export function lookupFor(
  lookups: readonly ColorNameLookup[],
  locale: string,
): ColorNameLookup | undefined {
  const tag = locale.toLowerCase();
  const exact = lookups.find((l) => l.resolvedOptions().locale.toLowerCase() === tag);
  if (exact !== undefined) return exact;
  const base = tag.split("-")[0];
  return (
    lookups.find(
      (l) => l.resolvedOptions().locale.toLowerCase().split("-")[0] === base,
    ) ?? lookups[0]
  );
}
