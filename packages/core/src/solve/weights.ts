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

function selectorsFor(args: WeightArgs): string[] {
  return [`token:${args.surface}`, `${args.kind}:${args.unit}`, args.kind];
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

export function resolveWeight(args: WeightArgs): number {
  return weightBreakdown(args).reduce((sum, c) => sum + c.value, 0);
}
