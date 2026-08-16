import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Polish words for the duration units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table.
 *
 * **Eight keys, not two.** `polish.selectForm` answers
 * `` `${case}-${category}` ``: the case from the slot (`loc` for a conversion
 * target, `nom` otherwise) and the category from CLDR's four Polish plural
 * classes. So each unit needs all eight, and the four `nom` rows are four
 * separate decisions:
 *
 * ```
 * nom-one    1                    nominative singular   "1 godzina"
 * nom-few    2–4, 22–24, 102–104  nominative PLURAL     "2 godziny"
 * nom-many   0, 5–21, 12–14, 25+  genitive plural       "5 godzin"
 * nom-other  1,5                  genitive singular     "1,5 godziny"
 * ```
 *
 * **`nom-many` reaches 21**, and that is the row a Slavic translator gets wrong
 * from memory. Ukrainian and Russian both agree 21 with the singular ("21
 * година", "21 час"); Polish says "dwadzieścia jeden godzin", genitive plural,
 * and every -1 above twenty goes the same way — 31, 101, 1001. A table ported
 * from `uk.ts` or `ru.ts` by swapping stems prints the nominative singular in
 * all of those cells, which reads as a typo rather than as a bug.
 * `polish.selectForm` records the boundary; this table is keyed against it.
 *
 * **`nom-few` is a real nominative plural.** Polish "2 godziny" is the plural of
 * "godzina"; Russian's same cell holds a genitive singular. That the two happen
 * to be spelled alike for a Polish feminine noun — the nominative plural and the
 * genitive singular of `godzina` are both "godziny" — is a fact about the
 * first-declension paradigm and not about the categories. It stops being true
 * the moment the noun is masculine: `dzień` writes "2 dni" in `nom-few` and
 * "1,5 dnia" in `nom-other`, two different words. The masculine pair below is
 * therefore the only place this table can be checked for that mistake, which is
 * why `pl.test.ts` checks it there.
 *
 * **`nom-other` is the fractional row**, and CLDR's name for it is the reason it
 * gets written wrongly: "other" sounds like a plural and Polish fills it with a
 * genitive **singular**. "1,5 godziny", never "1,5 godzin". No shape-based test
 * can see the difference — both spellings read back to the same unit — so the
 * only guard is a fractional count in the contract check and an explicit
 * assertion, both of which `pl.test.ts` carries.
 *
 * The four `loc` rows are the locative, because that is the case `w` governs —
 * "w 5 godzinach", never "w 5 godzin" — and `w` is the word generation actually
 * emits, being the first this language declares under `in`. `loc-other` is the
 * row a count-free conversion target lands on ("w godzinach"), which the old
 * one-dimensional `display` model could not express at all. **It is not the same
 * word as `nom-other`**: that one is a genitive singular reached only by a
 * fraction, this one a locative plural reached only without a count. Filling
 * both from one word is the mistake the two-axis key set exists to expose.
 *
 * `loc-one` is worth its own line, because it is the row nothing could have
 * guessed. Polish softens the stem-final consonant before the locative `-e`:
 * `minuta` → "minucie", `sekunda` → "sekundzie", `godzina` → "godzinie". Only
 * the last of those three leaves a suffix boundary a stripper could find, so all
 * of them are listed as aliases rather than hoped for — the check that a printed
 * form is a read form is what catches it, and it is in `pl.test.ts`.
 *
 * **Gender and stem changes matter here.** Four of the six units are feminine
 * first-declension nouns (milisekunda, sekunda, minuta, godzina), whose genitive
 * plural is a bare stem with no ending at all — "5 sekund", "5 godzin" — the
 * opposite of the masculine -ów. The two masculines are irregular and irregular
 * differently from each other: `dzień` loses its fleeting `e` everywhere but the
 * nominative singular and has "dni" for *both* its nominative and its genitive
 * plural, so `nom-few` and `nom-many` coincide; `tydzień` changes stem outright
 * (tydzień → tygodnia, tygodnie, tygodni) and keeps them apart. Copying one
 * paradigm onto the other is a mistake nothing in this repo can catch, which is
 * why the groups are commented separately below.
 *
 * **Both spellings read.** The Latin/English aliases are kept rather than
 * replaced: a Polish developer types "2 h" and "90 min" without thinking about
 * it, and `aliasesFor` is what keeps the micro path (`parseDuration`) and the
 * engine path agreeing by construction. The Polish side lists the inflections a
 * reader is actually expected to type — the vocabulary is what the language's
 * suffix stripper falls back *from*, at a `-2` penalty, not a stem list for it.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "duration",
  units: {
    // The feminine four. `nom-few` and `nom-other` are spelled alike throughout
    // this group — the nominative plural and the genitive singular of a
    // first-declension noun are both -y/-i — and that is a coincidence of the
    // paradigm, not of the categories. See `d` and `wk` below, where the same
    // two cells hold different words.
    //
    // The genitive plural is a *bare stem*: "5 sekund", with no ending at all
    // where a masculine takes -ów. Nothing can strip its way to a bare stem, so
    // it is one of the forms this file must list rather than leave to the
    // analyzer chain.
    ms: {
      aliases: [
        ...alias("ms"),
        "milisekunda",
        "milisekundy",
        "milisekundę",
        "milisekundzie",
        "milisekundą",
        "milisekund",
        "milisekundom",
        "milisekundach",
        "milisekundami",
      ],
      symbol: "ms",
      forms: {
        "nom-one": "milisekunda",
        "nom-few": "milisekundy",
        "nom-many": "milisekund",
        "nom-other": "milisekundy",
        "loc-one": "milisekundzie",
        "loc-few": "milisekundach",
        "loc-many": "milisekundach",
        "loc-other": "milisekundach",
      },
    },
    s: {
      // "sek" is the clipped form a Polish stopwatch label uses as readily as
      // the SI "s", and it is not derivable from "s" by any stripper.
      aliases: [
        ...alias("s"),
        "sek",
        "sekunda",
        "sekundy",
        "sekundę",
        "sekundzie",
        "sekundą",
        "sekund",
        "sekundom",
        "sekundach",
        "sekundami",
      ],
      symbol: "s",
      forms: {
        "nom-one": "sekunda",
        "nom-few": "sekundy",
        "nom-many": "sekund",
        "nom-other": "sekundy",
        "loc-one": "sekundzie",
        "loc-few": "sekundach",
        "loc-many": "sekundach",
        "loc-other": "sekundach",
      },
    },
    min: {
      // The locative softens `t` to `ci`, so "minucie" shares no suffix boundary
      // with "minuta" and no ending table could have produced it.
      aliases: [
        ...alias("min"),
        "minuta",
        "minuty",
        "minutę",
        "minucie",
        "minutą",
        "minut",
        "minutom",
        "minutach",
        "minutami",
      ],
      symbol: "min",
      forms: {
        "nom-one": "minuta",
        "nom-few": "minuty",
        "nom-many": "minut",
        "nom-other": "minuty",
        "loc-one": "minucie",
        "loc-few": "minutach",
        "loc-many": "minutach",
        "loc-other": "minutach",
      },
    },
    // The symbol is "h" and not "godz.", and the reason is the lexer rather than
    // an opinion about Polish. "godz." is what a Polish timetable prints, and a
    // dot cannot be in a symbol: "." is not a letter, so `parse/lex.ts` ends the
    // word token there and a printed "5 godz." would come back as "godz"
    // followed by a stray character. "h" is the SI symbol, is what a Polish
    // spreadsheet and a Polish datasheet both write, and is already a derived
    // alias — which is the mechanism by which a `symbols: true` print parses
    // back. The dotless contraction "godz" is listed as an alias so a reader who
    // drops the dot is understood.
    h: {
      aliases: [
        ...alias("h"),
        "godz",
        "godzina",
        "godziny",
        "godzinę",
        "godzinie",
        "godziną",
        "godzin",
        "godzinom",
        "godzinach",
        "godzinami",
      ],
      symbol: "h",
      forms: {
        "nom-one": "godzina",
        "nom-few": "godziny",
        "nom-many": "godzin",
        "nom-other": "godziny",
        "loc-one": "godzinie",
        "loc-few": "godzinach",
        "loc-many": "godzinach",
        "loc-other": "godzinach",
      },
    },
    // The masculine two, and they do not share a paradigm with each other
    // either.
    //
    // `dzień` has a fleeting `e` that exists only in the nominative singular
    // (dzień → dnia, dniowi, dniu, dni, dniach) and — the row worth naming — one
    // spelling "dni" for *both* its nominative plural and its genitive plural.
    // So `nom-few` and `nom-many` coincide here: "2 dni" and "5 dni" really are
    // written alike, which is a fact about this noun and not a hole in the
    // table. `nom-other` does not join them: a fraction takes the genitive
    // singular, "1,5 dnia".
    //
    // The symbol is "d" rather than "dn." for the dot reason `h` records one
    // entry up, and "d" is already a derived alias so the round trip closes.
    d: {
      aliases: [
        ...alias("d"),
        "dzień",
        "dnia",
        "dniowi",
        "dniu",
        "dniem",
        "dni",
        "dniom",
        "dniach",
        "dniami",
      ],
      symbol: "d",
      forms: {
        "nom-one": "dzień",
        "nom-few": "dni",
        "nom-many": "dni",
        "nom-other": "dnia",
        "loc-one": "dniu",
        "loc-few": "dniach",
        "loc-many": "dniach",
        "loc-other": "dniach",
      },
    },
    // `tydzień` changes stem outright rather than merely dropping a vowel:
    // everything but the nominative singular is built on `tygodni-` (tygodnia,
    // tygodniowi, tygodniu, tygodnie, tygodni, tygodniach). No ending table
    // reaches "tygodnia" from "tydzień", so every cell is written out and every
    // one of them is listed as an alias.
    //
    // Here `nom-few` and `nom-many` are two different words — "2 tygodnie"
    // against "5 tygodni" — which is what makes this unit and `d` above the pair
    // that proves the category boundary rather than merely restating it.
    //
    // The symbol is the dotless "tyg", for the same reason `h` gives: Polish
    // writes "tyg." and "tydz." with a dot, and a dot ends the word token. Both
    // dotless contractions are listed as aliases so the printed symbol parses
    // back and so a reader who types the other one is understood.
    wk: {
      aliases: [
        ...alias("wk"),
        "tyg",
        "tydz",
        "tydzień",
        "tygodnia",
        "tygodniowi",
        "tygodniu",
        "tygodniem",
        "tygodnie",
        "tygodni",
        "tygodniom",
        "tygodniach",
        "tygodniami",
      ],
      symbol: "tyg",
      forms: {
        "nom-one": "tydzień",
        "nom-few": "tygodnie",
        "nom-many": "tygodni",
        "nom-other": "tygodnia",
        "loc-one": "tygodniu",
        "loc-few": "tygodniach",
        "loc-many": "tygodniach",
        "loc-other": "tygodniach",
      },
    },
  },
});
