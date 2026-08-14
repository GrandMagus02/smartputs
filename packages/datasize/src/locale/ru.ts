import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Russian words for the datasize units.
 *
 * The shape is `en.ts`'s exactly — same `kind` id string, named rather than
 * imported, same derived `aliases`, a `symbol` on every unit (ruling R8), a
 * `forms` table on every unit — and the one thing that differs is the *size* of
 * that table. English inflects a unit noun for number alone and needs two keys.
 * Russian needs eight, because `russian.selectForm` keys on case *and* number:
 * `` `${case}-${category}` `` over {nom, loc} × {one, few, many, other}. The
 * engine never learns what those words mean; it asks the language for a key and
 * indexes this table with it.
 *
 * All nine units here are **byte** units. `b` is a byte, not a bit — the ratio
 * table canonicalizes on it and `en.ts` spells it "byte" — so the Russian stem
 * is `байт` throughout and `бит` appears nowhere. Bits belong to the bitrate
 * kind, whose vocabulary lives in its own package.
 *
 * Reading the eight keys off `b`, since every other unit is the same noun with a
 * prefix glued on:
 *
 * ```
 * nom-one   байт    nominative singular   1, 21, 101    "1 байт"
 * nom-few   байта   genitive SINGULAR     2, 3, 4, 22   "2 байта"
 * nom-many  байт    genitive plural       0, 5–20, 100  "5 байт"
 * nom-other байта   genitive singular     1,5           "1,5 байта"
 * loc-one   байте   prepositional sg.                   "в 1 байте"
 * loc-few   байтах  prepositional pl.                   "в 2 байтах"
 * loc-many  байтах  prepositional pl.                   "в 5 байтах"
 * loc-other байтах  prepositional pl.                   "в байтах"
 * ```
 *
 * Two rows are worth stopping at, and they are not the ones a translator
 * expects.
 *
 * `nom-few` is a genitive **singular**, not a nominative plural. This is where
 * Russian and Ukrainian genuinely part company: `uk.ts` next door writes
 * "2 байти", a real plural, while Russian writes "2 байта", the same form the
 * fractional row takes. Porting the Ukrainian table by swapping stems produces
 * Russian that is wrong in a way that still looks Slavic.
 *
 * `nom-many` is the **counting form** (счётная форма), which for a measure noun
 * is the bare stem: "5 байт", not "5 байтов". The dictionaries record both
 * genitive plurals — Gramota gives "байтов" for the ordinary genitive and "байт"
 * for the form used after a numeral — and this table only ever prints after a
 * numeral, so the bare stem is the one it prints. "байтов" is still listed as an
 * alias, because recognition is many-to-one (I6) and it is what a reader who has
 * not read Rosenthal will type. It is the same rule that gives `power` "5 ватт"
 * and `tempo` "5 герц", and the opposite of the call `mass` makes for
 * "5 килограммов", where the bare stem is the colloquialism and the -ов form is
 * the norm.
 *
 * The consequence is that `nom-one` and `nom-many` are the same string here.
 * That is a fact about Russian measure nouns rather than a table with a hole in
 * it: "1 байт" and "5 байт" really are spelled alike, and the eight keys are
 * still eight decisions.
 *
 * The prepositional half exists because a conversion target in Russian is
 * governed by `в`, and that preposition takes the prepositional case: "в 5
 * байтах", never "в 5 байт". `loc-other` is the count-free row — "1 кБ в
 * байтах" names a unit with no magnitude attached to it at all (ruling R5) — and
 * it is the row a one-dimensional plural model had no way to express. The key is
 * spelled `loc` rather than `prep` because `@smartput/core/locale/ru` chose
 * `uk`'s label deliberately, so the two Slavic vocabularies stay portable one
 * into the other; that file argues it at length.
 *
 * Symbols are Cyrillic, because that is what a Russian speaker actually writes:
 * `Б`, `кБ`, `МБ`, `ГБ`, `ТБ` for the decimal units, and the IEC binary prefixes
 * transliterated with their `и` intact — `КиБ`, `МиБ`, `ГиБ`, `ТиБ` — which
 * keeps the decimal/binary distinction visible in the symbol exactly as `kB`/
 * `KiB` keeps it visible in Latin. The two families are separate units, never
 * two names for one (`1 кБ` is 1000 bytes, `1 КиБ` is 1024), so nothing here may
 * fold them together.
 *
 * The kilo prefix is **lowercase** `к` and the kibi prefix is **uppercase** `К`,
 * which is the whole of that distinction and not a typo either way. SI writes
 * kilo lowercase in every language and every other Russian vocabulary in this
 * repo follows it — `кг` in `mass`, `кВт` in `power`, `кбит` in `datarate` —
 * while IEC's binary prefixes are `Ki`/`Mi`/`Gi`/`Ti` with a capital `K`. The
 * consumer-software spelling `КБ` loses that contrast and is not what GOST
 * writes.
 *
 * `aliases` keeps the Latin spellings — `aliasesFor` off the same `units.ts`
 * table `en.ts` reads, so the micro path and the engine path agree by
 * construction — and appends the Cyrillic ones. A Russian engine has to read
 * "2 kb" and "2 кб" both: nobody switches keyboard layouts to type a unit. The
 * inflected forms are written out rather than left to `russian`'s suffix
 * stripper on purpose — the stripper is what the resolver falls back *from*, at
 * a `-2` penalty, and a word this file chooses to print should never come back
 * through the penalised path.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "datasize",
  units: {
    b: {
      aliases: [
        ...alias("b"),
        "б",
        "байт",
        "байта",
        "байту",
        "байте",
        "байтом",
        "байты",
        "байтов",
        "байтам",
        "байтах",
        "байтами",
      ],
      symbol: "Б",
      forms: {
        "nom-one": "байт",
        "nom-few": "байта",
        "nom-many": "байт",
        "nom-other": "байта",
        "loc-one": "байте",
        "loc-few": "байтах",
        "loc-many": "байтах",
        "loc-other": "байтах",
      },
    },
    kb: {
      aliases: [
        ...alias("kb"),
        "кб",
        "килобайт",
        "килобайта",
        "килобайту",
        "килобайте",
        "килобайтом",
        "килобайты",
        "килобайтов",
        "килобайтам",
        "килобайтах",
        "килобайтами",
      ],
      symbol: "кБ",
      forms: {
        "nom-one": "килобайт",
        "nom-few": "килобайта",
        "nom-many": "килобайт",
        "nom-other": "килобайта",
        "loc-one": "килобайте",
        "loc-few": "килобайтах",
        "loc-many": "килобайтах",
        "loc-other": "килобайтах",
      },
    },
    mb: {
      aliases: [
        ...alias("mb"),
        "мб",
        "мегабайт",
        "мегабайта",
        "мегабайту",
        "мегабайте",
        "мегабайтом",
        "мегабайты",
        "мегабайтов",
        "мегабайтам",
        "мегабайтах",
        "мегабайтами",
      ],
      symbol: "МБ",
      forms: {
        "nom-one": "мегабайт",
        "nom-few": "мегабайта",
        "nom-many": "мегабайт",
        "nom-other": "мегабайта",
        "loc-one": "мегабайте",
        "loc-few": "мегабайтах",
        "loc-many": "мегабайтах",
        "loc-other": "мегабайтах",
      },
    },
    gb: {
      aliases: [
        ...alias("gb"),
        "гб",
        "гигабайт",
        "гигабайта",
        "гигабайту",
        "гигабайте",
        "гигабайтом",
        "гигабайты",
        "гигабайтов",
        "гигабайтам",
        "гигабайтах",
        "гигабайтами",
      ],
      symbol: "ГБ",
      forms: {
        "nom-one": "гигабайт",
        "nom-few": "гигабайта",
        "nom-many": "гигабайт",
        "nom-other": "гигабайта",
        "loc-one": "гигабайте",
        "loc-few": "гигабайтах",
        "loc-many": "гигабайтах",
        "loc-other": "гигабайтах",
      },
    },
    tb: {
      aliases: [
        ...alias("tb"),
        "тб",
        "терабайт",
        "терабайта",
        "терабайту",
        "терабайте",
        "терабайтом",
        "терабайты",
        "терабайтов",
        "терабайтам",
        "терабайтах",
        "терабайтами",
      ],
      symbol: "ТБ",
      forms: {
        "nom-one": "терабайт",
        "nom-few": "терабайта",
        "nom-many": "терабайт",
        "nom-other": "терабайта",
        "loc-one": "терабайте",
        "loc-few": "терабайтах",
        "loc-many": "терабайтах",
        "loc-other": "терабайтах",
      },
    },
    kib: {
      aliases: [
        ...alias("kib"),
        "киб",
        "кибибайт",
        "кибибайта",
        "кибибайту",
        "кибибайте",
        "кибибайтом",
        "кибибайты",
        "кибибайтов",
        "кибибайтам",
        "кибибайтах",
        "кибибайтами",
      ],
      symbol: "КиБ",
      forms: {
        "nom-one": "кибибайт",
        "nom-few": "кибибайта",
        "nom-many": "кибибайт",
        "nom-other": "кибибайта",
        "loc-one": "кибибайте",
        "loc-few": "кибибайтах",
        "loc-many": "кибибайтах",
        "loc-other": "кибибайтах",
      },
    },
    mib: {
      aliases: [
        ...alias("mib"),
        "миб",
        "мебибайт",
        "мебибайта",
        "мебибайту",
        "мебибайте",
        "мебибайтом",
        "мебибайты",
        "мебибайтов",
        "мебибайтам",
        "мебибайтах",
        "мебибайтами",
      ],
      symbol: "МиБ",
      forms: {
        "nom-one": "мебибайт",
        "nom-few": "мебибайта",
        "nom-many": "мебибайт",
        "nom-other": "мебибайта",
        "loc-one": "мебибайте",
        "loc-few": "мебибайтах",
        "loc-many": "мебибайтах",
        "loc-other": "мебибайтах",
      },
    },
    gib: {
      aliases: [
        ...alias("gib"),
        "гиб",
        "гибибайт",
        "гибибайта",
        "гибибайту",
        "гибибайте",
        "гибибайтом",
        "гибибайты",
        "гибибайтов",
        "гибибайтам",
        "гибибайтах",
        "гибибайтами",
      ],
      symbol: "ГиБ",
      forms: {
        "nom-one": "гибибайт",
        "nom-few": "гибибайта",
        "nom-many": "гибибайт",
        "nom-other": "гибибайта",
        "loc-one": "гибибайте",
        "loc-few": "гибибайтах",
        "loc-many": "гибибайтах",
        "loc-other": "гибибайтах",
      },
    },
    tib: {
      aliases: [
        ...alias("tib"),
        "тиб",
        "тебибайт",
        "тебибайта",
        "тебибайту",
        "тебибайте",
        "тебибайтом",
        "тебибайты",
        "тебибайтов",
        "тебибайтам",
        "тебибайтах",
        "тебибайтами",
      ],
      symbol: "ТиБ",
      forms: {
        "nom-one": "тебибайт",
        "nom-few": "тебибайта",
        "nom-many": "тебибайт",
        "nom-other": "тебибайта",
        "loc-one": "тебибайте",
        "loc-few": "тебибайтах",
        "loc-many": "тебибайтах",
        "loc-other": "тебибайтах",
      },
    },
  },
});
