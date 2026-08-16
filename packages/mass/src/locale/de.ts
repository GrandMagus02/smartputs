import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * German words for the mass units — the same six `en`, `uk` and `es` name, and
 * the same answer to "does this unit have words at all?": all six do.
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` ``: the case from the slot (dative for a
 * conversion target, which is what "in Tonnen" governs) and the category from
 * `Intl.PluralRules("de")`, which declares only `one` and `other`. So the key
 * set is exactly `nom-one`, `nom-other`, `dat-one`, `dat-other` — no more and no
 * fewer (rule 6). What goes in them follows Duden's rule for Maßangaben, and
 * this kind is where that rule is easiest to read:
 *
 *   `das Gramm`, `das Kilogramm`, `das Milligramm` and `das Pfund` are neuter,
 *   so they stay **uninflected after a numeral** — "zwei Gramm", "fünf Pfund" —
 *   and German writes the conversion target as the bare measure too, "eine
 *   Angabe in Gramm". All four of their rows are therefore the same string, and
 *   that is the language rather than a table stopping halfway. Note the contrast
 *   with `@smartput/length/locale/de`, where the `-er` stems *do* take the
 *   dative plural ("in Metern"): the `-n` is not a rule the engine could apply
 *   for itself, which is why every row is written out.
 *
 *   `die Tonne` and `die Unze` are feminine and take their ordinary plural
 *   ("zwei Tonnen"), which already ends in `-n`, so on those two the **number**
 *   axis is the live one and the case axis is inert — the exact opposite
 *   arrangement from the four above.
 *
 * **`Pfund` is claimed for `lb`, and the hazard is stated rather than avoided.**
 * Colloquial German still uses *ein Pfund* for 500 g — half a metric kilo, not
 * the avoirdupois 453.59237 g this unit is — so "5 Pfund" typed by a German cook
 * means 2.5 kg and this engine will answer 2.268 kg. The alternative was to
 * leave `lb` its Latin symbol and print "5 lb", and it was rejected twice over:
 * *Pfund* is the German word for the imperial pound (it is what "englisches
 * Pfund" is short for), and refusing it would not remove the ambiguity, it would
 * only make the word unreadable — a German who types `Pfund` would get
 * `NoCandidateError` instead of a defensible reading. There is no 500 g unit
 * anywhere in this kind for the other sense to resolve to, so nothing is being
 * shadowed. `@smartput/mass/locale/es` claims `libra` on the same reasoning.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a German engine and
 * the micro path (`parseMass`) cannot drift from it. That map already carries
 * `kilo`/`kilos`, which is the German colloquial word as much as the English
 * one, and `tonne`/`tonnes`. What this file adds is the doubled `-mm` spellings
 * German writes (`Gramm`, never `Gram`), the German plural `Tonnen`, and the two
 * nouns English does not share at all, `Unze` and `Pfund`.
 *
 * `kilograms` stays out, deliberately and for `units.ts`'s reason rather than a
 * German one: it is not in the alias map at all, because `packages/core`'s
 * `engine.test.ts` pins "1.5 kilograms" as the example of a word reached only
 * through a suffix stripper. Nothing here puts it back.
 *
 * Capitals: the `forms` print `Gramm` and the aliases list `gramm`, because
 * `buildRegistry` folds every alias key with `toLocaleLowerCase` and
 * `compoundSplitter` folds both sides of its own comparison. One lowercase
 * alias therefore reads `Gramm`, `gramm` and `GRAMM` alike, and a capitalised
 * duplicate would read nothing extra.
 *
 * `symbol` is the international abbreviation on the four SI units, which is what
 * German itself writes, and the spelled nominative singular on the two German
 * has no abbreviation for. R8 wants an explicit symbol on every unit, never an
 * invented one: `Unze` is written out in German recipes exactly as it is here.
 *
 * Like `en`, this file names `mass` by **id string** and never imports the kind,
 * which is what lets `@smartput/mass/locale/de` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "mass",
  units: {
    mg: {
      aliases: [...alias("mg"), "milligramm"],
      symbol: "mg",
      forms: {
        "nom-one": "Milligramm",
        "nom-other": "Milligramm",
        "dat-one": "Milligramm",
        "dat-other": "Milligramm",
      },
    },
    // `gramm` with two `m`s is the German spelling and the one `compoundSplitter`
    // cuts on: `@smartput/core/locale/de` keeps `gramm` in its head list — at the
    // stated cost of *Programm* and *Diagramm* — because German never writes
    // "Kilo Gramm" apart, so without that head every mass compound in the
    // language is unreadable.
    g: {
      aliases: [...alias("g"), "gramm"],
      symbol: "g",
      forms: {
        "nom-one": "Gramm",
        "nom-other": "Gramm",
        "dat-one": "Gramm",
        "dat-other": "Gramm",
      },
    },
    kg: {
      aliases: [...alias("kg"), "kilogramm"],
      symbol: "kg",
      forms: {
        "nom-one": "Kilogramm",
        "nom-other": "Kilogramm",
        "dat-one": "Kilogramm",
        "dat-other": "Kilogramm",
      },
    },
    // Feminine, so this is one of the two units in the file whose number axis
    // moves. `Tonnen` serves as both nominative and dative plural, the weak
    // feminine paradigm: an `-n` in the plural means the dative has nothing left
    // to add.
    t: {
      aliases: [...alias("t"), "tonnen"],
      symbol: "t",
      forms: {
        "nom-one": "Tonne",
        "nom-other": "Tonnen",
        "dat-one": "Tonne",
        "dat-other": "Tonnen",
      },
    },
    oz: {
      aliases: [...alias("oz"), "unze", "unzen"],
      symbol: "Unze",
      forms: {
        "nom-one": "Unze",
        "nom-other": "Unzen",
        "dat-one": "Unze",
        "dat-other": "Unzen",
      },
    },
    // The free noun declines — `Pfunde`, dative `Pfunden` — and neither form is
    // ever printed, because after a numeral and in a measure reading German
    // writes the bare "zwei Pfund" and "in Pfund". Both are listed as aliases
    // anyway: reading and printing are separate decisions, and a reader who
    // types the declined plural should still be understood.
    lb: {
      aliases: [...alias("lb"), "pfund", "pfunde", "pfunden"],
      symbol: "Pfund",
      forms: {
        "nom-one": "Pfund",
        "nom-other": "Pfund",
        "dat-one": "Pfund",
        "dat-other": "Pfund",
      },
    },
  },
});
