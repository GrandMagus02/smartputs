import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Turkish words for the typographic units — the same six `en`, `uk` and `de`
 * name, with the same answer to "does this unit have words at all?": all six do.
 *
 * **One `forms` key per unit, keyed `other`, and that is the entire grammar of
 * this file.** `turkish.selectForm` is the constant `() => "other"`. This is the
 * kind where Dutch keeps its measure rule and its exception side by side — `12
 * punt` measured out beside `1920 pixels` counted — and Turkish has neither,
 * because there is no number axis to divide: "bir piksel", "1920 piksel" and
 * "1,5 punto" are one word after three different numerals, since a Turkish noun
 * after a numeral is bare. No gender, no article. The dative that marks a
 * conversion target ("piksele çevir") is deliberately off the axis — see
 * `@smartput/core/locale/tr`, which rejects it because vowel harmony derives the
 * ending mechanically and a symbol target takes it through an apostrophe
 * ("px'e") that a `forms` table cannot spell. Rule 6's "exactly the keys
 * `selectForm` can produce" is therefore one row per unit, where
 * `@smartput/measure/locale/de` needs four cells to hold the dative "in Pixeln".
 *
 * **`punto` is the typographic point, and it is the one word here Turkish
 * genuinely owns.** TDK defines it as the unit of type size, a Turkish designer
 * says "12 punto" without hesitating, and it is not the word for anything else:
 * a point on a scoreboard is a `sayı` or a `puan`, a dot is a `nokta`. So unlike
 * `@smartput/measure/locale/id`'s `poin`, this entry carries no polysemy note —
 * and `nokta` is deliberately **not** listed, because it means the dot or the
 * full stop and never a unit of type.
 *
 * **`piksel` is the other nativised loan**, respelled to Turkish orthography
 * exactly as `milimetre` and `santimetre` are, and it is what every Turkish
 * interface writes. The English `pixel`/`pixels` come from `units.ts` and stay
 * listed for reading.
 *
 * **`inç` is the inch, and it is the same noun `@smartput/length/locale/tr`
 * claims** — the two kinds hold the same physical unit for different callers,
 * and a caller composes only one of them into an engine at a time, because
 * `measure` is outside `BUILTIN_KINDS` for precisely the `mm`/`cm` collision
 * that would otherwise arise. Turkish abbreviates the inch with a double prime
 * (`5″`) which `lex` cannot read, so the spelled noun is the only short form
 * that round-trips, and it is the symbol.
 *
 * **The pica keeps its English spelling, and this file adds no word for it.**
 * Turkish printing borrowed the word rather than nativising it, TDK carries no
 * headword for it, and the respelling Turkish orthography would produce —
 * `pika` — is a word Turkish already has for the animal. Claiming it would put
 * a unit reading in front of a noun this kind has no way to tell apart from it,
 * which is `@smartput/measure/locale/id`'s ruling about the same string and
 * `@smartput/measure/locale/nl`'s about `cicero`. So `pc` prints the `pica`
 * that `units.ts` already declares: the decision this entry makes is only which
 * of the inherited spellings gets printed, not a new word.
 *
 * **`milimetre` and `santimetre` are the Turkish spellings.** Turkish
 * simplifies the doubled consonants of its European loans, so a millimetre has a
 * single `l`; it also writes the Latin `c` of *centi-* as the `s` it is
 * pronounced with, where Dutch keeps the `c` and German writes `Zentimeter`.
 * Both are added beside the English spellings `units.ts` declares, and only the
 * Turkish ones are printed.
 *
 * **Everything is lowercase**, because Turkish capitalises no common noun — so
 * the string this table prints is the string the alias index holds, and rule 5
 * needs none of the folding `de.test.ts` does. That is deliberate rather than
 * incidental in this language: `buildRegistry` folds alias keys with
 * `toLocaleLowerCase("tr")`, under which `I` becomes `ı` and not `i`, so a
 * capital in an alias would be indexed under a different letter than the reader
 * typed. Incoming capitals are `turkish.analyze`'s `caseFolds` to handle, and
 * this kind is where that matters most in practice: `PX` and `PT` are how a
 * spec sheet sets them.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a Turkish engine and
 * the micro path (`parseMeasure`) cannot drift from it.
 *
 * `symbol` follows `uk`'s and `id`'s split, for their reason. The three
 * typographic units keep their Latin abbreviations — `pt`, `pc` and `px` are
 * what a Turkish designer writes in a stylesheet, and a Turkish short form would
 * be one this file made up rather than one anybody types. The two metric units
 * get the SI abbreviations Turkish itself writes. The inch gets `inç`, its own
 * noun. R8 wants an explicit symbol on every unit, never an invented or
 * unreadable one.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/tr` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "measure",
  units: {
    // `inc` is `inç` without its cedilla, listed for the reason
    // `@smartput/length/locale/tr` lists it on the same noun: the language's
    // case folds reach the dotted and dotless i and nothing else, so ç → c is a
    // vocabulary's business, and `inc` is not a Turkish word that claiming it
    // would take. The corrector cannot stand in for the entry here either — it
    // is one edit from `inç`, `inch` and `pc`'s neighbours at once.
    inch: {
      aliases: [...alias("inch"), "inç", "inc"],
      symbol: "inç",
      forms: { other: "inç" },
    },
    mm: {
      aliases: [...alias("mm"), "milimetre"],
      symbol: "mm",
      forms: { other: "milimetre" },
    },
    cm: {
      aliases: [...alias("cm"), "santimetre"],
      symbol: "cm",
      forms: { other: "santimetre" },
    },
    pt: {
      aliases: [...alias("pt"), "punto"],
      symbol: "pt",
      forms: { other: "punto" },
    },
    // `pika` is deliberately absent; see the header. The English spelling comes
    // from `units.ts` and is what a Turkish typesetter writes, so this entry
    // adds no word of its own — only the decision that this is the one printed.
    pc: {
      aliases: [...alias("pc")],
      symbol: "pc",
      forms: { other: "pica" },
    },
    px: {
      aliases: [...alias("px"), "piksel"],
      symbol: "px",
      forms: { other: "piksel" },
    },
  },
});
