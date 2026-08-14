import { aliasesFor, defineVocabulary } from "@smartput/core";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en` next door makes, kept for a *different* reason.
 *
 * In English, `in` is the conversion keyword, so `lex` emits it as a `keyword`
 * token and an `in` alias is unreachable on the engine path. Russian's
 * conversion keywords are `в`/`у`/`до`, so nothing about the Russian lexer would
 * shadow it — the entry would be perfectly reachable here.
 *
 * It stays out anyway, because `registry.aliasIndex` is one flat map and
 * `MatchCtx.isUnitAlias` reads it without consulting a locale. An engine with
 * both languages installed would therefore have the Russian vocabulary put `in`
 * back into the index that `@smartput/datetime`'s accept-gate consults, and "in
 * 3 days" would read as an all-units phrase again — the exact regression the
 * `en` reservation exists to prevent, reintroduced from the side the reservation
 * does not cover. `@smartput/length/locale/uk` leaves it out for this same
 * reason, and a Russian reader types `дюйм`, so the omission costs this
 * vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Russian words for the length units — the same eight units `en` next door
 * names, each with the same answer to "does this unit have words at all?". All
 * eight do: Russian declines every one of them as a single word, and nobody
 * writes a length the way they write `30 м²`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `2 km` keeps working in a Russian engine and
 * the micro path (`parseLength`) cannot drift from it. The Cyrillic spellings
 * are appended, in every case a reader is plausibly going to type — a vocabulary
 * is what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper carries `weight: -2` precisely so an exact entry here outranks
 * anything it guesses.
 *
 * Eight `forms` keys per unit, because `russian.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (prepositional for a
 * conversion target, which is what `в` governs — "в 5 метрах", never "в 5
 * метров"), the category from CLDR's four. The key names are `uk`'s — `loc` for
 * the case Russian grammar calls the prepositional — and
 * `@smartput/core/locale/ru` records that ruling in full. Two rows are worth
 * naming:
 *
 *   `nom-few` is the 2/3/4 row, and in Russian it is a genitive **singular**:
 *   "2 метра". Ukrainian puts a nominative plural there ("2 метри"), so the two
 *   languages do not even group these cells the same way — here `nom-few` and
 *   `nom-other` hold one word and `nom-one` another, and next door it is the
 *   other way round. That is the single most consequential difference between
 *   the two files and the reason this one is not a respelling.
 *
 *   `nom-other` is the **fractional** category, genitive singular again:
 *   "1,5 метра", never "1,5 метров". A plural there is the mistake no other test
 *   in this repo would catch, because it is a real word standing in a cell that
 *   wants a different real word.
 *
 *   `loc-other` is the count-free conversion target ("в метрах") — a unit word
 *   chosen with no magnitude in hand at all, which is the row the old
 *   one-dimensional `display` model had no way to express.
 *
 * Seven of the eight units are masculine hard stems and share one paradigm:
 * genitive singular -а, genitive plural -ов, prepositional singular -е. `mi` is
 * the exception and is not a variation on it: `миля` is feminine, so its
 * nominative plural and its genitive singular coincide in "мили", its genitive
 * plural is the bare stem "миль" with no ending at all, and its prepositional
 * singular is "миле". Pasting either paradigm over the other produces forms that
 * look Russian and are wrong.
 *
 * The colloquial zero-ending genitive plurals — "5 фут", "5 метр" — need no
 * entry of their own, because each is spelled like the nominative singular that
 * is already an alias. The written norms `футов` and `метров` are what print.
 *
 * Like `en`, this file names `length` by id string and never imports the kind,
 * which is what lets `@smartput/length/locale/ru` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "length",
  units: {
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
    // `м` is claimed here and nowhere else in this kind: the three prefixed
    // units are `мм`/`см`/`км`, so the one-letter symbol has no rival to be
    // resolved against.
    m: {
      aliases: [
        ...alias("m"),
        "м",
        "метр",
        "метра",
        "метру",
        "метре",
        "метром",
        "метры",
        "метров",
        "метрам",
        "метрах",
        "метрами",
      ],
      symbol: "м",
      forms: {
        "nom-one": "метр",
        "nom-few": "метра",
        "nom-many": "метров",
        "nom-other": "метра",
        "loc-one": "метре",
        "loc-few": "метрах",
        "loc-many": "метрах",
        "loc-other": "метрах",
      },
    },
    km: {
      aliases: [
        ...alias("km"),
        "км",
        "километр",
        "километра",
        "километру",
        "километре",
        "километром",
        "километры",
        "километров",
        "километрам",
        "километрах",
        "километрами",
      ],
      symbol: "км",
      forms: {
        "nom-one": "километр",
        "nom-few": "километра",
        "nom-many": "километров",
        "nom-other": "километра",
        "loc-one": "километре",
        "loc-few": "километрах",
        "loc-many": "километрах",
        "loc-other": "километрах",
      },
    },
    // The three imperial units have no accepted Russian abbreviation — they are
    // written out — so each symbol is the nominative singular, the same choice
    // `en` makes for a unit whose "symbol" is just its word. R8 wants an
    // explicit symbol on every unit, not an invented one.
    in: {
      aliases: [
        ...alias("in"),
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
    ft: {
      aliases: [
        ...alias("ft"),
        "фут",
        "фута",
        "футу",
        "футе",
        "футом",
        "футы",
        "футов",
        "футам",
        "футах",
        "футами",
      ],
      symbol: "фут",
      forms: {
        "nom-one": "фут",
        "nom-few": "фута",
        "nom-many": "футов",
        "nom-other": "фута",
        "loc-one": "футе",
        "loc-few": "футах",
        "loc-many": "футах",
        "loc-other": "футах",
      },
    },
    yd: {
      aliases: [
        ...alias("yd"),
        "ярд",
        "ярда",
        "ярду",
        "ярде",
        "ярдом",
        "ярды",
        "ярдов",
        "ярдам",
        "ярдах",
        "ярдами",
      ],
      symbol: "ярд",
      forms: {
        "nom-one": "ярд",
        "nom-few": "ярда",
        "nom-many": "ярдов",
        "nom-other": "ярда",
        "loc-one": "ярде",
        "loc-few": "ярдах",
        "loc-many": "ярдах",
        "loc-other": "ярдах",
      },
    },
    // The feminine one. `мили` fills three cells — genitive singular, dative
    // singular and nominative plural — which is why "2 мили" and "1,5 мили"
    // agree here while "2 метра" and "1,5 метра" agree for the opposite reason
    // (they are the *same* cell). The genitive plural is the bare stem `миль`
    // rather than an `-ов` ending, and the prepositional singular is `миле`,
    // which no ending applied to a masculine stem would produce.
    mi: {
      aliases: [
        ...alias("mi"),
        "миля",
        "мили",
        "миле",
        "милю",
        "милей",
        "миль",
        "милям",
        "милях",
        "милями",
      ],
      symbol: "миля",
      forms: {
        "nom-one": "миля",
        "nom-few": "мили",
        "nom-many": "миль",
        "nom-other": "мили",
        "loc-one": "миле",
        "loc-few": "милях",
        "loc-many": "милях",
        "loc-other": "милях",
      },
    },
  },
});
