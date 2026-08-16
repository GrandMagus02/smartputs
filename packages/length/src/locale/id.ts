import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `es`, `de`, `nl` and `ja` next door make,
 * kept here for only the second of their two reasons — and that reason is
 * enough on its own.
 *
 * Indonesian's own conversion keywords are `ke` and `dalam`
 * (`@smartput/core/locale/id`), and the language deliberately claims no word
 * spelled `in` at all, so `lex` does *not* emit a keyword token for it in an
 * id-only engine and an `in` alias would be perfectly reachable there. It stays
 * out anyway, because `registry.aliasIndex` is one flat map that
 * `MatchCtx.isUnitAlias` reads without consulting a locale: an Indonesian entry
 * for `in` would put the word back in front of `@smartput/datetime`'s
 * accept-gate — which refuses any phrase whose words are *all* unit aliases —
 * for any engine that also speaks English or Dutch, and make "in 3 days" an
 * all-units phrase again.
 *
 * An Indonesian reader types `inci`, so the omission costs this vocabulary
 * nothing — and unlike English, which has to keep `in` as its *symbol* and buy
 * a `skipPrintable` waiver for it, this file has a short form of its own to
 * print.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Indonesian words for the length units — the same eight `en`, `uk` and `nl`
 * name, and all eight have words: Indonesian writes a length out as readily as
 * English does, and has a native noun for three of the four imperial units.
 *
 * **One `forms` key per unit, and that is the entire grammar of this file.**
 * `indonesian.selectForm` is the constant `() => "other"`. Indonesian has no
 * grammatical number — "satu meter", "sepuluh meter" and "1,5 meter" differ in
 * the numeral and nowhere else, and the reduplicated plural ("meter-meter") is
 * blocked by a numeral rather than merely unusual after one — no gender, no
 * case, and no article for a preposition to govern, so the conversion target in
 * "5 km dalam meter" is spelled like a bare quantity. `Intl.PluralRules("id")`
 * declares the single category `"other"`, so rule 6's "exactly the keys
 * `selectForm` can produce" is satisfied by one row per unit. Compare
 * `@smartput/length/locale/de`, which needs four cells to say what a dative
 * does to "in Metern", and `uk`, which needs eight.
 *
 * **The metric four are the same words English writes, with Indonesian
 * spelling on two of them.** Indonesian took its metric vocabulary through
 * Dutch and simplified the doubled consonant, so a millimetre is `milimeter`
 * with one `l`; it also writes the Latin `c` of *centi-* as the `s` it is
 * pronounced with, so a centimetre is `sentimeter`. Both spellings are added
 * here beside the English ones `units.ts` already declares — the English ones
 * cost nothing and people do type them, and only the Indonesian ones are ever
 * printed. `meter` and `kilometer` are already the Indonesian words unchanged.
 *
 * **`kaki` is the foot, and it is the body part first.** That is the same
 * polysemy Dutch's `voet` and German's `Fuß` carry, and it is safer here than
 * in either: those two languages need a compound splitter, which reads a
 * Germanic compound by its head and would find the unit inside every compound
 * of the body part, so `@smartput/core/locale/nl` has to keep `voet` out of its
 * head list on purpose. Indonesian is not a compounding language and
 * `indonesian.analyze` is `identity()` alone, so `kaki` is reachable only as
 * the exact word — and a bare `kaki` with no numeral in front of it is not a
 * quantity in the first place.
 *
 * **`mil` is claimed and `mil laut` cannot be.** `mil` is the ordinary
 * Indonesian word for the statute mile, and it is one token, so it is listed.
 * The nautical mile is `mil laut` — two words, and `lex` ends a word token at a
 * space — so it is unlistable regardless of whether this kind had a unit for
 * it, which it does not. Nothing is lost: an Indonesian who means the nautical
 * mile writes the qualifier, and the qualifier is what fails, loudly, instead
 * of a bare `mil` quietly answering 1609 m for 1852.
 *
 * **`yard` is the loan kept unchanged**, exactly as `units.ts` declares it, and
 * is the one imperial unit here that Indonesian did not translate.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in an Indonesian engine
 * and the micro path (`parseLength`) cannot drift from it.
 *
 * **There is no stripper behind these aliases.** `indonesian.analyze` is
 * `identity()` alone, so a form this file prints and forgets to list is
 * unreachable, with nothing to recover it at a penalty — rule 5 has teeth here
 * that it does not have in a language with morphology. No folding is needed on
 * either side of that check: Indonesian capitalises no noun.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Indonesian itself writes ("5 km", never a spelled short form), and the
 * spelled singular on the four imperial ones. Indonesian abbreviates none of
 * those four: where a short form appears at all it is the English one, which
 * `units.ts` already registers as an alias, so claiming it as the *Indonesian*
 * symbol would print `36in` at a reader who wrote `inci` — and `in` is not
 * lexable in a bilingual engine anyway, which is the very gap
 * `assertLocaleContract`'s `skipPrintable` exists for in English. R8 wants an
 * explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/id` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "id",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "milimeter"],
      symbol: "mm",
      forms: { other: "milimeter" },
    },
    // `sentimeter` is the KBBI spelling — Indonesian writes the Latin `c` of
    // *centi-* as the `s` it is pronounced with, where Dutch keeps the `c` and
    // German writes `Zentimeter`. The English `centimeter`/`centimetre` come
    // from `units.ts` and stay listed for reading.
    cm: {
      aliases: [...alias("cm"), "sentimeter"],
      symbol: "cm",
      forms: { other: "sentimeter" },
    },
    m: {
      aliases: [...alias("m")],
      symbol: "m",
      forms: { other: "meter" },
    },
    km: {
      aliases: [...alias("km")],
      symbol: "km",
      forms: { other: "kilometer" },
    },
    // `in` is filtered out above; `inci` is the Indonesian noun and, unlike
    // English, it is a short form this vocabulary can also print as its symbol.
    in: {
      aliases: [...alias("in"), "inci"],
      symbol: "inci",
      forms: { other: "inci" },
    },
    ft: {
      aliases: [...alias("ft"), "kaki"],
      symbol: "kaki",
      forms: { other: "kaki" },
    },
    yd: {
      aliases: [...alias("yd")],
      symbol: "yard",
      forms: { other: "yard" },
    },
    mi: {
      aliases: [...alias("mi"), "mil"],
      symbol: "mil",
      forms: { other: "mil" },
    },
  },
});
