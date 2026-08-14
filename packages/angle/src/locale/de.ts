import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

/**
 * `grad` is taken away from the gradian and given to the degree, which is the
 * one place in these six packages where a German vocabulary overrules an alias
 * `units.ts` declares. It needs the whole argument.
 *
 * German's word for an angular degree **is** `Grad` — "ein Winkel von 90 Grad",
 * with no other spelling and no abbreviation but the degree sign. So `deg` has
 * to print `Grad`, and rule 5 says a printed form must be a readable alias:
 * `assertLocaleContract` fails a vocabulary that prints a word the index sends
 * somewhere else. `units.ts` meanwhile declares the English abbreviation `grad`
 * for the **gradian**, and the contract's rival check refuses one surface
 * claimed by two units of one kind, because no context this engine has could
 * separate them.
 *
 * One of the two has to yield, and the gradian is the one that can: German's own
 * names for it are `Gon` (the DIN and ISO spelling, and the symbol) and
 * `Neugrad`. Nobody writing German means a gradian by the bare word `Grad` —
 * that is precisely the confusion `Gon` was coined to end — so the German
 * vocabulary keeps `gradian`, `gradians`, `gon` and `neugrad` for that unit and
 * lets the degree have the word a German reader actually types.
 *
 * **The cost, stated rather than hidden, and it is larger than it first looks.**
 * In an engine speaking German *and* English, `registry.aliasIndex` holds two
 * entries for `grad` — the English vocabulary's gradian and this file's degree —
 * and nothing separates them: both are `angle`, both are exact aliases at weight
 * 0, and the two `locale:` selectors are the only thing that tells them apart.
 * So `evaluate("90 Grad")` on an `[de, en]` engine does not pick the degree, it
 * raises `AmbiguousError` — and "90 Grad" is the commonest angle phrase in the
 * language. `de.test.ts` asserts that outcome rather than leaving this paragraph
 * to claim something friendlier than what happens.
 *
 * That is many-to-one recognition working as designed (spec §9) rather than a
 * collision this file introduced — German is simply the first shipped language
 * to write a unit word in the same script and the same letters as English uses
 * for a *different* unit of the same kind, which is why no `en`/`uk` pair could
 * ever produce it. It is also, as designed, the caller's to settle: `locales:
 * ["de"]` narrows to the German reading, `weights: { "locale:de": 1 }` prefers
 * it engine-wide, and a German who writes `°` or `Gon` never reaches the tie.
 *
 * The alternative was for `german` to ship a `weights` table biasing
 * `angle:deg`, and it is refused here because a `Language`'s weights are read on
 * every engine that installs it (`engine.ts`'s `languageWeights` merges all
 * locales, not the format one), so a German pack would be silently reordering an
 * English reader's gradians. A bias that broad is the consumer's call to make,
 * not a translation's — and no language in this repo declares one today.
 *
 * `@smartput/angle/locale/uk` reaches the same place from the other side: it
 * gives the degree the sign `°` because `град.` "would be exactly the string
 * `grad` claims below — a symbol nobody could read twice". Ukrainian could dodge
 * it by writing in another script; German cannot.
 */
const RESERVED_FOR_DEGREE = new Set(["grad"]);

const alias = (unit: AngleUnit) =>
  aliasesFor(ANGLE_UNITS, unit).filter(
    (a) => unit !== "grad" || !RESERVED_FOR_DEGREE.has(a),
  );

