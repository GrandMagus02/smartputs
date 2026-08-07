import type { Decimal } from "../decimal";
import { type Registry, wordsFor } from "../kind/registry";
import type { NodeId } from "../parse/ast";
import type { Resolution } from "../solve/solver";
import type { Candidate, KindId, Locale, Slot } from "../types";

/**
 * The spelling-selection cluster `print.ts`'s recursive descent leans on for
 * every quantity and convert target: which candidate a node's ambiguity
 * resolves to (`pickCandidate`), which of that candidate's own spellings
 * would be indistinguishable from a *different* candidate's (`avoidSpellings`),
 * and the actual word or symbol a node prints (`unitWord`).
 *
 * Extracted out of the `Printer` class (a refactor carried from Task 10's
 * review, done as its own commit with no behaviour change — every existing
 * print/parity test stayed green through it) so that `spelled`'s own layer
 * landed in a unit that is still readable rather than a class that had kept
 * growing under it. Plain functions taking `registry`/`locale` explicitly,
 * not methods on `Printer`, the same shape `format/format.ts`'s
 * `formatValue` already uses — nothing here needs any other `Printer`
 * instance state.
 */

/**
 * Which of a node's candidates to render, or `undefined` when there is
 * genuinely no way to tell.
 *
 * Every candidate on one node comes from resolving the *same* surface text
 * (`parse/candidates.ts`'s `resolve` is called once per node, with one
 * `surface`), so `candidates.length > 1` means exactly one thing: this word
 * has more than one registered meaning. `"canonical"` has no `Resolution`
 * to break the tie with — canonicalizing to any one candidate's alias would
 * silently narrow an ambiguous reading to an unambiguous one, changing what
 * the printed text *means*, not just how it looks — so it returns
 * `undefined` and the caller echoes the original surface instead,
 * reproducing the identical ambiguity on reparse. That is exactly what the
 * round-trip contract requires, and the reason `canonical` needs no
 * `Resolution` of its own.
 *
 * `"resolved"` exists precisely to break that tie: it reads
 * `ctx.resolution.choices[nodeId]`, the same map the solver already built,
 * and returns the candidate it chose. A single candidate has nothing to
 * disambiguate either way, so both modes return it unchanged.
 */
export function pickCandidate(
  candidates: readonly Candidate[],
  nodeId: NodeId,
  ctx: { readonly mode: "canonical" | "resolved"; readonly resolution?: Resolution },
): Candidate | undefined {
  const first = candidates[0];
  if (first === undefined || candidates.length === 1) return first;
  if (ctx.mode === "canonical") return undefined;
  const choice = ctx.resolution?.choices[nodeId];
  if (choice === undefined) {
    throw new Error(`Printer: the resolution has no choice for node ${nodeId}`);
  }
  return choice;
}

/**
 * Every spelling (alias or symbol) one of `candidates` *other than*
 * `chosen` could also be printed as — empty when there is only one
 * candidate, since an unambiguous node has nothing to disambiguate from.
 *
 * This, not the node's raw surface text alone, is what `unitWord` must
 * avoid: the raw surface is always a member of it anyway (every candidate
 * on one node shares it — that is *why* they are all candidates for the
 * same token), but a spelling shared for a different reason has to be
 * avoided too. Temperature's `"c"` and tempdelta's `"c"` (`"212 F in C"`)
 * register the *identical* alias list, decorative degree-signed entries
 * (`"°c"`) included — skipping only the raw surface would still land on
 * `"°c"` there, a spelling that is different from `"c"` as a string but
 * conveys nothing about which of the two kinds was chosen, since either
 * reading would offer the exact same alias. Comparing against every other
 * candidate's *whole* alias set is what tells the two situations apart:
 * length's `"metre"` is not in duration's alias list, but tempdelta's
 * `"°c"` is in temperature's. Where no unclaimed spelling exists (the
 * temperature/tempdelta case), `unitWord` falls back to `aliases[0]`, and
 * `"resolved"` prints the same text `"canonical"` already does — correctly,
 * since there is nothing left to reveal.
 */
