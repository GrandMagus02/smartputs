import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Russian words for the typographic units — the same six `en` next door names,
 * with the same answer to "does this unit have words at all?". All six do:
 * Russian declines every one of them.
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so `72 pt` keeps working in a Russian engine
 * and the micro path (`parseMeasure`) cannot drift from it. The Cyrillic
 * spellings are appended in every case a reader is plausibly going to type.
 *
 * Eight `forms` keys per unit, because `russian.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (prepositional for a
 * conversion target, which is what `в` governs — "в 72 пунктах"), the category
 * from CLDR's four. The key names are `uk`'s, `loc` standing for the case
 * Russian grammar calls the prepositional, and `@smartput/core/locale/ru`
 * records that ruling.
 *
 * Two rows are the ones a translator gets wrong. `nom-few` — the 2/3/4 row — is
 * a genitive **singular** in Russian, so "2 пункта" is the same word as
 * "1,5 пункта" and a different word from "1 пункт"; Ukrainian puts a nominative
 * plural there ("2 пункти") and groups the four nominative cells the other way
 * round. And `nom-other` is the fractional row, genitive singular again:
 * "1,5 дюйма", never "1,5 дюймов".
 *
 * Three of the six are not variations on the masculine hard paradigm the other
 * three share:
 *
 *   `пика` is feminine, so its nominative plural and genitive singular coincide
 *   in "пики" and its genitive plural is the bare stem "пик" rather than an -ов
 *   ending. Its prepositional singular is a plain "пике" — Russian does **not**
 *   take the к→ц alternation Ukrainian's `піка`/`піці` does, and copying that
 *   cell across from `uk.ts` would print "в 1 пице", which is not a word.
 *
 *   `пиксель` is a soft-stem masculine, so its genitive plural is "пикселей"
 *   in -ей where the hard stems take -ов, and its plural nominative is
 *   "пиксели".
 *
 *   `дюйм` and the two metric units are ordinary hard stems.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what a Russian
 * designer writes in a stylesheet, and inventing `пкс` would be a word this file
 * made up rather than one anybody types. The metric two get their conventional
 * Cyrillic abbreviations and the inch gets its noun, which is the same choice
 * `@smartput/length/locale/ru` makes for the same reason. Every symbol here is
 * also an alias, which is what `assertLocaleContract` checks: a printed string
 * the engine cannot read back is the failure.
 *
 * Like `en`, this file names `measure` by id string and never imports the kind.
 * `composeLocale` is where the two halves meet — and, as there, a caller has to
 * ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS` because
 * its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/ru` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "measure",
  units: {
    inch: {
      aliases: [
        ...alias("inch"),
        "дюйм",
        "дюйма",
        "дюйму",
        "дюйме",
        "дюймом",
        "дюймы",
        "дюймов",
        "дюймам",
        "дюймах",
        "дюймами",
      ],
      symbol: "дюйм",
      forms: {
        "nom-one": "дюйм",
        "nom-few": "дюйма",
        "nom-many": "дюймов",
        "nom-other": "дюйма",
        "loc-one": "дюйме",
        "loc-few": "дюймах",
        "loc-many": "дюймах",
        "loc-other": "дюймах",
      },
    },
    mm: {
      aliases: [
        ...alias("mm"),
        "мм",
        "миллиметр",
        "миллиметра",
        "миллиметру",
        "миллиметре",
        "миллиметром",
        "миллиметры",
        "миллиметров",
        "миллиметрам",
        "миллиметрах",
        "миллиметрами",
      ],
      symbol: "мм",
      forms: {
        "nom-one": "миллиметр",
        "nom-few": "миллиметра",
        "nom-many": "миллиметров",
        "nom-other": "миллиметра",
        "loc-one": "миллиметре",
        "loc-few": "миллиметрах",
        "loc-many": "миллиметрах",
        "loc-other": "миллиметрах",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "см",
        "сантиметр",
        "сантиметра",
        "сантиметру",
        "сантиметре",
        "сантиметром",
        "сантиметры",
        "сантиметров",
        "сантиметрам",
        "сантиметрах",
        "сантиметрами",
      ],
      symbol: "см",
      forms: {
        "nom-one": "сантиметр",
        "nom-few": "сантиметра",
        "nom-many": "сантиметров",
        "nom-other": "сантиметра",
        "loc-one": "сантиметре",
        "loc-few": "сантиметрах",
        "loc-many": "сантиметрах",
        "loc-other": "сантиметрах",
      },
    },
    pt: {
      aliases: [
        ...alias("pt"),
        "пункт",
        "пункта",
        "пункту",
        "пункте",
        "пунктом",
        "пункты",
        "пунктов",
        "пунктам",
        "пунктах",
        "пунктами",
      ],
      symbol: "pt",
      forms: {
        "nom-one": "пункт",
        "nom-few": "пункта",
        "nom-many": "пунктов",
        "nom-other": "пункта",
        "loc-one": "пункте",
        "loc-few": "пунктах",
        "loc-many": "пунктах",
        "loc-other": "пунктах",
      },
    },
    // The feminine one — and, unlike Ukrainian's `піка`, with no к→ц alternation
    // in the prepositional singular: Russian says "в пике".
    pc: {
      aliases: [
        ...alias("pc"),
        "пика",
        "пики",
        "пике",
        "пику",
        "пикой",
        "пик",
        "пикам",
        "пиках",
        "пиками",
      ],
      symbol: "pc",
      forms: {
        "nom-one": "пика",
        "nom-few": "пики",
        "nom-many": "пик",
        "nom-other": "пики",
        "loc-one": "пике",
        "loc-few": "пиках",
        "loc-many": "пиках",
        "loc-other": "пиках",
      },
    },
    // Soft-stem masculine: the genitive plural is `пикселей` in -ей, not the -ов
    // the hard stems above take, and the nominative plural is `пиксели`.
    px: {
      aliases: [
        ...alias("px"),
        "пиксель",
        "пикселя",
        "пикселю",
        "пикселе",
        "пикселем",
        "пиксели",
        "пикселей",
        "пикселям",
        "пикселях",
        "пикселями",
      ],
      symbol: "px",
      forms: {
        "nom-one": "пиксель",
        "nom-few": "пикселя",
        "nom-many": "пикселей",
        "nom-other": "пикселя",
        "loc-one": "пикселе",
        "loc-few": "пикселях",
        "loc-many": "пикселях",
        "loc-other": "пикселях",
      },
    },
  },
});
