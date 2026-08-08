import { Decimal } from "../decimal";
import { buildRegistry, wordsFor } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import { OPS } from "../parse/lex";
import type { Kind, KindId, Locale, Slot, UnitWords } from "../types";

/** What `assertLocaleContract` samples, and what it is allowed to skip. */
export interface LocaleContractOptions {
  /** Counts sampled against every unit. Defaults to 0, 1, 2, 5, 11, 21, 100, 1000. */
  readonly counts?: readonly (number | Decimal)[];
  /** Slots sampled. Defaults to "bare", "after-number", "conversion-target". */
  readonly slots?: readonly Slot[];
  /** Units this language deliberately has no words for, `${kind}:${unit}`. */
  readonly skip?: readonly string[];
  /**
   * Units whose *printed* strings this language knowingly cannot read back,
   * `${kind}:${unit}`. Far narrower than `skip`: the unit's aliases and its
   * `forms` keys are still asserted, and only the print-and-read-back check
   * below is waived for it.
   *
   * It exists for one measured case, and taking it should always cost that much
   * explaining. English `length:in` has symbol "in", which is core's conversion
   * keyword: `lex` emits a keyword token for it, so no alias index can claim it
   * (`@smartput/length/locale/en` drops "in" from `aliases` for exactly that
   * reason, and says so at length), and `5in` from a `symbols: true` print does
   * not parse. There is no second English symbol for the inch to move to —
   * the double-prime is not lexable either — so the vocabulary's choice is
   * between the conventional abbreviation and no symbol at all, and the
   * conventional one is what `formatLength`'s `7in` micro path also writes.
   */
  readonly skipPrintable?: readonly string[];
}

/**
 * The characters `lex` turns into arithmetic, as a set.
 *
 * Derived from the lexer's own table rather than written out a second time, so
 * a spelling added there (U+2215 DIVISION SLASH is the next candidate) is one
 * this check recognizes on the same commit. It is built here, in a module
 * nothing ships, because a `new Set(...)` at the top level of `parse/lex.ts`
 * survives bundling into every package that lexes and `check-size` charges for
 * it.
 */
export const OPERATOR_CHARS: ReadonlySet<string> = new Set(Object.keys(OPS));

/**
 * Every string the printer can emit for one unit, mapped to what it is called
 * in a failure message.
 *
 * The two sources are the two the renderer chooses between: `locale/render.ts`
 * prints a `forms` entry when the language's `selectForm` key hits one and the
 * unit's `symbol` when it does not, and `Printer` reaches for the same `symbol`
 * under `symbols: true`. Nothing else about a unit is ever shown to a user.
 *
 * Keyed by the surface, so a `forms` table whose eight keys hold three distinct
 * words is checked three times rather than eight; the label kept is the first
 * key that spelled it, which is enough to find the row.
 */
function printableSurfaces(words: UnitWords): Map<string, string> {
  const surfaces = new Map<string, string>();
  if (words.symbol !== undefined) surfaces.set(words.symbol, "symbol");
  for (const [key, form] of Object.entries(words.forms ?? {})) {
    if (!surfaces.has(form)) surfaces.set(form, `form ${JSON.stringify(key)}`);
  }
  return surfaces;
}

/**
 * What a language owes the kinds it claims to speak, asserted in one call.
 *
 * `assertKindContract` next door asks whether a *kind* is well formed. This
 * asks whether a *(language, kinds)* pair is: every unit has words, every word
 * is readable back, every string the printer can emit is readable back, and
 * every grammatical key the language will ask for at runtime exists in the
 * table it will index. The failure it exists to prevent is silent — a missing
 * `many` form does not throw, it renders `в 5 кілограм` at a user — so a
 * translation lands with a test that names the gap instead.
 *
 * All the checks run before any of them throws, and the message lists every
 * problem: a half-translated vocabulary has dozens, and finding them one
 * re-run at a time is how a translator gives up.
 *
 * ```ts
 * test("en", () => assertLocaleContract(composeLocale(english, BUILTIN_EN), BUILTIN_KINDS));
 * ```
 *
 * A unit that legitimately has no words is `opts.skip`'s job, not a reason to
 * soften a check: I10 says a wordless unit degrades to its own key, and a
 * sentinel unit nobody types is the case that is meant to.
 */
