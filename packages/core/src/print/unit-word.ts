import type { Decimal } from "../decimal";
import type { Registry } from "../kind/registry";
import type { NodeId } from "../parse/ast";
import type { Resolution } from "../solve/solver";
import type { Candidate, KindId, Locale } from "../types";

/**
 * The spelling-selection cluster `print.ts`'s recursive descent leans on for
 * every quantity and convert target: which candidate a node's ambiguity
 * resolves to (`pickCandidate`), which of that candidate's own spellings
 * would be indistinguishable from a *different* candidate's (`avoidSpellings`),
 * and the actual word or symbol a node prints (`unitWord`, and — Task 11's
 * word-choice layer on top of it — `spelledUnitWord`).
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
    const lexeme = registry.kinds.get(c.kind)?.units.get(c.unit)?.lexeme;
    for (const alias of lexeme?.aliases ?? []) {
      avoid.add(alias.toLocaleLowerCase(locale.id));
    }
    if (lexeme?.symbol !== undefined) {
      avoid.add(lexeme.symbol.toLocaleLowerCase(locale.id));
    }
  }
  return avoid;
}

/**
 * The word for `(kindId, unitId)` — the unit's first registered alias,
 * which `aliasesFor` (every kind package's units table) always lists in a
 * form the parser accepts, or its `symbol` when `ctx.symbols` asks for one
 * and the unit has one (falling back to the alias otherwise — never
 * inventing a symbol; see `PrintOptions.symbols`'s doc comment).
 *
 * `avoid` (`avoidSpellings`'s result — empty for an unambiguous node) is
 * every spelling one of this node's *other* candidates could also produce.
 * Printing this candidate's alias without checking it would, whenever the
 * chosen unit's own first alias happens to also be a spelling the other
 * candidate could equally have produced (duration's `"m"` is not length's
 * first alias, but length's *is* `"m"` — the exact corpus case
 * "10 m + 5 km" resolves to), reprint a spelling that reveals nothing about
 * which candidate was chosen — sometimes literally the ambiguous surface
 * itself, silently coinciding with what `"canonical"` already echoes
 * instead of being the genuinely distinct mode `"resolved"` exists to be.
 * The fix is to skip past that spelling.
 *
 * `ambiguousSurface`, when given (the caller passes it only when the node
 * actually had more than one candidate), is where every alias and the
 * symbol fail that check — temperature and tempdelta register the
 * *identical* alias list (`"212 F in C"`), so no spelling of either
 * distinguishes them and there is nothing left to reveal. Falling back to
 * `aliases[0]` there would still differ from `"canonical"`'s echo by case
 * alone (the alias table's `"c"` against the corpus's typed `"C"`) for no
 * reason connected to the resolution at all, so the correct fallback is
 * the same surface `"canonical"` prints, not the unit's normalized alias —
 * `"resolved"` should coincide with `"canonical"` exactly when there is
 * genuinely nothing to disambiguate, never almost-coincide by an accident
 * of casing. An unambiguous node never reaches this fallback: `avoid` is
 * empty, so `aliases[0]` always clears the filter first.
 *
 * `symbols`/`spacing` are allowed to break the round-trip contract (a
 * symbol like `"m²"` or `"m/s"` does not lex back through every path) —
 * see `PrintOptions.symbols`'s doc comment. That is why the round-trip
 * test in `roundtrip.test.ts` only ever calls `print` with default options.
 *
 * `symbols` is checked *before* the alias filter, but the same `avoid` set
 * applies to it — so on the temperature/tempdelta case above, `ctx.symbols`
 * is inert: the shared symbol (`"°C"` for both) is in `avoid` exactly like
 * the shared aliases are, `ambiguousSurface` wins, and `"resolved"` prints
 * `"C"`, not `"°C"`. That is the same "nothing left to reveal" outcome as
 * the alias case, not a separate bug — a real, user-visible consequence of
 * a correct rule, not an oversight.
 */
export function unitWord(
  kindId: KindId,
  unitId: string,
  ctx: { readonly symbols: boolean },
  avoid: ReadonlySet<string>,
  ambiguousSurface: string | undefined,
  registry: Registry,
  locale: Locale,
): string {
  const lexeme = registry.kinds.get(kindId)?.units.get(unitId)?.lexeme;
  const aliases = lexeme?.aliases ?? [];
  const fold = (s: string) => s.toLocaleLowerCase(locale.id);

  if (ctx.symbols) {
    const symbol = lexeme?.symbol;
    if (symbol !== undefined && !avoid.has(fold(symbol))) return symbol;
  }
  const alias = aliases.find((a) => !avoid.has(fold(a)));
  if (alias !== undefined) return alias;
  return ambiguousSurface ?? aliases[0] ?? unitId;
}

/**
 * The word-choice layer `spelled` adds on top of `unitWord`: `UnitLexeme.display`,
 * selected by plural category, falling back to `unitWord`'s own alias/
 * `ambiguousSurface` chain — the same rule `unitWord` already follows for a
 * unit with no `symbol` — whenever there is no `display` at all, or the one
 * category this magnitude selects is itself a spelling `avoid` rules out
 * (mirroring `unitWord`'s own alias filter, for the identical
 * temperature/tempdelta reason documented on `avoidSpellings`).
 *
 * `magnitude` is the number *this* unit word is being printed next to — the
 * plural category comes from `Intl.PluralRules(locale.id).select`, the same
 * call `format/format.ts`'s `formatValue` already makes for the same reason
 * (a unit's `display` is keyed by `Intl.LDMLPluralRule` for exactly this).
 * `undefined` when there is no such number — a convert's target
 * (`renderTarget`) names a unit with no magnitude attached to it at all
 * ("2 km in m" has nothing to count "metres" by), and CLDR requires every
 * locale to define the `"other"` category, its generic/default one,
 * precisely for a count-free case like this: that is used directly rather
 * than synthesizing a fake magnitude just to steer `Intl.PluralRules.select`
 * there.
 *
 * The fallback forces `{ symbols: false }` on the delegated `unitWord` call:
 * a spelled print's unit label is a written word or nothing, never a glyph,
 * so `ctx.symbols` (the non-spelled `"symbols"` option) is never consulted
 * once `spelled` is on — see `PrintOptions.spelled`'s doc comment.
 */
export function spelledUnitWord(
  kindId: KindId,
  unitId: string,
  magnitude: Decimal | undefined,
  avoid: ReadonlySet<string>,
  ambiguousSurface: string | undefined,
  registry: Registry,
  locale: Locale,
): string {
  const lexeme = registry.kinds.get(kindId)?.units.get(unitId)?.lexeme;
  const display = lexeme?.display;
  if (display !== undefined) {
    const category =
      magnitude !== undefined
        ? new Intl.PluralRules(locale.id).select(magnitude.toNumber())
        : "other";
    const word = display[category];
    if (word !== undefined && !avoid.has(word.toLocaleLowerCase(locale.id))) {
      return word;
    }
  }
  return unitWord(
    kindId,
    unitId,
    { symbols: false },
    avoid,
    ambiguousSurface,
    registry,
    locale,
  );
}
