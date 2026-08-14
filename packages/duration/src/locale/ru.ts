import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Russian words for the duration units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table.
 *
 * **Eight keys, not two.** `russian.selectForm` answers
 * `` `${case}-${category}` ``: the case from the slot (`loc` for a conversion
 * target, `nom` otherwise) and the category from CLDR's four Russian plural
 * classes. So each unit needs all eight, and the four `nom` rows are four
 * separate decisions:
 *
 * ```
 * nom-one    1, 21, 31      nominative singular   "1 час"
 * nom-few    2, 3, 4, 22    genitive SINGULAR     "2 часа"
 * nom-many   0, 5–20, 100   genitive plural       "5 часов"
 * nom-other  1,5            genitive singular     "1,5 часа"
 * ```
 *
 * `nom-few` is the row that separates Russian from Ukrainian, and it separates
 * them at the level of what the cell *is* rather than of how it is spelled: `uk`
 * fills it with a nominative plural ("2 години"), Russian fills it with a
 * genitive singular ("2 часа"). So in Russian `nom-few` and `nom-other`
 * coincide for every noun in this file, while in Ukrainian they coincide only
 * for the feminines. A table ported by swapping stems gets this wrong silently.
 *
 * `nom-other` is the row that punishes pattern-matching in either language: CLDR
 * calls the fractional category "other", and Russian fills it with a singular.
 * Writing the plural there prints "1,5 часов" at a user, and no shape-based test
 * can see it — both spellings read back to the same unit.
 *
 * The four `loc` rows are prepositional, because that is the case `в` governs —
 * "в 5 часах", never "в 5 часов" — and `loc-other` is the row a count-free
 * conversion target lands on ("в часах"), which the old one-dimensional
 * `display` model could not express at all. The key is labelled `loc` rather
 * than `prep`, the accurate Russian name, so that the two Slavic vocabularies
 * stay portable one into the other; `@smartput/core/locale/ru` argues that
 * choice at length.
 *
 * **Gender and stem changes matter here.** Four of the six units are feminine
 * first-declension nouns (миллисекунда, секунда, минута, неделя), whose genitive
 * plural is a bare stem — "5 секунд", "5 минут" — except `неделя`, whose soft
 * stem cannot end in a consonant cluster and takes a fill vowel plus a soft
 * sign instead: "5 недель", never the stripped "недл". The masculines behave
 * differently again, and differently from each other: `час` is a plain
 * hard stem with an -ов genitive plural, while `день` drops its fill vowel
 * everywhere but the nominative singular (день → дня, дней, днях) and takes the
 * soft -ей plural. Copying one paradigm onto another is a mistake nothing in
 * this repo can catch, which is why the groups are commented separately below.
 *
 * **Both scripts read.** The Latin aliases are kept rather than replaced: a
 * Russian keyboard produces "2 ч" and a Russian developer types "2 h", so a `ru`
 * engine has to accept both. The Cyrillic side lists the inflections a reader is
 * actually expected to type — the vocabulary is what the language's suffix
 * stripper falls back *from*, at a `-2` penalty, not a stem list for it.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "duration",
  units: {
    // The feminine four. `nom-few` === `nom-other` throughout, because both
    // cells hold the genitive singular; the pair is distinguished nowhere in
    // Russian, unlike Ukrainian where the masculines keep them apart. The
    // genitive plural is the bare stem for three of them and a fill-vowel form
    // for `неделя`.
    ms: {
      aliases: [
        ...alias("ms"),
        "мс",
        "миллисекунда",
        "миллисекунды",
        "миллисекунду",
        "миллисекунде",
        "миллисекундой",
        "миллисекунд",
        "миллисекундам",
        "миллисекундах",
        "миллисекундами",
      ],
      symbol: "мс",
      forms: {
        "nom-one": "миллисекунда",
        "nom-few": "миллисекунды",
        "nom-many": "миллисекунд",
        "nom-other": "миллисекунды",
        "loc-one": "миллисекунде",
        "loc-few": "миллисекундах",
        "loc-many": "миллисекундах",
        "loc-other": "миллисекундах",
      },
    },
    s: {
      // "сек" is the clipped form a Russian writes as often as the GOST symbol,
      // and it is not derivable from "с" by any stripper.
      aliases: [
        ...alias("s"),
        "с",
        "сек",
        "секунда",
        "секунды",
        "секунду",
        "секунде",
        "секундой",
        "секунд",
        "секундам",
        "секундах",
        "секундами",
      ],
      symbol: "с",
      forms: {
        "nom-one": "секунда",
        "nom-few": "секунды",
        "nom-many": "секунд",
        "nom-other": "секунды",
        "loc-one": "секунде",
        "loc-few": "секундах",
        "loc-many": "секундах",
        "loc-other": "секундах",
      },
    },
    min: {
      aliases: [
        ...alias("min"),
        "мин",
        "минута",
        "минуты",
        "минуту",
        "минуте",
        "минутой",
        "минут",
        "минутам",
        "минутах",
        "минутами",
      ],
      symbol: "мин",
      forms: {
        "nom-one": "минута",
        "nom-few": "минуты",
        "nom-many": "минут",
        "nom-other": "минуты",
        "loc-one": "минуте",
        "loc-few": "минутах",
        "loc-many": "минутах",
        "loc-other": "минутах",
      },
    },
    // Feminine, but soft-stemmed: the genitive plural inserts a fill vowel and
    // ends in a soft sign — "5 недель" — where the three hard feminines above
    // simply drop their ending.
    wk: {
      aliases: [
        ...alias("wk"),
        "нед",
        "неделя",
        "недели",
        "неделю",
        "неделе",
        "неделей",
        "недель",
        "неделям",
        "неделях",
        "неделями",
      ],
      symbol: "нед",
      forms: {
        "nom-one": "неделя",
        "nom-few": "недели",
        "nom-many": "недель",
        "nom-other": "недели",
        "loc-one": "неделе",
        "loc-few": "неделях",
        "loc-many": "неделях",
        "loc-other": "неделях",
      },
    },
    // The masculine two, and they do not share a paradigm with each other
    // either.
    //
    // `час` is a plain hard stem: genitive singular "часа", genitive plural
    // "часов", prepositional singular "часе". That last one is worth a note,
    // because Russian has a second locative for this noun — "в первом часу",
    // the time of day — and it is not the form wanted here. A conversion target
    // means "в часе шестьдесят минут", the container reading, which takes the
    // ordinary prepositional "часе". "часу" is listed as an alias so a reader
    // who types it is understood; nothing prints it.
    h: {
      aliases: [
        ...alias("h"),
        "ч",
        "час",
        "часа",
        "часу",
        "часе",
        "часом",
        "часы",
        "часов",
        "часам",
        "часах",
        "часами",
      ],
      symbol: "ч",
      forms: {
        "nom-one": "час",
        "nom-few": "часа",
        "nom-many": "часов",
        "nom-other": "часа",
        "loc-one": "часе",
        "loc-few": "часах",
        "loc-many": "часах",
        "loc-other": "часах",
      },
    },
    // `день` has a fleeting `е` that exists only in the nominative singular
    // (день → дня, дню, дне, дни, дней, днях) and a soft genitive plural in
    // -ей. Neither is derivable from the other by any ending table, which is
    // why every cell is written out.
    //
    // "сутки" is a synonym rather than an inflection — the word Russian reaches
    // for when it means a 24-hour span, and a plurale tantum with a genitive
    // plural of its own ("5 суток") that no stripper would find from "сутки".
    // It is listed because recognition is many-to-one (I6) while generation
    // stays the single `forms` table.
    //
    // The symbol is "дн" rather than "д". Russian writes the abbreviation with
    // a dot ("дн."), and a dot cannot be in a symbol: "." is not a letter, so
    // `parse/lex.ts` ends the word token there and a printed "5 дн." would come
    // back as "дн" followed by a stray character. The dotless contraction is one
    // letter run, one token, and it is listed in `aliases` so the round trip
    // closes; "д" is listed beside it as the shorter spelling people type.
    d: {
      aliases: [
        ...alias("d"),
        "д",
        "дн",
        "день",
        "дня",
        "дню",
        "дне",
        "днем",
        "днём",
        "дни",
        "дней",
        "дням",
        "днях",
        "днями",
        "сутки",
        "суток",
        "суткам",
        "сутках",
        "сутками",
      ],
      symbol: "дн",
      forms: {
        "nom-one": "день",
        "nom-few": "дня",
        "nom-many": "дней",
        "nom-other": "дня",
        "loc-one": "дне",
        "loc-few": "днях",
        "loc-many": "днях",
        "loc-other": "днях",
      },
    },
  },
});
