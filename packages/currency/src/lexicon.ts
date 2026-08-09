import { defineVocabulary, type UnitWords, type Vocabulary } from "@smartput/core";
import { CURRENCIES } from "./currencies";

/**
 * The words half of the `money` kind, built from the shipped table.
 *
 * A `Vocabulary` names its kind by **id string** — `"money"` — and never
 * imports it, which is what lets this package be read without linking
 * `@smartput/rate`'s rate machinery, and what lets a translation ship from
 * someone who is not the kind's author.
 *
 * Split out of `@smartput/rate`'s `money.ts` because it is the half that has
 * nothing to do with rates: aliases, symbol and plural forms are all facts
 * about a currency, and the same loop would have to be written again by anyone
 * registering a money kind of their own — which is the whole reason it is
 * exported. The magnitude band completion scores against went the other way in
 * the same split: `typical` is not language, so it lives on the kind (ruling
 * R3) and `CurrencyDef` stays its source.
 *
 * `locale` is a parameter rather than a constant so a translator can hand the
 * same generated table a different tag once `CURRENCIES` grows localized
 * names; today every word in it is English, and `"en"` is the honest default.
 */
export function currencyVocabulary(locale = "en"): Vocabulary {
  const units: Record<string, UnitWords> = {};
  for (const [code, def] of Object.entries(CURRENCIES)) {
    // `symbol` is explicit on every currency because the table already carries
    // one (ruling R8): the renderer's no-symbol branch joins number and unit
    // without a space, so a missing symbol would move a byte rather than fail.
    //
    // Copied rather than referenced: `defineVocabulary` deep-freezes what it
    // is given, and handing it `CURRENCIES`' own arrays would freeze the
    // exported table out from under every other reader of it.
    units[code] = {
      aliases: [...def.aliases],
      symbol: def.symbol,
      ...(def.display ? { forms: { ...def.display } } : {}),
    };
  }
  return defineVocabulary({ locale, kind: "money", units });
}
