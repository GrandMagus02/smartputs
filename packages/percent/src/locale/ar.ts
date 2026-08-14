import { aliasesFor, defineVocabulary } from "@smartput/core";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Arabic words for the percent unit — the same one unit `en` next door names, and
 * the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in an Arabic engine and
 * the micro path (`parsePercent`) cannot drift from it. The Arabic spellings are
 * appended on top.
 *
 * **The word is a frozen prepositional phrase, and that is why this file is
 * short.** Arabic says "per hundred" — بـ + الـ + مئة — written as the single
 * token بالمئة. It is not a noun: it takes no dual, no plural and no tamyīz, so
 * it does not move across a single one of `arabic.selectForm`'s six categories.
 * Every sibling `ar` vocabulary in this phase has six genuinely different cells
 * per unit (كيلوغرام / كيلوغرامان / كيلوغرامات / كيلوغرامًا); this one would have
 * six copies of one string. That is a second, Arabic-specific reason on top of
 * `en`'s, which already applies: **the written form of this unit is the symbol.**
 * Recipe rule — where the `en` unit decided against word forms, this file does
 * not invent them. Reading "20 بالمئة" still works, and answers "20 %".
 *
 * **Two orthographies, both listed.** مئة and مائة are the same word: the second
 * writes an alif that is not pronounced, and both are in equally current use
 * across the Arab world with no way to know which one a keyboard produced. This
 * is exactly the pairing `ar-cardinals.ts` makes for the numeral 100, and for the
 * same reason. بالمية is the colloquial spelling — the tāʾ marbūṭa written as a
 * plain yāʾ-less هـ is how it is typed in Egyptian and Levantine writing — and it
 * reads without ever being printed.
 *
 * **The phrase في المئة, and the trap it sets.** Standard written Arabic says
 * "٢٠ في المئة" at least as often as "٢٠ بالمئة" — but في is core's `in` keyword
 * in this language (`@smartput/core/locale/ar` claims it there, and explains why
 * it could not also be `times`), so those three tokens reach the parser as the
 * *conversion* `20 in percent` and evaluate to 2,000 %. That is a defensible
 * reading of the words — 20 expressed as a percentage really is 2,000 % — and it
 * is not the reading the writer meant. It cannot be prevented from here: with
 * المئة left unclaimed the resolver reaches the unit anyway through a fuzzy
 * correction to بالمئة, at one edit's penalty and with the same answer, so
 * declining the alias would buy nothing but a slower route to the same number.
 * So the alias is declared — which makes "٥ / ٥٠ في المئة" (the phrasing where
 * the conversion reading is the *right* one) a full-weight reading rather than a
 * guess — and `ar.test.ts` pins both outcomes so the hazard is recorded instead
 * of rediscovered. بالمئة is the one-token spelling that says "20 percent" and
 * means it, and it is what completion inserts.
 *
 * **٪ (U+066A, ARABIC PERCENT SIGN) is deliberately absent**, and it is the sign
 * Arabic typography actually sets. `parse/lex.ts` skips it as an unrecognized
 * character — it is neither a digit nor `\p{L}` — so "٢٠٪" reaches the resolver
 * with the sign already thrown away, and an alias carrying it could never be
 * produced. Worse than useless, it would read as coverage: `ar.test.ts` asserts
 * instead that "20٪" evaluates to the bare *number* 20, which is what the lexer
 * leaves behind. The Latin "%" is what this vocabulary prints and reads, and it
 * is what an Arabic keyboard in a search box produces anyway.
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in every
 * script. One visible consequence of `arabic.renderQuantity` shows up here and
 * nowhere else in this row's siblings — Arabic sets a symbol off from the number
 * with a space (٥ كغ, never ٥كغ), so a percentage prints "20 %" where English
 * prints "20%". That is the language's typographic decision and not this file's;
 * it round-trips, which is the property that matters, and `ar.test.ts` pins the
 * exact string so nobody has to guess whether the space was intended.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/ar` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // The one-token spelling, in both orthographies of مئة plus the
        // colloquial one. This is what a user should type and what completion
        // inserts.
        "بالمئة",
        "بالمائة",
        "بالمية",
        // The head of the two-token phrase "في المئة". في is the `in` keyword, so
        // these are reached as a conversion target — see the doc comment above
        // for the reading that produces and why it is claimed anyway.
        "المئة",
        "المائة",
        // "نسبة مئوية" (the noun phrase "percentage") is two tokens and cannot be
        // claimed, and its head مئوية is already Arabic for *centigrade* —
        // `@smartput/temperature/locale/ar` declares it. Claiming it here would
        // make "20 مئوية" ambiguous between a percentage and a temperature in
        // every composed engine, to buy back a phrase no single token can carry.
      ],
      symbol: "%",
    },
  },
});