/**
 * German words for the angle units — the same four `en` and `uk` name, and all
 * four have words: German writes every one of them out.
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` ``: the case from the slot (dative for a
 * conversion target, which is what "in Umdrehungen" governs) and the category
 * from `Intl.PluralRules("de")`, which declares only `one` and `other`. So the
 * key set is exactly `nom-one`, `nom-other`, `dat-one`, `dat-other` (rule 6),
 * and Duden's rule for Maßangaben decides what goes in them:
 *
 *   `der Grad`, `der Radiant` and `das Gon` are masculine or neuter, so they
 *   stay uninflected after a numeral — "90 Grad", "zwei Radiant", "200 Gon" —
 *   and German writes the conversion target bare too, "eine Angabe in Grad". All
 *   four of their cells are therefore one string, which is the language and not
 *   an unfinished table.
 *
 *   `die Umdrehung` is feminine and takes its ordinary plural `Umdrehungen`,
 *   which already ends in `-n`, so it is the one unit here whose **number** axis
 *   moves and whose case axis does not. Between it and the three above, both
 *   axes of this table are measured — which is the whole reason a two-axis
 *   language needs a unit of each shape to be tested against.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a German engine and
 * the micro path (`parseAngle`) cannot drift from it. The one exception is
 * `grad`, taken from the gradian and given to the degree for the reason set out
 * above.
 *
 * Capitals: the `forms` print `Grad` and the aliases list `grad`, because
 * `buildRegistry` folds every alias key with `toLocaleLowerCase`. One lowercase
 * alias reads `Grad`, `grad` and `GRAD` alike.
 *
 * `symbol` is what German itself writes: `rad` and `gon` are the international
 * abbreviations German technical prose uses unchanged, `°` is the only short
 * form there has ever been for a degree, and `U` is the German abbreviation for
 * a revolution — the `U` of "U/min", which is how every German tachometer is
 * labelled. Each is also an alias, so a printed symbol reads back. R8 wants an
 * explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/de` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "angle",
  units: {
    // `der Radiant` — masculine, and a weak (n-declension) one, so the free
    // noun's plural and its dative plural are both `Radianten`. Neither is
    // printed: after a numeral German writes the bare measure noun, "zwei
    // Radiant". `radianten` is listed as an alias all the same, exactly as
    // `Zölle`/`Zöllen` and `Grade`/`Graden` are below — a reader who types the
    // declined form should be understood without paying the suffix stripper's
    // penalty, and reading and printing are separate decisions.
    //
    // The homograph is worth naming and is *not* a reason to leave the word
    // out: `der Radiant` is also the radiant point of a meteor shower, which is
    // the same noun with the same paradigm and not a rival unit — this kind has
    // nothing for the astronomical sense to resolve to, so nothing is shadowed.
    // Contrast `Cicero` in `@smartput/measure/locale/de`, which *is* a rival
    // unit with a different ratio and therefore stays out.
    rad: {
      aliases: [...alias("rad"), "radiant", "radianten"],
      symbol: "rad",
      forms: {
        "nom-one": "Radiant",
        "nom-other": "Radiant",
        "dat-one": "Radiant",
        "dat-other": "Radiant",
      },
    },
    // The unit that took `grad` from the gradian; see the note above the
    // reservation. `Grade` and `Graden` are the free noun's plural and dative
    // plural — "die Grade eines Winkels" — and neither is printed, because after
    // a numeral and as a measure German writes the bare "90 Grad" and "in Grad".
    // Both are listed anyway so a reader who types them is understood.
    deg: {
      aliases: [...alias("deg"), "grad", "grade", "graden", "°"],
      symbol: "°",
      forms: {
        "nom-one": "Grad",
        "nom-other": "Grad",
        "dat-one": "Grad",
        "dat-other": "Grad",
      },
    },
    // `das Gon` — the DIN 1315 name, coined precisely so that the gradian would
    // stop being called a `Grad`. `Neugrad` is the older German name and is
    // listed for reading; it is not printed, because it is the very spelling
    // that makes the confusion above possible.
    grad: {
      aliases: [...alias("grad"), "neugrad"],
      symbol: "gon",
      forms: {
        "nom-one": "Gon",
        "nom-other": "Gon",
        "dat-one": "Gon",
        "dat-other": "Gon",
      },
    },
    // The feminine one, and the only unit here whose number axis moves.
    // `Umdrehungen` serves as nominative and dative plural alike — a plural
    // already ending in `-n` leaves the dative nothing to add — so this unit
    // exercises exactly the axis the three above cannot.
    turn: {
      aliases: [...alias("turn"), "umdrehung", "umdrehungen", "u"],
      symbol: "U",
      forms: {
        "nom-one": "Umdrehung",
        "nom-other": "Umdrehungen",
        "dat-one": "Umdrehung",
        "dat-other": "Umdrehungen",
      },
    },
  },
});
