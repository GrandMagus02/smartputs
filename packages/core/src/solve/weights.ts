import type { KindId, Weights } from "../types";

export interface WeightArgs {
  kind: KindId;
  unit: string;
  surface: string;
  prior: number;
  layers: (Weights | undefined)[];
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

  return out;
}

export function resolveWeight(args: WeightArgs): number {
  return weightBreakdown(args).reduce((sum, c) => sum + c.value, 0);
}
