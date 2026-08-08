import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Ukrainian words for the duration units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table, and that difference is the whole reason Ukrainian is in this
 * plan.
 *
 * **Eight keys, not two.** `ukrainian.selectForm` answers
 * `` `${case}-${category}` ``: the case from the slot (`loc` for a conversion
 * target, `nom` otherwise) and the category from CLDR's four Ukrainian plural
 * classes. So each unit needs all eight, and the four `nom` rows are four
 * genuinely different words:
 *
 * ```
 * nom-one    1, 21, 31      nominative singular   "1 година"
 * nom-few    2, 3, 4, 22    nominative plural     "2 години"
 * nom-many   0, 5–20, 100   genitive plural       "5 годин"
 * nom-other  1,5            genitive SINGULAR     "1,5 години"
 * ```
 *
 * `nom-other` is the row that punishes a translator for pattern-matching: it is
 * a *singular*, and filling it with the plural prints "1,5 годин" at a user.
 *
 * The four `loc` rows are locative, because that is the case `в` governs — "в 5
 * годинах", never "в 5 годин" — and `loc-other` is the one a count-free
 * conversion target lands on ("в годинах"). That row is what the old
 * one-dimensional `display` model had no way to express at all.
 *
 * **Gender matters here.** Four of the six units are feminine first-declension
 * nouns (мілісекунда, секунда, хвилина, година), where the nominative plural
 * and the genitive singular are the *same* string — "2 години" and "1,5
 * години" — so `nom-few` and `nom-other` coincide. The masculine two do not
 * behave that way: день and тиждень keep them apart ("2 дні" against "1,5
 * дня"), and both drop the fill vowel of the nominative singular in every other
 * form (день → дні/днів, тиждень → тижні/тижнів). Copying one gender's pattern
 * onto the other is a mistake no test in this repo can see, which is why the
 * two groups are commented separately below.
 *
 * **Both scripts read.** The Latin aliases are kept rather than replaced: a
 * Ukrainian keyboard produces "2 год" and a Ukrainian developer types "2 h", so
 * a `uk` engine has to accept both. The Cyrillic side lists the inflections a
 * reader is actually expected to type — the vocabulary is what the language's
 * suffix stripper falls back *from*, not a stem list for it.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "duration",
  units: {
    // The feminine four. Note `nom-few` === `nom-other` throughout: for a
    // first-declension feminine noun the nominative plural and the genitive
    // singular are spelled alike, so the pair that separates them in the
    // masculine units below is a single string here. That is a fact about
    // Ukrainian, not a shortcut — the eight keys are still eight decisions.
    ms: {
      aliases: [
        ...alias("ms"),
        "мс",
        "мілісекунда",
        "мілісекунди",
        "мілісекунд",
        "мілісекунду",
        "мілісекунді",
        "мілісекундах",
      ],
      symbol: "мс",
      forms: {
        "nom-one": "мілісекунда",
        "nom-few": "мілісекунди",
        "nom-many": "мілісекунд",
        "nom-other": "мілісекунди",
        "loc-one": "мілісекунді",
        "loc-few": "мілісекундах",
        "loc-many": "мілісекундах",
        "loc-other": "мілісекундах",
      },
    },
    s: {
      // "сек" is the clipped form a Ukrainian writes as often as the symbol, and
      // it is not derivable from "с" by any stripper.
      aliases: [
        ...alias("s"),
        "с",
        "сек",
        "секунда",
        "секунди",
        "секунд",
        "секунду",
        "секунді",
        "секундах",
      ],
      symbol: "с",
      forms: {
        "nom-one": "секунда",
        "nom-few": "секунди",
        "nom-many": "секунд",
        "nom-other": "секунди",
        "loc-one": "секунді",
        "loc-few": "секундах",
        "loc-many": "секундах",
        "loc-other": "секундах",
      },
    },
    min: {
      aliases: [
        ...alias("min"),
        "хв",
        "хвилина",
        "хвилини",
        "хвилин",
        "хвилину",
        "хвилині",
        "хвилинах",
      ],
      symbol: "хв",
      forms: {
        "nom-one": "хвилина",
        "nom-few": "хвилини",
        "nom-many": "хвилин",
        "nom-other": "хвилини",
        "loc-one": "хвилині",
        "loc-few": "хвилинах",
        "loc-many": "хвилинах",
        "loc-other": "хвилинах",
      },
    },
    h: {
      aliases: [
        ...alias("h"),
        "год",
        "година",
        "години",
        "годин",
        "годину",
        "годині",
        "годинах",
      ],
      symbol: "год",
      forms: {
        "nom-one": "година",
        "nom-few": "години",
        "nom-many": "годин",
        "nom-other": "години",
        "loc-one": "годині",
        "loc-few": "годинах",
        "loc-many": "годинах",
        "loc-other": "годинах",
      },
    },
    // The masculine two. Both have a fill vowel that exists only in the
    // nominative singular (день → дн-, тиждень → тижн-), and both keep
    // `nom-few` and `nom-other` distinct: "2 дні" is a nominative plural,
    // "1,5 дня" a genitive singular.
    d: {
      // "доба" is a synonym rather than an inflection — the word Ukrainian
      // actually reaches for when it means a 24-hour span ("3 доби", "5 діб") —
      // and it is listed because recognition is many-to-one (I6) while
      // generation stays the single `forms` table. Its own genitive plural is
      // "діб", which no stripper would find from "доба".
      aliases: [
        ...alias("d"),
        "д",
        "дн",
        "день",
        "дня",
        "дні",
        "днів",
        "дню",
        "днях",
        "доба",
        "доби",
        "діб",
        "добу",
        "добі",
        "добах",
      ],
      symbol: "д",
      forms: {
        "nom-one": "день",
        "nom-few": "дні",
        "nom-many": "днів",
        "nom-other": "дня",
        "loc-one": "дні",
        "loc-few": "днях",
        "loc-many": "днях",
        "loc-other": "днях",
      },
    },
    wk: {
      aliases: [
        ...alias("wk"),
        "тиж",
        "тиждень",
        "тижня",
        "тижні",
        "тижнів",
        "тижню",
        "тижнях",
      ],
      symbol: "тиж",
      forms: {
        "nom-one": "тиждень",
        "nom-few": "тижні",
        "nom-many": "тижнів",
        "nom-other": "тижня",
        "loc-one": "тижні",
        "loc-few": "тижнях",
        "loc-many": "тижнях",
        "loc-other": "тижнях",
      },
    },
  },
});
