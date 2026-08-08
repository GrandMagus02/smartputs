import type { Registry } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { resolveWeight } from "../solve/weights";
import type { AnalyzedForm, Candidate, KindId, Locale, Weights } from "../types";
import { EDIT_HEADROOM, editDistance, nearestWord } from "./distance";

export interface Resolver {
  resolve(surface: string): Candidate[];
  /**
   * The readings of `surface` that a bare unit word may stand for, which is
   * `resolve` minus every kind that cannot carry a count.
   *
   * An opaque kind's units are labels, not scales: `place`'s are country codes
   * and `datetime`'s are zone names, and "one UA" is not a quantity of
   * anything. A ratio kind's units are exactly the ones where an implied count
   * means something, which is why this filter is `spec.mode` and not a list.
   */
  countable(surface: string): Candidate[];
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
  /**
   * Every installed locale. Recognition is many-locale: a reading is offered
   * if *any* installed language can reach it.
   */
  locales: readonly Locale[];
  /**
   * The one locale generation speaks. Nothing about which readings exist
   * depends on it; it decides only the two things that are not recognition —
   * the case fold below, and the language a `literal` is attributed to.
   *
   * Segmentation and number grammar are the format locale's too, for the same
   * reason (design decisions I8 and §5.3), but they happen upstream in the
   * tokenizer and never reach here: by the time a surface arrives, the run of
   * text has already been cut and the digits already read.
   */
  format: Locale;
  layers: (Weights | undefined)[];
}): Resolver {
  /**
   * One analyzer chain per installed language, keyed by locale id, and the
   * whole of what "recognition is many-locale" means. `resolve` unions what
   * every chain produces, so a Ukrainian inflection reaches the Ukrainian
   * vocabulary that lists its stem even when the engine prints English —
   * without this, a two-locale engine reads Ukrainian words as English typos
   * at a -15 penalty, or not at all.
   *
   * The format locale is seeded first so that when two chains produce forms of
   * equal weight for one reading, the language the engine speaks is the one
   * whose form is kept. Chains memoize per surface and each cache is a closure
   * variable of its own chain, so the language is part of the cache key by
   * construction and the caches cannot collide. Cost is O(languages) chain
   * invocations per distinct word, each memoized.
   */
  const analyzers = new Map<string, (surface: string) => AnalyzedForm[]>();
  for (const locale of [args.format, ...args.locales]) {
    if (!analyzers.has(locale.id))
      analyzers.set(locale.id, createAnalyzerChain(locale.language));
  }

  /**
   * One fold for every language, under the format locale's id, and it is a
   * decision rather than an oversight. The registry folds each alias under its
   * *own* contributing language (`registry.ts`'s `toLocaleLowerCase(localeId)`),
   * so a query folded under a different language's rules could in principle
   * miss a key that language wrote — a silent total non-recognition, no error
   * and no candidate.
   *
   * It cannot happen for the languages that exist. Folding all 780 keys of the
   * built-in en+uk index under both ids gives zero differences: Cyrillic case
   * mapping is language-neutral and Ukrainian has no tailoring. Only Turkish,
   * Azeri, Lithuanian and Greek tailor the fold at all — `"I"` lowercases to
   * `"ı"` under `tr` and to `"i"` under everything else. That single input is
   * the one that distinguishes the two designs, and installing any of those
   * four languages is the trigger to revisit this: `fold` would have to become
   * per-entry, matched against the id the registry used to write each key, and
   * a lookup per installed language instead of one. Folding N times today
   * would buy nothing and cost a real behaviour change — it would let a
   * tr-folded query reach an en-folded key.
   */
  const fold = (s: string) => s.toLocaleLowerCase(args.format.id);

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
        // The language of the entry corrected *to*, not of the misspelling:
        // the reading is the one that language listed, and it is that reading
        // a `locale:` weight has to be able to prefer or refuse.
        locale: entry.locale,
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

  const resolver: Resolver = {
    resolve(surface) {
      const found = new Map<string, Candidate>();
      const foldedSurface = fold(surface);

      // Every installed language's forms, in one flat pass over one shared
      // index. Which chain produced a form is deliberately not recorded: the
      // language of a reading is the language that *listed the alias*, which
      // the entry already knows. A Ukrainian stemmer that happens to reach an
      // English alias has found an English reading, not a Ukrainian one.
      for (const analyze of analyzers.values()) {
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

            // Locale is part of a reading's identity, not a label on it. Two
            // languages spelling one unit differently — reached here as two
            // index keys carrying two differently tagged entries — are two
            // candidates, because a `locale:` weight has to be able to rank
            // one above the other, and a key of kind:unit alone would have
            // thrown one away before the solver ever saw it. Within one
            // locale the max-weight rule still holds, which is how an exact
            // form beats the same word's stem.
            const key = `${entry.kind}:${entry.unit}:${entry.locale}`;
            const existing = found.get(key);
            if (existing === undefined || weight > existing.weight) {
              found.set(key, {
                kind: entry.kind,
                unit: entry.unit,
                locale: entry.locale,
                weight,
                surface,
                foldedSurface,
                form: analyzed.form,
                analyzerWeight,
              });
            }
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
          found.set(`${c.kind}:${c.unit}:${c.locale}`, c);
        }
      }

      // `locale` joins the tiebreak because it joined the key: without it two
      // candidates can now agree on weight, kind and unit, and the order they
      // come back in would be the order the chains happened to run.
      return [...found.values()].sort(
        (a, b) =>
          b.weight - a.weight ||
          a.kind.localeCompare(b.kind) ||
          a.unit.localeCompare(b.unit) ||
          a.locale.localeCompare(b.locale),
      );
    },

    // Deliberately built on `resolve` rather than beside it, so a bare unit
    // word is scored by the same four layers, the same analyzer chain and the
    // same correction pass as a word with a number in front of it. The only
    // difference between "km" and "3 km" should be the count.
    countable(surface) {
      return resolver
        .resolve(surface)
        .filter((c) => args.registry.kinds.get(c.kind)?.spec.mode === "ratio");
    },

    // A literal never went through the analyzer chain — its matcher already
    // decided what the text means — but it must still be weighted by all four
    // layers, or `weights: { datetime: 40 }` would silently not apply to a date.
    literal(m) {
      const foldedSurface = fold(m.surface);
      return {
        kind: m.kind,
        unit: m.unit,
        // There is no `AliasEntry` to copy from — the matcher decided the
        // meaning before the alias index was consulted — so the reading is
        // attributed to the language the engine speaks. That is the only
        // language a literal can be said to belong to: `2026-08-07` and
        // `#ff0000` are spelled the same in all of them.
        locale: args.format.id,
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

  return resolver;
}
