import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en` next door makes, kept for a *different* reason.
 *
 * In English, `in` is the conversion keyword, so `lex` emits it as a `keyword`
 * token and an `in` alias is unreachable on the engine path. Ukrainian's
 * conversion keywords are `в`/`у`/`до`, so nothing about the Ukrainian lexer
 * would shadow it — the entry would be perfectly reachable here.
 *
 * It stays out anyway, because `registry.aliasIndex` is one flat map and
 * `MatchCtx.isUnitAlias` reads it without consulting a locale. An engine with
 * both languages installed would therefore have the Ukrainian vocabulary put
 * `in` back into the index that `@smartput/datetime`'s accept-gate consults,
 * and "in 3 days" would read as an all-units phrase again — the exact
 * regression the `en` reservation exists to prevent, reintroduced from the side
 * the reservation does not cover. A Ukrainian reader types `дюйм`, so the
 * omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Ukrainian words for the length units — the same eight units `en` next door
 * names, each with the same answer to "does this unit have words at all?".
 * All eight do: Ukrainian declines every one of them, and nobody writes a
 * length the way they write `30 m²`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `2 km` keeps working in a Ukrainian engine
 * and the micro path (`parseLength`) cannot drift from it. The Cyrillic
 * spellings are appended, in every case a reader is plausibly going to type —
 * a vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper carries `weight: -2` precisely so an exact entry
 * here outranks anything it guesses.
 *
 * Eight `forms` keys per unit, because `ukrainian.selectForm` returns
 * `` `${case}-${category}` ``: the case from the slot (locative for a
 * conversion target, which is what `в` governs — "в 5 метрах", never "в 5
 * метрів"), the category from CLDR's four. Two rows are worth naming:
 *
 *   `nom-other` is the **fractional** category, and in Ukrainian that is the
 *   genitive *singular*: "1,5 метра", never "1,5 метрів". A plural there is
 *   the mistake no other test in this repo would catch.
 *
 *   `loc-other` is the count-free conversion target ("в метрах") — a unit word
 *   chosen with no magnitude in hand at all, which is the row the old
 *   one-dimensional `display` model had no way to express.
 *
 * Seven of the eight units are masculine `-r`/`-m`/`-d` nouns and share one
 * paradigm. `mi` is the exception and is not a variation on it: `миля` is
 * feminine, so its nominative plural and its genitive singular coincide
 * ("2 милі" and "1,5 милі" are the same string by grammar) where the masculine
 * ones diverge ("2 метри" against "1,5 метра"). Pasting either paradigm over
 * the other produces forms that look Ukrainian and are wrong.
 *
 * Like `en`, this file names `length` by id string and never imports the kind,
 * which is what lets `@smartput/length/locale/uk` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "length",
  units: {
    mm: {
      aliases: [
        ...alias("mm"),
        "мм",
        "міліметр",
        "міліметра",
        "міліметру",
        "міліметрі",
        "міліметри",
        "міліметрів",
        "міліметрам",
        "міліметрах",
        "міліметром",
        "міліметрами",
      ],
      symbol: "мм",
      forms: {
        "nom-one": "міліметр",
        "nom-few": "міліметри",
        "nom-many": "міліметрів",
        "nom-other": "міліметра",
        "loc-one": "міліметрі",
        "loc-few": "міліметрах",
        "loc-many": "міліметрах",
        "loc-other": "міліметрах",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "см",
        "сантиметр",
        "сантиметра",
        "сантиметру",
        "сантиметрі",
        "сантиметри",
        "сантиметрів",
        "сантиметрам",
        "сантиметрах",
        "сантиметром",
        "сантиметрами",
      ],
      symbol: "см",
      forms: {
        "nom-one": "сантиметр",
        "nom-few": "сантиметри",
        "nom-many": "сантиметрів",
        "nom-other": "сантиметра",
        "loc-one": "сантиметрі",
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
        "метрі",
        "метри",
        "метрів",
        "метрам",
        "метрах",
        "метром",
        "метрами",
      ],
      symbol: "м",
      forms: {
        "nom-one": "метр",
        "nom-few": "метри",
        "nom-many": "метрів",
        "nom-other": "метра",
        "loc-one": "метрі",
        "loc-few": "метрах",
        "loc-many": "метрах",
        "loc-other": "метрах",
      },
    },
    km: {
      aliases: [
        ...alias("km"),
        "км",
        "кілометр",
        "кілометра",
        "кілометру",
        "кілометрі",
        "кілометри",
        "кілометрів",
        "кілометрам",
        "кілометрах",
        "кілометром",
        "кілометрами",
      ],
      symbol: "км",
      forms: {
        "nom-one": "кілометр",
        "nom-few": "кілометри",
        "nom-many": "кілометрів",
        "nom-other": "кілометра",
        "loc-one": "кілометрі",
        "loc-few": "кілометрах",
        "loc-many": "кілометрах",
        "loc-other": "кілометрах",
      },
    },
    // The three imperial units have no accepted Ukrainian abbreviation — they
    // are written out — so each symbol is the nominative singular, the same
    // choice `en` makes for a unit whose "symbol" is just its word. R8 wants an
    // explicit symbol on every unit, not an invented one.
    in: {
      aliases: [
        ...alias("in"),
        "дюйм",
        "дюйма",
        "дюйму",
        "дюймі",
        "дюйми",
        "дюймів",
        "дюймам",
        "дюймах",
        "дюймом",
        "дюймами",
      ],
      symbol: "дюйм",
      forms: {
        "nom-one": "дюйм",
        "nom-few": "дюйми",
        "nom-many": "дюймів",
        "nom-other": "дюйма",
        "loc-one": "дюймі",
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
        "футі",
        "фути",
        "футів",
        "футам",
        "футах",
        "футом",
        "футами",
      ],
      symbol: "фут",
      forms: {
        "nom-one": "фут",
        "nom-few": "фути",
        "nom-many": "футів",
        "nom-other": "фута",
        "loc-one": "футі",
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
        "ярді",
        "ярди",
        "ярдів",
        "ярдам",
        "ярдах",
        "ярдом",
        "ярдами",
      ],
      symbol: "ярд",
      forms: {
        "nom-one": "ярд",
        "nom-few": "ярди",
        "nom-many": "ярдів",
        "nom-other": "ярда",
        "loc-one": "ярді",
        "loc-few": "ярдах",
        "loc-many": "ярдах",
        "loc-other": "ярдах",
      },
    },
    // The feminine one. `милі` fills four cells — genitive, dative and locative
    // singular *and* nominative plural — which is why "2 милі" and "1,5 милі"
    // agree here while "2 метри" and "1,5 метра" do not, and the genitive plural
    // is the bare stem `миль` rather than an `-ів` ending.
    mi: {
      aliases: [
        ...alias("mi"),
        "миля",
        "милі",
        "милю",
        "милею",
        "миль",
        "милям",
        "милях",
        "милями",
      ],
      symbol: "миля",
      forms: {
        "nom-one": "миля",
        "nom-few": "милі",
        "nom-many": "миль",
        "nom-other": "милі",
        "loc-one": "милі",
        "loc-few": "милях",
        "loc-many": "милях",
        "loc-other": "милях",
      },
    },
  },
});