export function avoidSpellings(
  candidates: readonly Candidate[],
  chosen: Candidate,
  registry: Registry,
  locale: Locale,
): ReadonlySet<string> {
  const avoid = new Set<string>();
  if (candidates.length <= 1) return avoid;
  for (const c of candidates) {
    if (c.kind === chosen.kind && c.unit === chosen.unit) continue;
    const words = wordsFor(registry, locale.id, c.kind, c.unit);
    for (const alias of words?.aliases ?? []) {
      avoid.add(alias.toLocaleLowerCase(locale.id));
    }
    if (words?.symbol !== undefined) {
      avoid.add(words.symbol.toLocaleLowerCase(locale.id));
    }
  }
  return avoid;
}

/**
 * `unitWord`'s single argument — collapsed from seven positional parameters
 * (review fix, Task 11 round 2) into one object precisely because two of
 * those seven were the exact same expression at both call sites
 * (`renderQuantity`/`renderTarget` each compute `avoid` and
 * `ambiguousSurface` once, then used to hand them to two near-identical
 * calls differing only in whether `spell` was present) — the shape a
 * transposed argument hides in. One call per caller now; the spelled/
 * unspelled branch lives inside this function instead of being chosen by
 * the caller between two entry points.
 */
export interface UnitWordOptions {
  readonly kindId: KindId;
  readonly unitId: string;
  /** `avoidSpellings`'s result — every spelling a *different* candidate on
   * this node could also produce. */
  readonly avoid: ReadonlySet<string>;
  /** The node's raw typed surface, passed only when it actually had more
   * than one candidate — see `avoidSpellings`'s doc comment. */
  readonly ambiguousSurface: string | undefined;
  /** "30 m²" vs "30 m2" — see `PrintOptions.symbols`. Ignored entirely once
   * `spell` is present; see `spell`'s own doc comment below. */
  readonly symbols: boolean;
  /**
   * Present exactly when `PrintOptions.spelled` is on for this call — this
   * is the word-choice layer `spelled` adds on top of the alias/symbol
   * chain below, not a second function next to it.
   *
   * `magnitude` is the number this unit word is being printed next to, handed
   * to `Language.selectForm` as its `count` to pick a key in the unit's
   * `forms` table — the same call `format/format.ts`'s `formatValue` makes,
   * for the same reason. Omitted when there is no such number — a convert's
   * target (`renderTarget`) names a unit with no magnitude attached to it at
   * all ("1 kg in g" has nothing to count "grams" by) — which is precisely
   * the case `FormCtx.count`'s optionality exists for (ruling R5): the
   * language answers for it (English returns `"other"`, CLDR's generic
   * category) rather than the engine synthesizing a fake magnitude to steer a
   * plural rule with.
   *
   * `slot` is where this word sits in the printed expression, so a language
   * whose grammar depends on position can answer differently: `"after-number"`
   * for an operand, `"conversion-target"` for a convert's target.
   */
  readonly spell?: { readonly magnitude?: Decimal; readonly slot: Slot };
}

