import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Polish words for the datasize units.
 *
 * The shape is `en.ts`'s exactly — same `kind` id string, named rather than
 * imported, same derived `aliases`, a `symbol` on every unit (ruling R8), a
 * `forms` table on every unit — and the one thing that differs is the *size* of
 * that table. English inflects a unit noun for number alone and needs two keys.
 * Polish needs eight, because `polish.selectForm` keys on case *and* number:
 * `` `${case}-${category}` `` over {nom, loc} × {one, few, many, other}. The
 * engine never learns what those words mean; it asks the language for a key and
 * indexes this table with it.
 *
 * All nine units here are **byte** units. `b` is a byte, not a bit — the ratio
 * table canonicalizes on it and `en.ts` spells it "byte" — so the Polish stem is
 * `bajt` throughout and `bit` appears nowhere. Bits belong to the bitrate kind,
 * whose vocabulary lives in its own package.
 *
 * Reading the eight keys off `b`, since every other unit is the same noun with a
 * prefix glued on:
 *
 * ```
 * nom-one   bajt     nominative singular   1              "1 bajt"
 * nom-few   bajty    nominative PLURAL     2–4, 22–24     "2 bajty"
 * nom-many  bajtów   genitive plural       0, 5–21, 12–14 "5 bajtów"
 * nom-other bajta    genitive SINGULAR     1,5            "1,5 bajta"
 * loc-one   bajcie   locative singular                    "w 1 bajcie"
 * loc-few   bajtach  locative plural                      "w 2 bajtach"
 * loc-many  bajtach  locative plural                      "w 5 bajtach"
 * loc-other bajtach  locative plural                      "w bajtach"
 * ```
 *
 * Three rows are worth stopping at, and none of them is the one a translator
 * expects.
 *
 * `nom-few` is a real **nominative plural**, not the genitive singular Russian
 * writes in the same cell. `ru.ts` next door has "2 байта", which is the same
 * word as its fractional row; Polish has "2 bajty" and "1,5 bajta", two
 * different words. A table ported from Russian by swapping stems collapses that
 * distinction and is wrong in a way that still looks Slavic.
 *
 * `nom-many` **reaches 21**, and that is where Polish leaves Ukrainian rather
 * than Russian. Both of those languages agree 21 with the singular ("21 байт",
 * "21 байт"); Polish counts every -1 above twenty by its neighbours instead —
 * "dwadzieścia jeden bajtów", genitive plural. A table copied from `uk.ts`
 * prints the nominative singular at 21, 31, 101 and 1001, which reads as a typo
 * rather than as a bug and is exactly what a green suite does not notice.
 * `polish.selectForm` documents the boundary; this table is keyed against it.
 *
 * `nom-other` is the **fractional** row and it is a genitive singular. It is not
 * a plural of any kind, and it is not the same word as `loc-other` even though
 * both keys end in the same syllable: `nom-other` is only ever reached with a
 * fraction in hand ("1,5 bajta") while `loc-other` is only ever reached
 * *without* a count at all, as the conversion target ruling R5 describes ("w
 * bajtach"). Filling both from one word is the mistake the two-axis key set
 * exists to make visible.
 *
 * The locative half exists because a conversion target in Polish is governed by
 * `w`, the first word this language declares under `in`, and `w` takes the
 * locative: "w 5 bajtach", never "w 5 bajtów". `loc-one` is its own ending
 * rather than the plural's, and it is the row a stripper could never recover:
 * the stem-final `t` softens to `ci` before `-e`, so "bajcie" shares no suffix
 * boundary with "bajt" at all. It is listed as an alias for that reason, and the
 * containment is asserted in `pl.test.ts`.
 *
 * The genitive singular is a doublet in Polish — dictionaries record both
 * "bajta" and "bajtu" for the bare unit, as they do for most masculine
 * inanimates — and this table prints "bajta". Two reasons, neither of them a
 * coin toss: the prefixed compounds are unambiguously -a ("megabajta" is the
 * only spelling anyone writes), and printing "1,5 bajta" beside "1,5 megabajta"
 * keeps the family reading as one paradigm. "bajtu" is listed as an alias, since
 * recognition is many-to-one (I6) and a reader who prefers it should be
 * understood.
 *
 * Symbols are Latin, and that is not laziness about Polish: `B`, `kB`, `MB`,
 * `GB`, `TB` are what a Polish shop listing and a Polish datasheet both print,
 * and the IEC binary prefixes keep their `i` — `KiB`, `MiB`, `GiB`, `TiB` — so
 * the decimal/binary distinction stays visible in the symbol. The two families
 * are separate units, never two names for one (`1 kB` is 1000 bytes, `1 KiB` is
 * 1024), so nothing here may fold them together. Every symbol case-folds onto a
 * derived alias, which is the whole mechanism by which a `symbols: true` print
 * parses back.
 *
 * The kilo prefix is **lowercase** `k` and the kibi prefix is **uppercase** `K`,
 * which is the whole of that distinction and not a typo either way. SI writes
 * kilo lowercase in every language, and IEC's binary prefixes are `Ki`/`Mi`/
 * `Gi`/`Ti` with a capital `K`. The consumer-software spelling `KB` loses that
 * contrast.
 *
 * `aliases` keeps the Latin spellings — `aliasesFor` off the same `units.ts`
 * table `en.ts` reads, so the micro path and the engine path agree by
 * construction — and appends the Polish ones. The inflected forms are written
 * out rather than left to `polish`'s suffix stripper on purpose: the stripper is
 * what the resolver falls back *from*, at a `-2` penalty, and a word this file
 * chooses to print should never come back through the penalised path.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "datasize",
  units: {
    b: {
      aliases: [
        ...alias("b"),
        "bajt",
        "bajta",
        "bajtu",
        "bajtowi",
        "bajcie",
        "bajtem",
        "bajty",
        "bajtów",
        "bajtom",
        "bajtach",
        "bajtami",
      ],
      symbol: "B",
      forms: {
        "nom-one": "bajt",
        "nom-few": "bajty",
        "nom-many": "bajtów",
        "nom-other": "bajta",
        "loc-one": "bajcie",
        "loc-few": "bajtach",
        "loc-many": "bajtach",
        "loc-other": "bajtach",
      },
    },
    kb: {
      aliases: [
        ...alias("kb"),
        "kilobajt",
        "kilobajta",
        "kilobajtowi",
        "kilobajcie",
        "kilobajtem",
        "kilobajty",
        "kilobajtów",
        "kilobajtom",
        "kilobajtach",
        "kilobajtami",
      ],
      symbol: "kB",
      forms: {
        "nom-one": "kilobajt",
        "nom-few": "kilobajty",
        "nom-many": "kilobajtów",
        "nom-other": "kilobajta",
        "loc-one": "kilobajcie",
        "loc-few": "kilobajtach",
        "loc-many": "kilobajtach",
        "loc-other": "kilobajtach",
      },
    },
    mb: {
      aliases: [
        ...alias("mb"),
        "megabajt",
        "megabajta",
        "megabajtowi",
        "megabajcie",
        "megabajtem",
        "megabajty",
        "megabajtów",
        "megabajtom",
        "megabajtach",
        "megabajtami",
      ],
      symbol: "MB",
      forms: {
        "nom-one": "megabajt",
        "nom-few": "megabajty",
        "nom-many": "megabajtów",
        "nom-other": "megabajta",
        "loc-one": "megabajcie",
        "loc-few": "megabajtach",
        "loc-many": "megabajtach",
        "loc-other": "megabajtach",
      },
    },
    gb: {
      aliases: [
        ...alias("gb"),
        "gigabajt",
        "gigabajta",
        "gigabajtowi",
        "gigabajcie",
        "gigabajtem",
        "gigabajty",
        "gigabajtów",
        "gigabajtom",
        "gigabajtach",
        "gigabajtami",
      ],
      symbol: "GB",
      forms: {
        "nom-one": "gigabajt",
        "nom-few": "gigabajty",
        "nom-many": "gigabajtów",
        "nom-other": "gigabajta",
        "loc-one": "gigabajcie",
        "loc-few": "gigabajtach",
        "loc-many": "gigabajtach",
        "loc-other": "gigabajtach",
      },
    },
    tb: {
      aliases: [
        ...alias("tb"),
        "terabajt",
        "terabajta",
        "terabajtowi",
        "terabajcie",
        "terabajtem",
        "terabajty",
        "terabajtów",
        "terabajtom",
        "terabajtach",
        "terabajtami",
      ],
      symbol: "TB",
      forms: {
        "nom-one": "terabajt",
        "nom-few": "terabajty",
        "nom-many": "terabajtów",
        "nom-other": "terabajta",
        "loc-one": "terabajcie",
        "loc-few": "terabajtach",
        "loc-many": "terabajtach",
        "loc-other": "terabajtach",
      },
    },
    kib: {
      aliases: [
        ...alias("kib"),
        "kibibajt",
        "kibibajta",
        "kibibajtowi",
        "kibibajcie",
        "kibibajtem",
        "kibibajty",
        "kibibajtów",
        "kibibajtom",
        "kibibajtach",
        "kibibajtami",
      ],
      symbol: "KiB",
      forms: {
        "nom-one": "kibibajt",
        "nom-few": "kibibajty",
        "nom-many": "kibibajtów",
        "nom-other": "kibibajta",
        "loc-one": "kibibajcie",
        "loc-few": "kibibajtach",
        "loc-many": "kibibajtach",
        "loc-other": "kibibajtach",
      },
    },
    mib: {
      aliases: [
        ...alias("mib"),
        "mebibajt",
        "mebibajta",
        "mebibajtowi",
        "mebibajcie",
        "mebibajtem",
        "mebibajty",
        "mebibajtów",
        "mebibajtom",
        "mebibajtach",
        "mebibajtami",
      ],
      symbol: "MiB",
      forms: {
        "nom-one": "mebibajt",
        "nom-few": "mebibajty",
        "nom-many": "mebibajtów",
        "nom-other": "mebibajta",
        "loc-one": "mebibajcie",
        "loc-few": "mebibajtach",
        "loc-many": "mebibajtach",
        "loc-other": "mebibajtach",
      },
    },
    gib: {
      aliases: [
        ...alias("gib"),
        "gibibajt",
        "gibibajta",
        "gibibajtowi",
        "gibibajcie",
        "gibibajtem",
        "gibibajty",
        "gibibajtów",
        "gibibajtom",
        "gibibajtach",
        "gibibajtami",
      ],
      symbol: "GiB",
      forms: {
        "nom-one": "gibibajt",
        "nom-few": "gibibajty",
        "nom-many": "gibibajtów",
        "nom-other": "gibibajta",
        "loc-one": "gibibajcie",
        "loc-few": "gibibajtach",
        "loc-many": "gibibajtach",
        "loc-other": "gibibajtach",
      },
    },
    tib: {
      aliases: [
        ...alias("tib"),
        "tebibajt",
        "tebibajta",
        "tebibajtowi",
        "tebibajcie",
        "tebibajtem",
        "tebibajty",
        "tebibajtów",
        "tebibajtom",
        "tebibajtach",
        "tebibajtami",
      ],
      symbol: "TiB",
      forms: {
        "nom-one": "tebibajt",
        "nom-few": "tebibajty",
        "nom-many": "tebibajtów",
        "nom-other": "tebibajta",
        "loc-one": "tebibajcie",
        "loc-few": "tebibajtach",
        "loc-many": "tebibajtach",
        "loc-other": "tebibajtach",
      },
    },
  },
});
