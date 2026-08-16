import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * French words for the datasize units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". A regional variant is a `Language` with an
 * id of its own, never a flag on a vocabulary, and nothing here is regional: the
 * word below is as Québécois as it is Parisian, and rather more insisted upon in
 * Montréal.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `datasize`
 * by **id string** rather than importing the kind: that is what lets this file
 * be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parseDatasize`) and the engine path
 * agree by construction.
 *
 * **`octet`, and why this is the one language in the repo that does not borrow
 * the English word.** Spanish took "byte" whole and lists "octeto" as a calque
 * nobody writes; French did the opposite. `octet` is the word — it is what the
 * AFNOR and ISO French texts use, what a French bill of materials prints, and
 * what any French speaker says — and its prefixed compounds carry all the way
 * up: kilooctet, mégaoctet, gigaoctet, téraoctet. It is not a synonym of "byte"
 * by accident either: an octet is eight bits *by definition*, where a byte was
 * historically whatever a machine's addressable unit happened to be, which is
 * exactly the distinction `@smartput/datarate`'s doc comment leans on when it
 * writes the factor of 8 out explicitly. English "byte"/"bytes" stay readable —
 * they arrive from `units.ts` and a French developer types them daily — and
 * only the French word is printed.
 *
 * That word decides the symbols too, and this is the part an English-speaking
 * reader will misread as a typo. **French writes "o", "ko", "Mo", "Go", "To"**,
 * not "B", "kB", "MB": the symbol is the initial of *octet*, and a French disk
 * is sold in Go the way an American one is sold in GB. The IEC binary four are
 * "Kio", "Mio", "Gio", "Tio", built on the same initial with the standard
 * binary prefixes (Ki, Mi, Gi, Ti — the capital K is IEC's and is not a slip
 * for the decimal "k"). Every one of them is a bare letter run, so every one of
 * them lexes as a single token, which is why this kind can carry the French
 * symbols where `speed` and `datarate` cannot carry theirs.
 *
 * One of those symbols has a hazard worth naming rather than discovering. "To"
 * folds to "to", which is `english.keywords.in`'s second surface, and `lex`
 * consults `buildKeywords` over *every installed language* — so in an engine
 * that speaks English beside French, "5 To" lexes as a number followed by a
 * conversion keyword and the alias index never sees the word. This is the
 * situation `assertLocaleContract`'s `skipPrintable` documents for English
 * `length:in`, and the resolution here is the same: the abbreviation is the one
 * French actually writes, there is no second French symbol for the téraoctet to
 * move to, and `forms` is declared on this unit so the printer emits
 * "téraoctets" rather than the symbol in every path but an explicit
 * `symbols: true`. The word "téraoctet" itself is unaffected — a keyword is one
 * surface, not a prefix — so nothing a French user types is lost.
 *
 * **`kilooctet` is written solid, and the hyphen is what forced it.** The
 * spelling a French dictionary shows first is "kilo-octet", with a hyphen
 * separating the two o's, and the hyphen cannot ride inside a unit token:
 * `parse/lex.ts` reads "-" as subtraction, so "5 kilo-octets" would parse as a
 * subtraction of something called "octets". The unhyphenated "kilooctet" is
 * attested in the same dictionaries as the variant and is the only one of the
 * two this engine can read, so it is what is declared and printed. The same
 * trade `@smartput/duration/locale/es` makes for "sem." and
 * `@smartput/power/locale/uk` for "к.с." — a mechanical constraint, not an
 * opinion about orthography. The other eight prefixes never had the problem:
 * "mégaoctet" and "gibioctet" are solid in every source.
 *
 * **Accents are declared twice, never stripped.** NFKC leaves a precomposed é as
 * é rather than decomposing it, so "mégaoctet" and "megaoctet" are different
 * strings and a keyboard without accents reaches nothing unless the bare
 * spelling is listed. Only the accented spelling is ever printed.
 *
 * **Two rows per unit, and the boundary is not English's.** `french.selectForm`
 * returns "one" for 0, for 1 and for every fraction below two, so "1,5 mégaoctet"
 * is singular where English writes "1.5 megabytes" — the row an English table
 * ported by renaming columns gets wrong. Every unit here inflects regularly
 * (the -s French marks number with, and nothing else: a French unit noun has no
 * case), so two rows cover the whole paradigm and there is no second axis to
 * add. Every `forms` value is also an alias, because a printed form recovered
 * only by `french.analyze`'s `-2` suffix stripper reads back by accident.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "o", "octet", "octets"],
      symbol: "o",
      forms: { one: "octet", other: "octets" },
    },
    kb: {
      aliases: [...alias("kb"), "ko", "kilooctet", "kilooctets"],
      symbol: "ko",
      forms: { one: "kilooctet", other: "kilooctets" },
    },
    mb: {
      aliases: [
        ...alias("mb"),
        "mo",
        "mégaoctet",
        "mégaoctets",
        "megaoctet",
        "megaoctets",
      ],
      symbol: "Mo",
      forms: { one: "mégaoctet", other: "mégaoctets" },
    },
    gb: {
      aliases: [...alias("gb"), "go", "gigaoctet", "gigaoctets"],
      symbol: "Go",
      forms: { one: "gigaoctet", other: "gigaoctets" },
    },
    tb: {
      aliases: [
        ...alias("tb"),
        "to",
        "téraoctet",
        "téraoctets",
        "teraoctet",
        "teraoctets",
      ],
      symbol: "To",
      forms: { one: "téraoctet", other: "téraoctets" },
    },
    // The binary four. They are separate units rather than second names for the
    // decimal ones (`kb` is 1000 octets, `kib` is 1024), and French keeps them
    // just as separate: "kibioctet" is not a synonym of "kilooctet" in any
    // register, so the two must never fold together here either. The French
    // names are the IEC prefixes glued to the same noun, which is what the
    // French translation of IEC 80000-13 does.
    kib: {
      aliases: [...alias("kib"), "kio", "kibioctet", "kibioctets"],
      symbol: "Kio",
      forms: { one: "kibioctet", other: "kibioctets" },
    },
    mib: {
      aliases: [
        ...alias("mib"),
        "mio",
        "mébioctet",
        "mébioctets",
        "mebioctet",
        "mebioctets",
      ],
      symbol: "Mio",
      forms: { one: "mébioctet", other: "mébioctets" },
    },
    gib: {
      aliases: [...alias("gib"), "gio", "gibioctet", "gibioctets"],
      symbol: "Gio",
      forms: { one: "gibioctet", other: "gibioctets" },
    },
    tib: {
      aliases: [
        ...alias("tib"),
        "tio",
        "tébioctet",
        "tébioctets",
        "tebioctet",
        "tebioctets",
      ],
      symbol: "Tio",
      forms: { one: "tébioctet", other: "tébioctets" },
    },
  },
});
