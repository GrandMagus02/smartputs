import type { FuzzyMatch, KindId, Weights } from "../types";

/**
 * Charged once per edit between what was typed and the word it was read as.
 *
 * The magnitude is set by the softmax in `solve/solver.ts`, which turns a
 * difference of scores into odds: at 15 a corrected reading that meets an
 * exact one in the same slot loses by e^15, far enough that the pair never
 * comes within `ambiguityEpsilon` of each other and asks the caller which they
 * meant. The number is half of `CONTEXT_BONUS` rather than a round figure
 * because that is the trade it has to price. A reading corrected by one edit
 * can still be believed when its neighbour agrees on kind — 30 for the
 * agreement against 15 for the slip — and one corrected by two edits, which is
 * as far as the distance function ever looks, exactly cancels that agreement.
 * Two edits and a neighbour that agrees is precisely the point where the
 * engine has stopped reading and started guessing.
 *
 * It never keeps a correction out on its own: with no rival reading the
 * softmax normalises a lone assignment back to 1 whatever it was charged. This
 * decides contests, not admission.
 */
export const TYPO_PENALTY = 15;

export interface WeightArgs {
  kind: KindId;
  unit: string;
  surface: string;
  /**
   * The language that listed the spelling this reading was reached through —
   * `AliasEntry.locale`, or the format locale's id for a reading no alias
   * produced (a literal, a completer's own row). Required rather than
   * optional on purpose: it makes the compiler name every call site, and the
   * one that matters is `toExplanation`'s, where a forgotten field would put
   * `locale:` rows in the score and none in the explanation of it.
   */
  locale: string;
  prior: number;
  layers: (Weights | undefined)[];
  /** Present only for a reading reached by correcting the surface. */
  fuzzy?: FuzzyMatch;
}

export interface WeightContribution {
  selector: string;
  value: number;
  layer: number;
}

/**
 * `locale:` comes last, after the three that name what a reading *is*, because
 * it names where the reading was read from — and because appending keeps the
 * row order of every explanation that existed before it did.
 *
 * It is a whole-vocabulary bias knob and not a same-token tiebreaker, which is
 * narrower than it looks and worth saying out loud. `buildRegistry` tags each
 * alias with the alphabetically first installed language that listed it, so on
 * an `[en, uk]` engine `"kg"` is an `en` reading even though Ukrainian lists it
 * too: `{ "locale:uk": 5 }` moves `"5 кг"` and never `"5 kg"`. What it buys is
 * the ability to prefer, or refuse, the spellings a language uniquely owns.
 *
 * `"*"` is skipped rather than emitted. It is the language-neutral unit-key
 * floor `buildRegistry` writes for a kind no installed language speaks for
 * (ruling R6) — not a language, so no selector can name it, and a `locale:*`
 * row would be an offer to weight something that has no language to weight.
 */
function selectorsFor(args: WeightArgs): string[] {
  return [
    `token:${args.surface}`,
    `${args.kind}:${args.unit}`,
    args.kind,
    ...(args.locale === "*" ? [] : [`locale:${args.locale}`]),
  ];
}

export function weightBreakdown(args: WeightArgs): WeightContribution[] {
  const out: WeightContribution[] = [{ selector: "prior", value: args.prior, layer: 0 }];
  const selectors = selectorsFor(args);

  args.layers.forEach((layer, index) => {
    if (layer === undefined) return;
    for (const selector of selectors) {
      const value = layer[selector];
      if (value !== undefined) out.push({ selector, value, layer: index + 1 });
    }
  });

  // A term, not a multiplier: a corrected reading is scored exactly as the
  // exact one would have been and then charged for the correction, so it has
  // one row more than its exact twin and no other difference. Layer 0 with the
  // prior, because it comes from the engine rather than from anyone's weights.
  if (args.fuzzy !== undefined) {
    out.push({
      selector: `fuzzy:${args.fuzzy.alias}`,
      value: -TYPO_PENALTY * args.fuzzy.distance,
      layer: 0,
    });
  }

  return out;
}

/**
 * The same sum `weightBreakdown` reports, summed without reporting it.
 *
 * It used to be `weightBreakdown(args).reduce(...)`, which is one row object
 * per term plus the array holding them — allocated once per candidate, on the
 * per-keystroke path `createResolver` runs. The rows are what `explain()`
 * wants and what nothing else does. Measured at 221 ns -> 176 ns per call
 * (20%), four representative candidates, 3M iterations, A/B in one process.
 *
 * The terms stay in `weightBreakdown`'s order — prior, then layer by layer and
 * selector by selector, then the fuzzy charge — because float addition is not
 * associative and a reordered sum is a different number. `selectorsFor` is
 * shared rather than restated, so the two cannot disagree about which
 * selectors exist.
 */
export function resolveWeight(args: WeightArgs): number {
  let sum = args.prior;
  const selectors = selectorsFor(args);
  for (const layer of args.layers) {
    if (layer === undefined) continue;
    for (const selector of selectors) {
      const value = layer[selector];
      if (value !== undefined) sum += value;
    }
  }
  if (args.fuzzy !== undefined) sum -= TYPO_PENALTY * args.fuzzy.distance;
  return sum;
}

/**
 * `grammar:<localeId>` — one selector per locale whose number grammar produced
 * this reading, summed over the same layers a unit candidate is scored against.
 *
 * A caller pins a language's digits with `{ "grammar:de": 5 }` the way they pin
 * its words with `{ "locale:de": 5 }`. The engine's own layer carries
 * `grammar:<format>` at 1, which is what keeps a bare "1,000" reading the way
 * the engine's own language reads it rather than as a coin flip between two
 * installed grammars (ruling R-A1, recorded in `engine.ts` where the default is
 * written and in `solver.ts` where the bonus that can overturn it is).
 *
 * One selector per locale and not one per grammar, because a grammar is shared:
 * `en`, `ja` and `hi` all group with "," and point with ".", and a caller who
 * writes `{ "grammar:ja": 5 }` on an engine that also reads English means to
 * lift a *language's* digits. Every locale that reads this way therefore gets a
 * row, and the rows sum — which is also what makes `Σcontributions === score`
 * hold for a number slot.
 */
export function grammarBreakdown(
  locales: readonly string[],
  layers: readonly (Weights | undefined)[],
): WeightContribution[] {
  const out: WeightContribution[] = [];
  layers.forEach((layer, index) => {
    if (layer === undefined) return;
    for (const locale of locales) {
      const value = layer[`grammar:${locale}`];
      if (value !== undefined)
        out.push({ selector: `grammar:${locale}`, value, layer: index + 1 });
    }
  });
  return out;
}

/** `grammarBreakdown`'s sum without its rows, for `resolveWeight`'s reason. */
export function grammarWeight(
  locales: readonly string[],
  layers: readonly (Weights | undefined)[],
): number {
  let sum = 0;
  for (const layer of layers) {
    if (layer === undefined) continue;
    for (const locale of locales) {
      const value = layer[`grammar:${locale}`];
      if (value !== undefined) sum += value;
    }
  }
  return sum;
}