export function assertLocaleContract(
  locale: Locale,
  kinds: Kind[],
  opts: LocaleContractOptions = {},
): void {
  const registry = buildRegistry(kinds, [locale]);
  const analyze = createAnalyzerChain(locale.language);
  const counts = (opts.counts ?? [0, 1, 2, 5, 11, 21, 100, 1000]).map(
    (c) => new Decimal(c),
  );
  const slots: readonly Slot[] = opts.slots ?? [
    "bare",
    "after-number",
    "conversion-target",
  ];
  const skip = new Set(opts.skip ?? []);
  const skipPrintable = new Set(opts.skipPrintable ?? []);
  const problems: string[] = [];

  const readings = (surface: string) =>
    registry.aliasIndex.get(surface.toLocaleLowerCase(locale.id)) ?? [];
  /**
   * Does `surface` reach `(kindId, unit)` by the route the engine takes — the
   * alias index first, then whatever the language's analyzer chain can make of
   * it? A form only the suffix stripper recovers counts: a penalised reading is
   * still a reading, and the engine ranks it against the alternatives rather
   * than refusing it.
   */
  const readable = (surface: string, kindId: KindId, unit: string): boolean =>
    [surface, ...analyze(surface).map((a) => a.form)].some((form) =>
      readings(form).some((e) => e.kind === kindId && e.unit === unit),
    );

  for (const [kindId, kind] of registry.kinds) {
    for (const unit of kind.units.keys()) {
      if (skip.has(`${kindId}:${unit}`)) continue;
      const words = wordsFor(registry, locale.id, kindId, unit);
      if (words === undefined) {
        problems.push(`${kindId}:${unit} has no words`);
        continue;
      }
      if (words.aliases.length === 0) problems.push(`${kindId}:${unit} has no alias`);
      for (const alias of words.aliases) {
        if (!readable(alias, kindId, unit)) {
          problems.push(
            `${kindId}:${unit} alias ${JSON.stringify(alias)} does not resolve back`,
          );
          continue;
        }
        // The half of "resolves back to its own unit" the reachability check
        // above cannot see. `buildRegistry` indexes an alias under itself, so
        // the entry list for a word always contains the unit that declared it
        // and `readable` is true by construction — it can only fail if the index
        // stops being built from these same aliases. It is kept because that is
        // the day it earns its keep; the assertion with teeth today is this one.
        //
        // A word claimed by two units *of the same kind* has no reading: `10
        // millimetres` cannot be both an inch and a millimetre, and no context
        // the engine has will separate them. Derived vocabularies cannot
        // produce it (a `units.ts` alias map sends each word to one unit), so
        // this fires on hand-editing, which is exactly when it should.
        //
        // Only the *exact* alias is checked, never the analyzed forms. A
        // stripper folding one unit's word onto another's inside a kind is
        // ordinary — English turns `ms` into `m` — and it is resolved by
        // weight, not broken: the exact alias always outranks a stripped one.
        const rivals = readings(alias)
          .filter((e) => e.kind === kindId && e.unit !== unit)
          .map((e) => e.unit);
        if (rivals.length > 0) {
          problems.push(
            `${kindId}:${unit} alias ${JSON.stringify(alias)} does not resolve back — ${rivals
              .map((u) => `${kindId}:${u}`)
              .join(", ")} claims it too`,
          );
        }
      }
      // Aliases and printed strings are different sets, and the gap between
      // them is where a printer that cannot read its own output lives: the loop
      // above proves every word a user may *type* is understood, and says
      // nothing about the word the engine *answers* with. Ukrainian shipped
      // four kinds in that state with this file green — "1 hp" printed
      // "1 кінська сила" and then threw `Unknown unit "кінська"` on it.
      if (!skipPrintable.has(`${kindId}:${unit}`)) {
        for (const [surface, label] of printableSurfaces(words)) {
          // A blank symbol prints no unit at all, so there is nothing to read
          // back: `@smartput/number` declares `symbol: ""` deliberately (R8
          // wants an explicit symbol everywhere, and `formatValue` returns the
          // bare number text for `NUMBER_KIND` before any symbol is read).
          if (surface.trim() === "") continue;
          // A symbol carrying an operator is read as arithmetic, not by lookup,
          // and is therefore outside what an alias index can decide: English
          // "m/s" is length ÷ duration and Ukrainian's kilowatt-hour is power ×
          // duration, and both are correct precisely because the lexer ends the
          // word token at the operator. What catches a *broken* compound is an
          // evaluation test — the kind's own `locale/<id>.test.ts` evaluating
          // the printed symbol and checking the quantity that comes back, which
          // is what the four packages fixed in this phase now carry — because
          // whether "Мбіт/с" computes depends on a signature (`datasize ÷
          // duration`) that no words check can see.
          if ([...surface].some((c) => OPERATOR_CHARS.has(c))) continue;
          // A phrase, on the other hand, is never correct: `lex` builds a word
          // token out of a run of letters, so a space ends it and no single
          // analyzer is ever handed the whole thing. A printer that emits a
          // phrase it cannot read is broken in every language.
          if (/\s/u.test(surface)) {
            problems.push(
              `${kindId}:${unit} prints ${JSON.stringify(surface)} (${label}) but no single token can read it back — a unit word is one token`,
            );
            continue;
          }
          if (!readable(surface, kindId, unit)) {
            problems.push(
              `${kindId}:${unit} prints ${JSON.stringify(surface)} (${label}) but cannot read it back`,
            );
          }
        }
      }
      if (words.forms === undefined) continue;
      for (const slot of slots) {
        for (const count of counts) {
          const key = locale.language.selectForm({ count, kind: kindId, unit, slot });
          if (words.forms[key] === undefined) {
            problems.push(
              `${kindId}:${unit} has no form ${JSON.stringify(key)} (count ${count}, slot ${slot})`,
            );
          }
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `locale ${locale.id} fails its contract:\n  ${problems.join("\n  ")}`,
    );
  }
}
