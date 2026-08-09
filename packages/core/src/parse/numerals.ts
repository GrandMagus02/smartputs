import type { Locale, NumeralMatch, NumeralParser, Weights } from "../types";
import type { Token } from "./lex";

/**
 * Longest cardinal the largest plausible table can express, so the cap bounds
 * the work per token without ever truncating a real number. Five scale groups
 * up to trillions, each "nine hundred and ninety nine" plus its scale word, is
 * 29 words. Rounded up for headroom.
 */
export const MAX_RUN = 32;

interface Run {
  words: string[];
  /** `ends[k]` is the token index just past the k-th word, hyphens included. */
  ends: number[];
}

/**
 * Consecutive `word` tokens from `start`, hopping a hyphen that joins two of
 * them. `normalize()` maps every dash to "-" and the lexer emits that as an op,
 * so "twenty-two" arrives as word/op/word and would otherwise evaluate to 18.
 * Absorbing it only when nothing separates it from the words on either side is
 * what keeps "twenty - two" as subtraction; the spans make that test exact.
 */
function collectRun(tokens: Token[], start: number): Run {
  const words: string[] = [];
  const ends: number[] = [];
  let i = start;
  let prev: Token | undefined;

  while (i < tokens.length && words.length < MAX_RUN) {
    let cursor = i;
    const dash = tokens[cursor];

    if (
      prev !== undefined &&
      dash !== undefined &&
      dash.type === "op" &&
      dash.op === "-"
    ) {
      const after = tokens[cursor + 1];
      if (
        after === undefined ||
        after.type !== "word" ||
        prev.end !== dash.start ||
        dash.end !== after.start
      ) {
        break;
      }
      cursor += 1;
    }

    const token = tokens[cursor];
    if (token === undefined || token.type !== "word") break;

    words.push(token.text);
    i = cursor + 1;
    ends.push(i);
    prev = token;
  }

  return { words, ends };
}

/** One installed language that declares a `numerals` table, ready to be offered a run. */
interface Claimant {
  id: string;
  parse: NumeralParser;
}

/**
 * The `locale:` weight the merged layers put on one language, summed exactly
 * the way `resolveWeight` sums a candidate's selectors: every matching layer
 * contributes, there is no precedence. Spelled out here rather than reused
 * from `solve/weights.ts` because that function scores a *reading* — it wants
 * a kind, a unit, a surface and a prior, none of which exist yet at lexing
 * time. This pass has one selector to look up and no candidate to hang it on.
 *
 * `"*"` never matches a `locale:` selector (ruling R6), and a language cannot
 * be called `"*"` in practice, but the guard is written here so the rule lives
 * in both places that apply it rather than in one.
 */
function localeWeight(id: string, layers: readonly (Weights | undefined)[]): number {
  if (id === "*") return 0;
  let sum = 0;
  for (const layer of layers) {
    const value = layer?.[`locale:${id}`];
    if (value !== undefined) sum += value;
  }
  return sum;
}

/**
 * The installed languages that can claim a run, in the order a tie between
 * them is resolved: the heavier `locale:` weight first, then the id ascending.
 *
 * Sorted once, before any token is read, so the tie-break is a property of the
 * *configuration* and not of the order a `Map` happened to be filled or the
 * order `locales` was written in. `[uk, en]` and `[en, uk]` must fold the same
 * numbers; only a weight may move them.
 */
function claimants(
  locales: readonly Locale[],
  layers: readonly (Weights | undefined)[],
): Claimant[] {
  const found: Array<Claimant & { weight: number }> = [];
  const seen = new Set<string>();
  for (const locale of locales) {
    const parse = locale.language.numerals;
    if (parse === undefined || seen.has(locale.id)) continue;
    seen.add(locale.id);
    found.push({ id: locale.id, parse, weight: localeWeight(locale.id, layers) });
  }
  return found
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .map(({ id, parse }) => ({ id, parse }));
}

