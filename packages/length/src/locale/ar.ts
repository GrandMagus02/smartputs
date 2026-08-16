import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en` and `uk` next door make, kept for `uk`'s reason
 * rather than `en`'s.
 *
 * In English `in` is the conversion keyword, so `lex` emits it as a `keyword`
 * token and the alias is unreachable on the engine path. Arabic's conversion
 * keywords are إلى/الى/في, so nothing about the Arabic lexer would shadow it and
 * the entry would be perfectly reachable here.
 *
 * It stays out anyway, because `registry.aliasIndex` is one flat map and
 * `MatchCtx.isUnitAlias` reads it without consulting a locale. An engine with
 * both languages installed would have the Arabic vocabulary put `in` back into
 * the index `@smartput/datetime`'s accept-gate consults, and "in 3 days" would
 * read as an all-units phrase again — the regression the `en` reservation exists
 * to prevent, reintroduced from the side it does not cover. An Arabic reader
 * types بوصة, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) on the
 * final consonant, then the alif (U+0627) that carries it, in that codepoint
 * order. Written the way `@smartput/core/locale/ar` writes the same two
 * characters in its suffix stripper — U+064B renders *on top of* the letter
 * before it, so a literal is a smudge one careless retype away from vanishing,
 * and if it vanished the `many` row would silently become the `one` row.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the length units — the same eight units `en` next door
 * names, and the same answer to "does this unit have words at all?". All eight
 * do: Arabic writes every one of them out.
 *
 * Arabic is the hardest language shipped here, and length is where two of the
 * three reasons are easiest to see.
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on ONE axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Ukrainian has eight on two axes.
 * Taking متر through all six:
 *
 * ```
 * zero   0            متر         genitive singular
 * one    1            متر         nominative singular
 * two    2            متران       the DUAL — a suffix on the noun, not a word
 * few    3-10         أمتار       plural, and a BROKEN one: the stem is
 *                                 re-arranged, not suffixed
 * many   11-99        مترًا       accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    متر         genitive singular
 *        fractions
 * ```
 *
 * `many` is not a plural — "١١ مترًا" is a singular noun in the accusative — and
 * `other`, where every fraction and every count-free conversion target lands
 * (ruling R5), is the genitive **singular**: "1.5 متر", never "1.5 أمتار". Those
 * are the two rows a table ported by renaming English columns gets wrong.
 * `zero`, `one` and `other` share one string on every unit here, because the
 * three differ only in a final short vowel Arabic does not write; repeating it
 * is correct, not a half-finished table.
 *
 * **2. Broken plurals, which the analyzer chain cannot reach.** Four of these
 * eight units take one: متر → أمتار, قدم → أقدام, ميل → أميال, and بوصة's dual
 * *replaces* its ة (بوصتان). `arabic`'s suffix stripper knows ات/ان/ين/ون/ـًا
 * and can take an ending off; it cannot undo a re-arrangement or a replacement.
 * So those forms are listed as aliases of necessity — which rule 5 wants anyway,
 * since a form the printer emits should never come back through a guess. The
 * hamza spellings (أمتار beside امتار) are listed for the mirror-image reason:
 * `arabic`'s orthographic fold deletes a hamza the user typed and can never
 * invent one they did not, so a plain-alif typist reaches nothing unless the
 * plain spelling is here too.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 متران" holds the number first and the noun second exactly
 * as "2 metres" does, and the Unicode Bidirectional Algorithm is what puts the
 * number on the right at display time. **Nothing here is reversed and nothing
 * here should be** — swapping the parts would emit the noun before the number in
 * memory, which `parse` reads as a unit followed by a number, and
 * `parse(format(v)) === v` breaks.
 *
 * The digits stay Latin throughout, because `@smartput/core/locale/ar` pins
 * `numberFormat: { group: ",", decimal: "." }` — the `latn` numbering system,
 * transcribed rather than read from `Intl`, since the engine can only *emit*
 * Latin digits and pairing them with Arabic-Indic separators would produce
 * `1٬234٫5`. `ar.ts` carries the measurement; "٥ م" is a core-level gap, not one
 * a word list can close.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in an Arabic engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * `symbol` is Arabic where Arabic actually abbreviates — م, سم, مم, كم are what
 * a ruler and a road sign print — and the spelled nominative singular where it
 * does not: بوصة, قدم, يارد and ميل have no accepted Arabic abbreviation, the
 * same choice `en` makes for units it writes out. R8 wants an explicit symbol on
 * every unit, not an invented one. The one-letter م is safe because
 * `arabic`'s suffix stripper floors at `minStem: 2` and so can never manufacture
 * a one-letter stem out of an ordinary word — that floor is chosen for exactly
 * this, and `ar.ts` names م among the symbols it protects.
 *
 * Like `en`, this file names `length` by id string and never imports the kind,
 * which is what lets `@smartput/length/locale/ar` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "length",
  units: {
    // مليمتر with one lām is the spelling in ordinary use; ملليمتر doubles it to
    // mirror the geminate of "milli-" and ميليمتر transliterates the vowel
    // instead. All three are read, one is printed — recognition is many-to-one
    // and only generation has to choose.
    mm: {
      aliases: [
        ...alias("mm"),
        "مم",
        "ملم",
        "مليمتر",
        "ملليمتر",
        "ميليمتر",
        "مليمتران",
        "مليمترات",
        `مليمتر${AN}`,
        "مليمترا",
      ],
      symbol: "مم",
      forms: {
        zero: "مليمتر",
        one: "مليمتر",
        two: "مليمتران",
        few: "مليمترات",
        many: `مليمتر${AN}`,
        other: "مليمتر",
      },
    },
    cm: {
      aliases: [
        ...alias("cm"),
        "سم",
        "سنتيمتر",
        "سنتمتر",
        "سنتيمتران",
        "سنتيمترات",
        `سنتيمتر${AN}`,
        "سنتيمترا",
      ],
      symbol: "سم",
      forms: {
        zero: "سنتيمتر",
        one: "سنتيمتر",
        two: "سنتيمتران",
        few: "سنتيمترات",
        many: `سنتيمتر${AN}`,
        other: "سنتيمتر",
      },
    },
    // The broken plural. متر is a loanword old enough to have been fitted to an
    // Arabic pattern — أمتار, on the ʾafʿāl template — so the 3-10 row is not
    // مترات and no ending rule produces it. The compounds below (سنتيمتر,
    // كيلومتر) never took it: they are too long for the template and keep the
    // sound plural in ـات, which is why this file's five metric units do not
    // share one table.
    m: {
      aliases: [...alias("m"), "م", "متر", "متران", "أمتار", "امتار", `متر${AN}`, "مترا"],
      symbol: "م",
      forms: {
        zero: "متر",
        one: "متر",
        two: "متران",
        few: "أمتار",
        many: `متر${AN}`,
        other: "متر",
      },
    },
    // كلم is the Maghreb abbreviation and كم the eastern one; both are read, كم
    // is printed. The colloquial clipping كيلو is deliberately *not* here: in
    // Arabic speech it means a kilogram, so `@smartput/mass/locale/ar` claims it
    // and a length vocabulary that also claimed it would make the commonest word
    // in the pair ambiguous for no gain.
    km: {
      aliases: [
        ...alias("km"),
        "كم",
        "كلم",
        "كيلومتر",
        "كيلومتران",
        "كيلومترات",
        `كيلومتر${AN}`,
        "كيلومترا",
      ],
      symbol: "كم",
      forms: {
        zero: "كيلومتر",
        one: "كيلومتر",
        two: "كيلومتران",
        few: "كيلومترات",
        many: `كيلومتر${AN}`,
        other: "كيلومتر",
      },
    },
    // Feminine, ending in tāʾ marbūṭa, and that changes the shape of the table
    // rather than the stem inside it. The dual *replaces* the ة — بوصة becomes
    // بوصتان — which no suffix strip undoes; and the accusative takes no alif,
    // because the tanwīn on a ة is a bare mark ordinary prose leaves off. So the
    // `many` row is spelled exactly like the singular and four of six rows
    // coincide, where a masculine unit's `many` is visibly different.
    //
    // إنش is the transliteration people also type, and both hamza spellings are
    // listed because the orthographic fold only runs the other way.
    in: {
      aliases: [
        ...alias("in"),
        "بوصة",
        "بوصتان",
        "بوصات",
        "إنش",
        "انش",
        "إنشات",
        "انشات",
      ],
      symbol: "بوصة",
      forms: {
        zero: "بوصة",
        one: "بوصة",
        two: "بوصتان",
        few: "بوصات",
        many: "بوصة",
        other: "بوصة",
      },
    },
    // قدم is grammatically feminine in Arabic but does not end in ة, so it takes
    // the masculine-looking endings anyway: the dual suffixes (قدمان) and the
    // accusative writes its alif (قدمًا). Its plural is broken — أقدام — so the
    // gender shows up nowhere in this table and the broken plural is the only
    // row an ending rule could not have produced.
    ft: {
      aliases: [...alias("ft"), "قدم", "قدمان", "أقدام", "اقدام", `قدم${AN}`, "قدما"],
      symbol: "قدم",
      forms: {
        zero: "قدم",
        one: "قدم",
        two: "قدمان",
        few: "أقدام",
        many: `قدم${AN}`,
        other: "قدم",
      },
    },
    yd: {
      aliases: [
        ...alias("yd"),
        "يارد",
        "ياردة",
        "ياردان",
        "ياردات",
        `يارد${AN}`,
        "ياردا",
      ],
      symbol: "يارد",
      forms: {
        zero: "يارد",
        one: "يارد",
        two: "ياردان",
        few: "ياردات",
        many: `يارد${AN}`,
        other: "يارد",
      },
    },
    // Another broken plural, on the same ʾafʿāl template as أمتار and أقدام:
    // ميل → أميال. Not to be confused with the ميلي- of مليمتر above; they share
    // three letters and nothing else, and neither is reachable from the other by
    // any rule in the analyzer chain.
    mi: {
      aliases: [...alias("mi"), "ميل", "ميلان", "أميال", "اميال", `ميل${AN}`, "ميلا"],
      symbol: "ميل",
      forms: {
        zero: "ميل",
        one: "ميل",
        two: "ميلان",
        few: "أميال",
        many: `ميل${AN}`,
        other: "ميل",
      },
    },
  },
});
