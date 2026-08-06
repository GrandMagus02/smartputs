import type { Registry } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { resolveWeight } from "../solve/weights";
import type { Candidate, KindId, Locale, LocalePack, Weights } from "../types";
import { EDIT_HEADROOM, editDistance, nearestWord } from "./distance";

export interface Resolver {
  resolve(surface: string): Candidate[];
  literal(m: { kind: KindId; unit: string; surface: string; weight: number }): Candidate;
  nearest(surface: string): string[];
}

/**
 * Two edits from what was typed, which is as far as a suggestion is worth
 * making: past that the hint names a word the writer never had in mind. The
 * headroom is what keeps the weighted slips — each of which costs a little
 * over 1 — from reading as one more edit than they are.
 */
const NEAREST_LIMIT = 2 + EDIT_HEADROOM;

/**
 * The shortest surface worth correcting. Below it the index is a symbol table,
 * and symbols sit on top of one another: "kg", "km", "mg", "kt", "gb", "kb"
 * and "k" are all within an edit or two of "kgg", and the distance function
 * will happily name the nearest of them. Naming it is not reading it — the
 * writer meant one thing and the answer that comes back is a number in some
 * other dimension, which is the failure the whole correction path is supposed
 * to avoid. Five is where the index stops being symbols and starts being
 * words: every spelled-out unit name in it is at least that long, and no
 * symbol is. Nothing is lost by refusing — the surface still reaches
 * `NoCandidateError` with `nearest` naming the same words as a hint, where the
 * writer can see them and choose.
 */
const SHORTEST_CORRECTABLE = 5;

/**
 * One slip, where the hint above allows two, and the asymmetry is the point: a
 * suggestion is read by a person who can see the word they typed beside the
 * word offered and say no. A reading is read by nobody. Two edits is where
 * "mobile" becomes "mile" and "10 mobile" quietly answers 16,093.44 metres —
 * a city turned into a unit, with a number to show for it. One edit is a
 * typo; two edits is usually a different word, and the ones it is not are not
 * worth what the ones it is would cost. The headroom is the same correction
 * the hint makes, for the same reason.
 */
const CORRECTABLE_SLIPS = 1 + EDIT_HEADROOM;

export function createResolver(args: {
  registry: Registry;
  locale: Locale;
  packs: LocalePack[];
  layers: (Weights | undefined)[];
}): Resolver {
  const analyze = createAnalyzerChain(args.locale, args.packs);
  const fold = (s: string) => s.toLocaleLowerCase(args.locale.id);

  /**
   * The readings a surface reaches by being corrected — at most one alias
   * worth of them, since a correction that has to choose is not a correction.
   * Each one is weighted exactly as the exact reading would have been, and
   * then charged for the correction: `resolveWeight` sums the fuzzy term with
   * the prior and every layer, so a mistyped word is still subject to
   * `weights: { "length:m": 10 }` the way a well-typed one is.
   */
  const corrections = (surface: string, foldedSurface: string): Candidate[] => {
    if (foldedSurface.length < SHORTEST_CORRECTABLE) return [];

    // null is a refusal rather than an absence: two words equally near are a
    // coin toss, and the caller's NoCandidateError names them both instead.
    const alias = nearestWord(foldedSurface, args.registry.aliasIndex.keys());
    if (alias === null) return [];

    const distance = editDistance(foldedSurface, alias);
    if (distance > CORRECTABLE_SLIPS) return [];

    const fuzzy = { alias, distance };
    const out: Candidate[] = [];
    for (const entry of args.registry.aliasIndex.get(alias) ?? []) {
      const kind = args.registry.kinds.get(entry.kind);
      if (kind === undefined) continue;
      out.push({
        kind: entry.kind,
        unit: entry.unit,
        weight: resolveWeight({
          kind: entry.kind,
          unit: entry.unit,
          surface: foldedSurface,
          prior: kind.prior,
          layers: args.layers,
          fuzzy,
        }),
        surface,
        foldedSurface,
        // The corrected word is the form this reading was reached through, in
        // the same sense a stem is.
        form: alias,
        analyzerWeight: 0,
        fuzzy,
      });
    }
    return out;
  };

  return {
    resolve(surface) {
      const found = new Map<string, Candidate>();
      const foldedSurface = fold(surface);

      for (const analyzed of analyze(surface)) {
        const entries = args.registry.aliasIndex.get(fold(analyzed.form));
        if (entries === undefined) continue;

        for (const entry of entries) {
          const kind = args.registry.kinds.get(entry.kind);
          if (kind === undefined) continue;

          // Additive, not substitutive: the analyzer's penalty/boost sums with
          // the prior and every matching weight layer.
          const analyzerWeight = analyzed.weight ?? 0;
          const weight =
            resolveWeight({
              kind: entry.kind,
              unit: entry.unit,
              surface: foldedSurface,
              prior: kind.prior,
              layers: args.layers,
            }) + analyzerWeight;

          const key = `${entry.kind}:${entry.unit}`;
          const existing = found.get(key);
          if (existing === undefined || weight > existing.weight) {
            found.set(key, {
              kind: entry.kind,
              unit: entry.unit,
              weight,
              surface,
              foldedSurface,
              form: analyzed.form,
              analyzerWeight,
            });
          }
        }
      }

      // Only once the exact pass has come back with nothing at all. A typo is
      // the last reading tried, never one among several: if any analyzed form
      // named a real alias, that is what was written, and a near miss on some
      // other word is not evidence against it. This is also what keeps the
      // fuzzy scan — the whole alias index, per unknown word — off the path
      // every well-spelled input takes.
      if (found.size === 0) {
        for (const c of corrections(surface, foldedSurface)) {
          found.set(`${c.kind}:${c.unit}`, c);
        }
      }

      return [...found.values()].sort(
        (a, b) =>
          b.weight - a.weight ||
          a.kind.localeCompare(b.kind) ||
          a.unit.localeCompare(b.unit),
      );
    },

    // A literal never went through the analyzer chain — its matcher already
    // decided what the text means — but it must still be weighted by all four
    // layers, or `weights: { datetime: 40 }` would silently not apply to a date.
    literal(m) {
      const foldedSurface = fold(m.surface);
      return {
        kind: m.kind,
        unit: m.unit,
        weight:
          resolveWeight({
            kind: m.kind,
            unit: m.unit,
            surface: foldedSurface,
            prior: args.registry.kinds.get(m.kind)?.prior ?? 0,
            layers: args.layers,
          }) + m.weight,
        surface: m.surface,
        foldedSurface,
        form: m.surface,
        analyzerWeight: m.weight,
      };
    },

    // A hint, not a reading: the three nearest aliases that are not the word
    // itself. `d > 0` is what drops the exact match — a surface that resolved
    // never reaches here, but one that resolved for another kind can.
    nearest(surface) {
      const target = fold(surface);
      return [...args.registry.aliasIndex.keys()]
        .map((alias) => ({ alias, d: editDistance(target, alias, NEAREST_LIMIT) }))
        .filter((x) => x.d > 0 && x.d <= NEAREST_LIMIT)
        .sort((a, b) => a.d - b.d || a.alias.localeCompare(b.alias))
        .slice(0, 3)
        .map((x) => x.alias);
    },
  };
}
