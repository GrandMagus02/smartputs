import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Ukrainian words for the datasize units.
 *
 * The shape is `en.ts`'s exactly — same `kind` id string, named rather than
 * imported, same derived `aliases`, a `symbol` on every unit (ruling R8), a
 * `forms` table on every unit — and the one thing that differs is the *size*
 * of that table. English needs two keys per unit because English inflects a
 * unit noun for number alone. Ukrainian needs eight, because
 * `ukrainian.selectForm` keys on case *and* number: `` `${case}-${category}` ``
 * over {nom, loc} × {one, few, many, other}. The engine never learns what those
 * words mean; it asks the language for a key and indexes this table with it.
 *
 * All nine units here are **byte** units. `b` is a byte, not a bit — the en
 * vocabulary spells it "byte" and the ratio table canonicalizes on it — so the
 * Ukrainian stem is `байт` throughout and `біт` appears nowhere. Bits belong to
 * the bitrate kind, whose vocabulary lives in its own package.
 *
 * Reading the eight keys off `b`, since every other unit is the same stem with
 * a prefix glued on:
 *
 *   nom-one   байт     nominative singular    1, 21, 101   "1 байт"
 *   nom-few   байти    nominative plural      2, 3, 4, 22  "2 байти"
 *   nom-many  байтів   genitive plural        0, 5-20, 100 "5 байтів"
 *   nom-other байта    genitive SINGULAR      1,5          "1,5 байта"
 *   loc-one   байті    locative singular      "у 1 байті"
 *   loc-few   байтах   locative plural        "у 2 байтах"
 *   loc-many  байтах   locative plural        "у 5 байтах"
 *   loc-other байтах   locative plural        "у байтах"
 *
 * `nom-other` is the row worth stopping at: CLDR's `other` is Ukrainian's
 * *fractional* category, and a fraction takes the genitive singular, not a
 * plural. Writing `байтів` there would print "1,5 байтів", which is wrong and
 * which no round-trip test can see — both spellings read back to the same unit.
 *
 * The locative half exists because a conversion target in Ukrainian is governed
 * by `в`/`у`, and that preposition takes the locative: "у 5 байтах", never
 * "у 5 байтів". `loc-other` is the count-free row — "1 кБ у байтах" names a
 * unit with no magnitude attached to it at all (ruling R5) — and it is the row
 * the old one-dimensional `display` model had no way to express.
 *
 * Symbols are Cyrillic, because that is what a Ukrainian speaker actually
 * writes: `Б`, `кБ`, `МБ`, `ГБ`, `ТБ` for the decimal units, and the IEC binary
 * prefixes transliterated with their `і` intact — `КіБ`, `МіБ`, `ГіБ`, `ТіБ` —
 * which keeps the decimal/binary distinction visible in the symbol exactly as
 * `kB`/`KiB` keeps it visible in Latin. The two families are separate units,
 * never two names for one (`1 кБ` is 1000 bytes, `1 КіБ` is 1024), so nothing
 * here may fold them together.
 *
 * The kilo prefix is **lowercase** `к` and the kibi prefix is **uppercase** `К`,
 * which is the whole of that distinction and not a typo either way. SI writes
 * kilo lowercase in every language, and every other `uk` vocabulary in this repo
 * follows it — `кг` in `mass`, `км` in `length`, `кВт` in `power`, `кбіт` in
 * `datarate` — while IEC's binary prefixes are `Ki`/`Mi`/`Gi`/`Ti` with a
 * capital `K`. The consumer-software spelling `КБ` (a Latin `KB` with the
 * letters swapped for Cyrillic) loses that contrast and is not what a Ukrainian
 * standard writes.
 *
 * `aliases` keeps the Latin spellings — `aliasesFor` off the same `units.ts`
 * table `en.ts` reads, so the micro path and the engine path agree by
 * construction — and appends the Cyrillic ones. A Ukrainian engine has to read
 * `2 kb` and `2 кб` both: nobody switches keyboard layouts to type a unit. The
 * inflected forms are written out rather than left to `ukrainian`'s suffix
 * stripper on purpose — the stripper is what the resolver falls back *from*.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "datasize",
  units: {
    b: {
      aliases: [
        ...alias("b"),
        "б",
        "байт",
        "байта",
        "байти",
        "байтів",
        "байті",
        "байтах",
      ],
      symbol: "Б",
      forms: {
        "nom-one": "байт",
        "nom-few": "байти",
        "nom-many": "байтів",
        "nom-other": "байта",
        "loc-one": "байті",
        "loc-few": "байтах",
        "loc-many": "байтах",
        "loc-other": "байтах",
      },
    },
    kb: {
      aliases: [
        ...alias("kb"),
        "кб",
        "кілобайт",
        "кілобайта",
        "кілобайти",
        "кілобайтів",
        "кілобайті",
        "кілобайтах",
      ],
      symbol: "кБ",
      forms: {
        "nom-one": "кілобайт",
        "nom-few": "кілобайти",
        "nom-many": "кілобайтів",
        "nom-other": "кілобайта",
        "loc-one": "кілобайті",
        "loc-few": "кілобайтах",
        "loc-many": "кілобайтах",
        "loc-other": "кілобайтах",
      },
    },
    mb: {
      aliases: [
        ...alias("mb"),
        "мб",
        "мегабайт",
        "мегабайта",
        "мегабайти",
        "мегабайтів",
        "мегабайті",
        "мегабайтах",
      ],
      symbol: "МБ",
      forms: {
        "nom-one": "мегабайт",
        "nom-few": "мегабайти",
        "nom-many": "мегабайтів",
        "nom-other": "мегабайта",
        "loc-one": "мегабайті",
        "loc-few": "мегабайтах",
        "loc-many": "мегабайтах",
        "loc-other": "мегабайтах",
      },
    },
    gb: {
      aliases: [
        ...alias("gb"),
        "гб",
        "гігабайт",
        "гігабайта",
        "гігабайти",
        "гігабайтів",
        "гігабайті",
        "гігабайтах",
      ],
      symbol: "ГБ",
      forms: {
        "nom-one": "гігабайт",
        "nom-few": "гігабайти",
        "nom-many": "гігабайтів",
        "nom-other": "гігабайта",
        "loc-one": "гігабайті",
        "loc-few": "гігабайтах",
        "loc-many": "гігабайтах",
        "loc-other": "гігабайтах",
      },
    },
    tb: {
      aliases: [
        ...alias("tb"),
        "тб",
        "терабайт",
        "терабайта",
        "терабайти",
        "терабайтів",
        "терабайті",
        "терабайтах",
      ],
      symbol: "ТБ",
      forms: {
        "nom-one": "терабайт",
        "nom-few": "терабайти",
        "nom-many": "терабайтів",
        "nom-other": "терабайта",
        "loc-one": "терабайті",
        "loc-few": "терабайтах",
        "loc-many": "терабайтах",
        "loc-other": "терабайтах",
      },
    },
    kib: {
      aliases: [
        ...alias("kib"),
        "кіб",
        "кібібайт",
        "кібібайта",
        "кібібайти",
        "кібібайтів",
        "кібібайті",
        "кібібайтах",
      ],
      symbol: "КіБ",
      forms: {
        "nom-one": "кібібайт",
        "nom-few": "кібібайти",
        "nom-many": "кібібайтів",
        "nom-other": "кібібайта",
        "loc-one": "кібібайті",
        "loc-few": "кібібайтах",
        "loc-many": "кібібайтах",
        "loc-other": "кібібайтах",
      },
    },
    mib: {
      aliases: [
        ...alias("mib"),
        "міб",
        "мебібайт",
        "мебібайта",
        "мебібайти",
        "мебібайтів",
        "мебібайті",
        "мебібайтах",
      ],
      symbol: "МіБ",
      forms: {
        "nom-one": "мебібайт",
        "nom-few": "мебібайти",
        "nom-many": "мебібайтів",
        "nom-other": "мебібайта",
        "loc-one": "мебібайті",
        "loc-few": "мебібайтах",
        "loc-many": "мебібайтах",
        "loc-other": "мебібайтах",
      },
    },
    gib: {
      aliases: [
        ...alias("gib"),
        "гіб",
        "гібібайт",
        "гібібайта",
        "гібібайти",
        "гібібайтів",
        "гібібайті",
        "гібібайтах",
      ],
      symbol: "ГіБ",
      forms: {
        "nom-one": "гібібайт",
        "nom-few": "гібібайти",
        "nom-many": "гібібайтів",
        "nom-other": "гібібайта",
        "loc-one": "гібібайті",
        "loc-few": "гібібайтах",
        "loc-many": "гібібайтах",
        "loc-other": "гібібайтах",
      },
    },
    tib: {
      aliases: [
        ...alias("tib"),
        "тіб",
        "тебібайт",
        "тебібайта",
        "тебібайти",
        "тебібайтів",
        "тебібайті",
        "тебібайтах",
      ],
      symbol: "ТіБ",
      forms: {
        "nom-one": "тебібайт",
        "nom-few": "тебібайти",
        "nom-many": "тебібайтів",
        "nom-other": "тебібайта",
        "loc-one": "тебібайті",
        "loc-few": "тебібайтах",
        "loc-many": "тебібайтах",
        "loc-other": "тебібайтах",
      },
    },
  },
});
