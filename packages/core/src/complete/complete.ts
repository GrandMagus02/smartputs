import type { Registry } from "../kind/registry";
import { editDistance, nearestWord } from "../parse/distance";
import { resolveWeight } from "../solve/weights";
import type { CompleteCtx, KindId, Locale, Span, Weights } from "../types";
import { leadingCount, trailingFragment } from "./fragment";
import { prefixQuality, scaleFit, TYPO_PENALTY } from "./score";

export interface Completion {
  /** The alias that matched, e.g. "hour". */
  alias: string;
  /** The fragment this replaces, as offsets into the original input. */
  span: Span;
  /** The whole input rewritten, ready to put back in the box. */
  text: string;
  kind: KindId;
  /** Registry unit key, e.g. "h". */
  unit: string;
  score: number;
}

export interface CompleteOptions {
  /** Hard filter, identical in meaning to EvalOptions.kinds. */
  kinds?: KindId[];
  /** Per-call weight layer 4, identical to EvalOptions.weights. */
  weights?: Weights;
  /** Applied after ranking. Default 10. */
  limit?: number;
}

const DEFAULT_LIMIT = 10;

/**
 * The one alias `fragment` is a near-miss of, or null when there is none or
 * when two are equally near — `nearestWord`'s refusal, which is worth as much
 * here as it is in the parser: a completion list is read at a glance, and an
 * offer chosen by coin toss is read as an answer.
 *
 * The parameter is the alias index itself rather than the `Iterable<string>`
 * `nearestWord` would take, and that narrowing is the perf gate written down
 * where it binds. `nearestWord` walks its whole vocabulary and measures every
 * entry: affordable over the two hundred-odd aliases core registers, and not
 * affordable over the several thousand names a kind like @smartput/city hangs
 * off `completions` — on every keystroke, for a fragment that by definition
 * just matched nothing. A signature that accepted any vocabulary would make
 * feeding it that one a one-line change nobody would think to question.
 *
 * How far it looks is `nearestWord`'s own tolerance and not a second knob here.
 * The parser needs one because it reads a correction silently and a wrong read
 * comes back as a number; a completion is an offer the writer can see beside
 * the word they typed, so the worst a distant one costs is a row in a list
 * that would otherwise have been empty.
 */
function nearestAlias(
  aliasIndex: Registry["aliasIndex"],
  fragment: string,
): { alias: string; distance: number } | null {
  const alias = nearestWord(fragment, aliasIndex.keys());
  if (alias === null) return null;
  return { alias, distance: editDistance(fragment, alias) };
}

