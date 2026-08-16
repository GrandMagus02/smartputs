import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Korean words for the datasize units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography. The
 * shape is `en.ts`'s: the same `kind` named by **id string** rather than
 * imported, `aliases` derived from `units.ts` rather than retyped, and an
 * explicit `symbol` on every unit (ruling R8). What differs comes from the
 * language and not from this kind.
 *
 * **One form key, not two.** `korean.selectForm` returns the constant `"other"`
 * for every count and every slot: Korean marks number nowhere on a noun — 일
 * 바이트 and 오 바이트 differ in the numeral and nowhere else, and the plural
 * suffix 들 is pragmatic and never used with a measured quantity — and CLDR
 * agrees, `Intl.PluralRules("ko")` declaring the single category `other`. A
 * table translated from `en.ts` needs no key renamed; it needs its `"one"` row
 * deleted.
 *
 * **All nine Hangul words are claimable, and that is the fact a reader arriving
 * from `ja.ts` will get wrong.** The Japanese file beside this one spends most
 * of its length on an ICU measurement — Japanese is unspaced, so `lex` hands
 * each letter run to `Intl.Segmenter`, and its dictionary returns メガバイト
 * whole while cutting テラバイト into テラ + バイト, which is why that file may
 * print no word at all and must drop two aliases as unreachable. Korean has been
 * spaced since 1896, `korean.segment` is undefined, and `lex` has already cut at
 * every space, so a compound written as one word arrives as one token because
 * its writer wrote it that way. No dictionary is consulted and none can veto a
 * row here. `ko.test.ts` pins the absent segmenter rather than trusting this.
 *
 * **So the decimal family spells itself out and the binary family does not**,
 * and the split is a claim about registers rather than about what the lexer can
 * take. 「500기가바이트 하드」 and 「4테라바이트 외장하드」 are how a Korean
 * storefront and a Korean forum thread write a size, so 바이트 and its four SI
 * compounds are `forms` and print. 키비바이트 and its three siblings are the KS
 * standards calques of the IEC prefixes: they are real terms and are listed as
 * aliases, but no Korean page has ever printed one — what a Korean page prints
 * for 1024 bytes is "KiB", in Latin, exactly as an English one does. R8 forbids
 * inventing an abbreviation and this is the other side of the same coin:
 * printing a term that exists only in a standards document would put a register
 * into the output that nobody writes.
 *
 * The obvious objection is the one `ja.ts` raises against itself — one kind
 * printing two registers, 「1.5기가바이트」 beside 「1KiB」 — and here it is the
 * argument *for* the split rather than against it. `kb` and `kib` are different
 * units whose entire reason to exist is to be told apart (1kB is 1000 bytes,
 * 1KiB is 1024), and the IEC symbols were coined precisely so that a technical
 * text could make that visible. Two registers for two families that must never
 * be confused is a feature; it is only a bug when one family prints two ways.
 *
 * **The symbols are the international ones**, which is what Korea writes: 「1.5GB」,
 * 「512MB」, 「2TB」. The IEC binary prefixes keep their `i`. Case folds in the
 * alias index, so "GB" and "gb" are one key and the casing costs nothing.
 *
 * **Both scripts read.** The Latin spellings come from `units.ts` through
 * `aliasesFor`, so the micro path (`parseDatasize`) and the engine path agree by
 * construction, and the Hangul names are appended. Nobody switches input mode to
 * type a unit: 「5기가바이트」 and "5 gb" are the same sentence.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "바이트"],
      symbol: "B",
      forms: { other: "바이트" },
    },
    kb: {
      aliases: [...alias("kb"), "킬로바이트"],
      symbol: "kB",
      forms: { other: "킬로바이트" },
    },
    mb: {
      aliases: [...alias("mb"), "메가바이트"],
      symbol: "MB",
      forms: { other: "메가바이트" },
    },
    gb: {
      aliases: [...alias("gb"), "기가바이트"],
      symbol: "GB",
      forms: { other: "기가바이트" },
    },
    tb: {
      aliases: [...alias("tb"), "테라바이트"],
      symbol: "TB",
      forms: { other: "테라바이트" },
    },
    // The four IEC binaries: the calque reads, the Latin symbol prints. See the
    // register argument above — these are the units that exist to be told apart
    // from the four above them, and the symbol is where that stays visible.
    kib: { aliases: [...alias("kib"), "키비바이트"], symbol: "KiB" },
    mib: { aliases: [...alias("mib"), "메비바이트"], symbol: "MiB" },
    gib: { aliases: [...alias("gib"), "기비바이트"], symbol: "GiB" },
    tib: { aliases: [...alias("tib"), "테비바이트"], symbol: "TiB" },
  },
});