/**
 * The word for `(kindId, unitId)` — `opts.spell`'s `UnitLexeme.display`
 * (selected by plural category) when spelling, falling all the way through
 * to the unit's first registered alias, which `aliasesFor` (every kind
 * package's units table) always lists in a form the parser accepts, or —
 * only when *not* spelling — its `symbol` when `opts.symbols` asks for one
 * and the unit has one (never inventing a symbol; see
 * `PrintOptions.symbols`'s doc comment).
 *
 * `opts.avoid` (`avoidSpellings`'s result — empty for an unambiguous node)
 * is every spelling one of this node's *other* candidates could also
 * produce. Printing this candidate's alias — or `display` word — without
 * checking it would, whenever it happens to also be a spelling the other
 * candidate could equally have produced (duration's `"m"` is not length's
 * first alias, but length's *is* `"m"` — the exact corpus case
 * "10 m + 5 km" resolves to), reprint a spelling that reveals nothing about
 * which candidate was chosen — sometimes literally the ambiguous surface
 * itself, silently coinciding with what `"canonical"` already echoes
 * instead of being the genuinely distinct mode `"resolved"` exists to be.
 * The fix is to skip past that spelling.
 *
 * `opts.ambiguousSurface`, when given (the caller passes it only when the
 * node actually had more than one candidate), is where every alias — and,
 * spelling or not, every other candidate — fail that check: temperature and
 * tempdelta register the *identical* alias list (`"212 F in C"`) and
 * neither declares `display` at all, so no spelling of either distinguishes
 * them and there is nothing left to reveal. Falling back to `aliases[0]`
 * there would still differ from `"canonical"`'s echo by case alone (the
 * alias table's `"c"` against the corpus's typed `"C"`) for no reason
 * connected to the resolution at all, so the correct fallback is the same
 * surface `"canonical"` prints, not the unit's normalized alias —
 * `"resolved"` should coincide with `"canonical"` exactly when there is
 * genuinely nothing to disambiguate, never almost-coincide by an accident
 * of casing. An unambiguous node never reaches this fallback: `avoid` is
 * empty, so `aliases[0]` (or `display`'s own category) always clears the
 * filter first.
 *
 * `symbols`/`spacing` are allowed to break the round-trip contract (a
 * symbol like `"m²"` or `"m/s"` does not lex back through every path) —
 * see `PrintOptions.symbols`'s doc comment. That is why the round-trip
 * test in `roundtrip.test.ts` only ever calls `print` with default options.
 *
 * `opts.symbols` is checked *before* the alias filter (mirroring `display`'s
 * own priority when spelling), but the same `avoid` set applies to it — so
 * on the temperature/tempdelta case above, `symbols: true` is inert: the
 * shared symbol (`"°C"` for both) is in `avoid` exactly like the shared
 * aliases are, `ambiguousSurface` wins, and `"resolved"` prints `"C"`, not
 * `"°C"`. That is the same "nothing left to reveal" outcome as the alias
 * case, not a separate bug — a real, user-visible consequence of a correct
 * rule, not an oversight.
 *
 * `opts.symbols` is not consulted *at all* once `opts.spell` is present — a
 * spelled print's unit label is a written word or nothing, never a glyph,
 * so the branch below chooses between `display` and the alias chain, never
 * between `display` and a symbol; see `PrintOptions.spelled`'s doc comment.
 */
export function unitWord(
  opts: UnitWordOptions,
  registry: Registry,
  locale: Locale,
): string {
  const { kindId, unitId, avoid, ambiguousSurface, symbols, spell } = opts;
  const words = wordsFor(registry, locale.id, kindId, unitId);
  const fold = (s: string) => s.toLocaleLowerCase(locale.id);

  if (spell !== undefined) {
    const key = locale.language.selectForm({
      ...(spell.magnitude !== undefined ? { count: spell.magnitude } : {}),
      kind: kindId,
      unit: unitId,
      slot: spell.slot,
    });
    const word = words?.forms?.[key];
    if (word !== undefined && !avoid.has(fold(word))) return word;
    // No forms table, no entry under the language's key, or that entry
    // collided with `avoid` — fall through to the alias chain below, never to
    // `symbols` (see this function's own doc comment).
  } else if (symbols) {
    const symbol = words?.symbol;
    if (symbol !== undefined && !avoid.has(fold(symbol))) return symbol;
  }
  const aliases = words?.aliases ?? [];
  const alias = aliases.find((a) => !avoid.has(fold(a)));
  if (alias !== undefined) return alias;
  return ambiguousSurface ?? aliases[0] ?? unitId;
}