export function complete(args: {
  registry: Registry;
  locale: Locale;
  layers: (Weights | undefined)[];
  input: string;
  opts?: CompleteOptions;
}): Completion[] {
  const { registry, locale, layers, input, opts } = args;

  const fragment = trailingFragment(input);
  if (fragment === null) return [];

  const folded = fragment.text.normalize("NFKC").toLocaleLowerCase(locale.id);
  const count = leadingCount(input, fragment.span.start, locale) ?? undefined;
  const category = new Intl.PluralRules(locale.id).select(
    count === undefined ? 1 : count.toNumber(),
  );

  // Best row per (kind, unit): "mi" and "mile" are the same unit, and offering
  // both would fill the list with near-duplicates. Mirrors resolve(). A
  // completer's rows key on `key ?? unit` in the same map, so a kind that hangs
  // many rows off one unit keeps them and one that does not behaves as before.
  const best = new Map<string, Completion>();

  /**
   * Every reading of one alias of the global index, offered. `typo` is how far
   * the alias is from what was actually typed — 0 for the prefix pass, which
   * is the only caller that has a prefix to measure.
   */
  const offer = (alias: string, typo: number) => {
    for (const entry of registry.aliasIndex.get(alias) ?? []) {
      if (opts?.kinds !== undefined && !opts.kinds.includes(entry.kind)) continue;

      const kind = registry.kinds.get(entry.kind);
      if (kind === undefined) continue;
      // Completion inserts "<number><unit>", which a time zone is not. Date
      // completion has its own shape and is out of M4's scope (ruling R8).
      if (kind.spec.mode !== "ratio") continue;
      const unit = kind.units.get(entry.unit);
      if (unit === undefined) continue;

      const score =
        resolveWeight({
          kind: entry.kind,
          unit: entry.unit,
          surface: alias,
          prior: kind.prior,
          layers,
        }) +
        // `prefixQuality` counts the characters of the alias not typed yet,
        // and a corrected alias is not one the fragment prefixes — had it been,
        // the pass above would have found it and this one never run. So there
        // is nothing to count, and it is withheld for the same reason the
        // completer path withholds it from a row matched by some other route.
        // The correction rides in as the term below instead.
        (typo === 0 ? prefixQuality(alias, folded) : 0) +
        scaleFit(count, unit.lexeme.typical) -
        TYPO_PENALTY * typo;

      const word = unit.lexeme.display?.[category] ?? alias;
      const key = `${entry.kind}:${entry.unit}`;
      const existing = best.get(key);

      // Strictly greater, and alias ascending on a tie, so two aliases of equal
      // length (millimetre / millimeter) resolve the same way on every run.
      if (
        existing === undefined ||
        score > existing.score ||
        (score === existing.score && alias < existing.alias)
      ) {
        best.set(key, {
          alias,
          span: fragment.span,
          text:
            input.slice(0, fragment.span.start) + word + input.slice(fragment.span.end),
          kind: entry.kind,
          unit: entry.unit,
          score,
        });
      }
    }
  };

  for (const alias of registry.aliasIndex.keys()) {
    if (alias.startsWith(folded)) offer(alias, 0);
  }

  // The typo fallback, and it sits here — after the prefix pass, before any
  // kind is asked anything — for two reasons that are really one. It runs only
  // when the prefix pass came back with nothing, so a misspelling can never
  // push aside a word the writer actually started typing; and it runs once, on
  // the fragment, over `registry.aliasIndex` and nothing else, so the scan it
  // costs is bounded by what core registers rather than by what some kind
  // happens to know. `offer` then treats the corrected alias exactly as the
  // prefix pass treats an exact one — same filters, same weights, same map.
  if (best.size === 0) {
    const correction = nearestAlias(registry.aliasIndex, folded);
    if (correction !== null) offer(correction.alias, correction.distance);
  }

  // The second source. Not a replacement for the loop above and not a way
  // around its filter: a time zone is still not "<number><unit>", so R8 stands
  // for every kind that has not opted in. What this adds is the kind that can
  // only answer for itself — @smartput/geo's cities are not in the alias index
  // at all, by M6.2's ruling, so lifting the filter would still have completed
  // no city. Rows land in the same map, are scored by the same weights and are
  // cut by the same limit, because a completion the user sees is one list.
  // Frozen because this is the first context core hands to more than one plugin
  // from one object — `EvalCtx` is rebuilt per Value, so nothing there can leak
  // sideways. Every field is `readonly`, and a kind that reached past that and
  // rewrote `fragment` would be answering the next kind's question. The freeze
  // makes the write throw where it happens. Rebuilding the ctx per kind was the
  // alternative: it also contains the damage, but it hides the same bug behind
  // an allocation on the keystroke path rather than reporting it.
  const ctx: CompleteCtx = Object.freeze({
    locale: locale.id,
    fragment: folded,
    input,
    span: fragment.span,
    ...(count !== undefined ? { count } : {}),
  });

  for (const [kindId, kind] of registry.kinds) {
    if (kind.completions === undefined) continue;
    // Filtered before the call, not after: a completer over a large gazetteer
    // is the expensive thing on the keystroke path, and a kind the caller has
    // excluded has nothing to say.
    if (opts?.kinds !== undefined && !opts.kinds.includes(kindId)) continue;

    // One row per distinct insertion, within this kind. A completion IS its
    // `text` — the whole input rewritten — so two rows carrying the same string
    // are the same offer however different the things behind them are, and a
    // list showing it twice spends a slot saying nothing. Ukraine has two places
    // called Kyivskyi, so "kyi" offered "Kyiv, Kyivskyi, Kyivskyi".
    //
    // Only completer rows, and only within one kind. The alias path needs the
    // opposite: `temperature:k` and `tempdelta:k` both render "10 k" and are
    // genuinely two units, so collapsing them drops one out of the list and out
    // of the roundtrip property with it. And a completer is also called directly
    // by pickers, which do want every distinct place — which is why this is here
    // and not in the kind.
    const shown = new Map<string, string>();

    for (const row of kind.completions(ctx)) {
      // `unit` is the one field of a completer's row the engine has to be able
      // to trust: it is a registry key, and a caller who re-evaluates `text`
      // under `kind` — which the roundtrip property does — gets an unreadable
      // failure from a row that names nothing. Dropped rather than thrown, the
      // same way the alias path drops an entry whose unit has gone.
      if (!kind.units.has(row.unit)) continue;

      // A row may reach back over the words before the fragment — "san fran" is
      // one name — but only backwards, and only to somewhere that exists. An
      // out-of-range `start` would splice a completion into the middle of a
      // character or duplicate the text it was meant to replace, so it is
      // dropped for the same reason an unregistered unit is: the failure would
      // surface far from its cause, as a completion that does not re-evaluate.
      const from = row.start ?? fragment.span.start;
      if (!Number.isInteger(from) || from < 0 || from > fragment.span.start) continue;

      // What the user actually typed of this row's alias, which is the fragment
      // only when the row replaces the fragment alone. A look-back row is scored
      // against the whole of it: measuring "new york city" against "yor" finds
      // no prefix and scores 0, and so does "new york van java" — a real
      // GeoNames alias of Jakarta — so the two tied and the tiebreak fell
      // through to the country code, offering Jakarta above New York for
      // "new yor".
      const typed =
        from === fragment.span.start
          ? folded
          : input
              .slice(from, fragment.span.end)
              .normalize("NFKC")
              .toLocaleLowerCase(locale.id)
              .replace(/\s+/g, " ");

      // Three summands where the alias path has four. `scaleFit` is the missing
      // one: it reads the `typical` band off a ratio unit, meaning the magnitude
      // people type that unit in, and a place has none — "10 Kyiv" is not a
      // quantity of Kyiv. A completer that does want the count to matter has it
      // on `ctx` and can fold it into `weight`, where it is the kind's own
      // judgement rather than core guessing on data it does not have.
      const score =
        resolveWeight({
          kind: kindId,
          unit: row.unit,
          surface: row.alias,
          prior: kind.prior,
          layers,
        }) +
        (row.weight ?? 0) +
        // prefixQuality counts the characters of the alias still untyped, which
        // is as true of "kyiv" under "kyi" as of "kilometre" under "kilom" —
        // the fragment is the same object either way, and withholding it would
        // rank a kind's rows by weight alone and leave "kyoto" level with
        // "kyiv". Guarded on the prefix, which the alias path gets for free
        // from its own startsWith: a completer may match by fold, by
        // transliteration or by a second name, and the subtraction turns into a
        // *bonus* the moment the alias is shorter than what was typed. Zero
        // says the only true thing about such a row — how much of it the user
        // has typed is not known.
        (row.alias.startsWith(typed) ? prefixQuality(row.alias, typed) : 0);

      const key = `${kindId}:${row.key ?? row.unit}`;
      const text = input.slice(0, from) + row.text + input.slice(fragment.span.end);

      // A row whose insertion another row of this kind already offers. The
      // completer returns its rows ranked, so the one already here is the better
      // of the two and this one has nothing to add.
      const twin = shown.get(text);
      if (twin !== undefined && twin !== key) continue;

      const existing = best.get(key);

      if (
        existing === undefined ||
        score > existing.score ||
        (score === existing.score && row.alias < existing.alias)
      ) {
        shown.set(text, key);
        best.set(key, {
          alias: row.alias,
          span: { start: from, end: fragment.span.end },
          text,
          kind: kindId,
          unit: row.unit,
          score,
        });
      }
    }
  }

  // Stable, and deliberately so for the last resort: two rows of one kind can
  // now share a unit and an alias — both Springfields do — and Array#sort
  // preserving insertion order means the fallback is the order the completer
  // returned them in. That is the kind's own ranking, which core has nothing
  // better to replace it with; breaking the tie on `text` instead would sort
  // Massachusetts above Illinois for being alphabetically earlier.
  return [...best.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.kind.localeCompare(b.kind) ||
        a.unit.localeCompare(b.unit) ||
        a.alias.localeCompare(b.alias),
    )
    .slice(0, opts?.limit ?? DEFAULT_LIMIT);
}