/**
 * The strongest claim any installed language makes on `words`: the largest
 * `consumed`, ties going to whichever language sorted first.
 *
 * Longest claim first and preference second, because the two axes answer
 * different questions. A language that reads two words where another reads one
 * has understood more of the input, whatever the reader's language preference
 * is — "twenty two" is 22 and not 20 followed by a stray 2 — so `consumed` is
 * never traded away for a weight. The weight only chooses between languages
 * that understood exactly as much as each other, which is the case where the
 * input genuinely is ambiguous and a preference is the only thing left.
 *
 * `>` and not `>=` against a list already in tie-break order is what makes the
 * second axis work: the first claimant to reach a given length keeps it.
 */
function bestClaim(
  offered: readonly Claimant[],
  words: string[],
  accept: (match: NumeralMatch) => boolean,
): NumeralMatch | null {
  let best: NumeralMatch | null = null;
  for (const claimant of offered) {
    const match = claimant.parse(words);
    if (match === null || !accept(match)) continue;
    if (best === null || match.consumed > best.consumed) best = match;
  }
  return best;
}

/**
 * @param locales Every installed language, or the one a lone caller has. Each
 * is offered the same word run and the longest claim wins — spelled numbers
 * are recognised in every installed language, the way unit aliases are.
 * @param layers The engine-level weight layers, for the tie-break above.
 * Engine-level and not per-call, deliberately: this pass runs inside the
 * shared, frozen `Tokenizer`, which by construction cannot carry per-call
 * state — that is why `Parser` and `Completer` are rebuilt per call and it is
 * not. So `EngineOptions.weights` and a language's own `weights` move a
 * numeral tie and `EvalOptions.weights` does not, which is the same line
 * `EvalOptions.format` already draws around number grammar (I8).
 */
export function foldNumerals(
  tokens: Token[],
  locales: Locale | readonly Locale[],
  layers: readonly (Weights | undefined)[] = [],
): Token[] {
  const offered = claimants(
    Array.isArray(locales) ? locales : [locales as Locale],
    layers,
  );
  // The identical array, not a copy: a caller composing the passes by hand
  // uses this to tell "nothing to do" from "nothing applied", and the pass has
  // nothing to do when no installed language spells numbers at all.
  if (offered.length === 0) return tokens;

  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i] as Token;

    if (token.type === "number") {
      const next = tokens[i + 1];
      if (next !== undefined && next.type === "word") {
        // Only a bare scale word may attach to digits, so "1.5 million" reads
        // as one number while "5 one" stays two adjacent numbers the parser
        // refuses. Identifying the scale word by value rather than by table is
        // what keeps this pass locale-agnostic: no other one-word cardinal
        // reaches 100.
        //
        // The gate is inside the claim rather than after it because a language
        // reading "gaz" as 5 must not shut out one reading it as a thousand:
        // every claim here is one word long, so the gate is the only thing
        // that distinguishes them and applying it late would let the loser win
        // the tie and then fail.
        const match = bestClaim(
          offered,
          [next.text],
          (m) => m.consumed === 1 && m.value.gte(100),
        );
        if (match !== null) {
          out.push({
            type: "number",
            value: token.value.times(match.value),
            text: `${token.text} ${next.text}`,
            start: token.start,
            end: next.end,
          });
          i += 2;
          continue;
        }
      }
      out.push(token);
      i += 1;
      continue;
    }

    if (token.type === "word") {
      // Collected once and offered to every language: the run is a property of
      // the token stream — consecutive words, hyphens absorbed — and nothing
      // in it is language-specific, so N languages cost N table lookups and
      // not N scans.
      const run = collectRun(tokens, i);
      const match =
        run.words.length === 0
          ? null
          : bestClaim(
              offered,
              run.words,
              (m) => m.consumed > 0 && m.consumed <= run.words.length,
            );
      if (match !== null) {
        const end = run.ends[match.consumed - 1] as number;
        const last = tokens[end - 1] as Token;
        out.push({
          type: "number",
          value: match.value,
          // Informational only — `explain()` reads it, the parser reads `value`.
          // This is a normalized rendering of the claimed words, not a slice of
          // the source: for "twenty-two km" it reads "twenty two", not "twenty-two",
          // because the pass never sees the input, only the token words it joins
          // with a single space. The span above is the authoritative source
          // range; a consumer that needs the exact substring must use it, not `text`.
          text: run.words.slice(0, match.consumed).join(" "),
          start: token.start,
          end: last.end,
        });
        i = end;
        continue;
      }
    }

    out.push(token);
    i += 1;
  }

  return out;
}
