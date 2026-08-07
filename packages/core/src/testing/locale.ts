import { Decimal } from "../decimal";
import { buildRegistry, wordsFor } from "../kind/registry";
import { createAnalyzerChain } from "../locale/analyze";
import type { Kind, Locale, Slot } from "../types";

/** What `assertLocaleContract` samples, and what it is allowed to skip. */
export interface LocaleContractOptions {
  /** Counts sampled against every unit. Defaults to 0, 1, 2, 5, 11, 21, 100, 1000. */
  readonly counts?: readonly (number | Decimal)[];
  /** Slots sampled. Defaults to "bare", "after-number", "conversion-target". */
  readonly slots?: readonly Slot[];
  /** Units this language deliberately has no words for, `${kind}:${unit}`. */
  readonly skip?: readonly string[];
}

/**
 * What a language owes the kinds it claims to speak, asserted in one call.
 *
 * `assertKindContract` next door asks whether a *kind* is well formed. This
 * asks whether a *(language, kinds)* pair is: every unit has words, every word
 * is readable back, and every grammatical key the language will ask for at
 * runtime exists in the table it will index. The failure it exists to prevent
 * is silent — a missing `many` form does not throw, it renders `в 5 кілограм`
 * at a user — so a translation lands with a test that names the gap instead.
 *
 * All four checks run before any of them throws, and the message lists every
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
  const problems: string[] = [];

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
        const forms = [alias, ...analyze(alias).map((a) => a.form)];
        const readings = (f: string) =>
          registry.aliasIndex.get(f.toLocaleLowerCase(locale.id)) ?? [];
        const hit = forms.some((f) =>
          readings(f).some((e) => e.kind === kindId && e.unit === unit),
        );
        if (!hit) {
          problems.push(
            `${kindId}:${unit} alias ${JSON.stringify(alias)} does not resolve back`,
          );
          continue;
        }
        // The half of "resolves back to its own unit" the reachability check
        // above cannot see. `buildRegistry` indexes an alias under itself, so
        // the entry list for a word always contains the unit that declared it
        // and `hit` is true by construction — it can only fail if the index
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
