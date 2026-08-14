import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) sitting
 * on the final consonant, then the alif (U+0627) that carries it, in that
 * codepoint order.
 *
 * Written the way `@smartput/core/locale/ar` writes the same two characters in
 * its suffix stripper, and for the same reason. U+064B is a combining mark that
 * renders *on top of* the letter before it, so a literal is a smudge one
 * careless retype away from vanishing — and if it vanished, the `many` row would
 * silently become the `one` row and every test here would still pass, because
 * the bare spelling is a listed alias too.
 *
 * The alif, unlike the mark, is a letter ordinary Arabic prose actually writes:
 * "١١ ميغابايتا" is what a newspaper sets. So this ending is not a diacritic the
 * repo could fold away — it is a real, visible difference between the singular
 * and the tamyīz, and that is exactly why Arabic needs a `many` row at all.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the datasize units — the same nine `en` next door names, and
 * the same per-unit decision: all nine are single nouns an Arabic speaker writes
 * out, so all nine carry `forms`.
 *
 * Arabic is the hardest language shipped here, and the three reasons all show up
 * in this file.
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on one axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Russian has eight on two axes. The
 * `two` row is a *dual*: بايتان is a suffixed form of the noun meaning precisely
 * two of the thing, and no other language in this repo has one. Taking بايت
 * through all six:
 *
 * ```
 * zero   0            بايت        genitive singular
 * one    1            بايت        nominative singular
 * two    2            بايتان      the DUAL — a suffix, not a second word
 * few    3-10         بايتات      plural
 * many   11-99        بايتًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    بايت        genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ بايتًا" is a singular noun in the accusative,
 * which is why it is spelled with the alif of `AN` above and not with the
 * plural's ـات. And `other` — where every fraction lands, and where a count-free
 * conversion target lands (ruling R5) — is the genitive **singular**, so
 * "1.5 ميغابايت" and never "1.5 ميغابايتات". That is the opposite of French,
 * where a bare target is plural.
 *
 * `zero`, `one` and `other` hold the *same string* on every unit here. That is
 * correct, not a half-finished table: the three differ only in a final short
 * vowel, and Arabic does not write short vowels.
 *
 * **2. The digits.** `@smartput/core/locale/ar` pins
 * `numberFormat: { group: ",", decimal: "." }` — the `latn` numbering system,
 * transcribed rather than read from `Intl`, because the engine can only *emit*
 * Latin digits (`Decimal.toFixed()` is ASCII, `lex`'s `isDigit` is a `"0"…"9"`
 * range check) and pairing them with Arabic-Indic separators would produce
 * `1٬234٫5`, a hybrid nobody writes. So every number in this file's tests is
 * Latin, and "٥ ميغابايت" is a core-level gap named in `ar.ts` rather than one a
 * word list could close.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 بايتان" holds the number first and the noun second exactly
 * as "2 bytes" does, and the Unicode Bidirectional Algorithm is what puts the
 * number on the right when it is displayed. **Nothing here is reversed, and
 * nothing here should be.** A "fix" that swapped the order would emit the noun
 * before the number in memory, which `parse` then reads as a unit followed by a
 * number, and `parse(format(v)) === v` breaks.
 *
 * **The decimal and binary families stay apart, in Arabic too.** `kb` is 1000
 * bytes and `kib` is 1024, so كيلوبايت and كيبيبايت are two units and never two
 * spellings of one — the same ruling `en.ts` records. The IEC prefixes are
 * transcribed rather than translated (كيبي، ميبي، غيبي، تيبي), which is what
 * every standards body that has published them in Arabic does; there is no
 * Arabic root for "binary kilo" to reach for.
 *
 * `symbol` is the spelled nominative singular on all nine, which is R8's second
 * branch rather than its first. Arabic *has* no settled one-token abbreviation
 * here: the forms in use are "ك.ب" and "م.ب", and a dot is not a letter, so
 * `parse/lex.ts` ends the word token at it and a printed "5 م.ب" would come back
 * as "م" followed by a stray character. Rather than invent a dotless
 * contraction, the noun itself is the symbol — it is one token, it is already an
 * alias, and it is what an Arabic sentence writes anyway.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "2 gb" keeps working in an Arabic engine and the micro path (`parseDatasize`)
 * cannot drift from it. The ج spellings (ميجابايت، جيجابايت) are appended
 * because Egyptian and Levantine Arabic write the foreign /g/ with jīm where the
 * Gulf writes it with ghayn — one prefix, two spellings, both read and one
 * printed.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "datasize",
  units: {
    // All nine units here are **byte** units. `b` is the byte, not the bit — the
    // ratio table canonicalizes on it and `en.ts` spells it "byte" — so the
    // Arabic stem is بايت throughout and بت appears nowhere. Bits belong to
    // `@smartput/datarate`, whose Arabic vocabulary lives in its own package.
    b: {
      aliases: [...alias("b"), "بايت", "بايتان", "بايتات", `بايت${AN}`, "بايتا"],
      symbol: "بايت",
      forms: {
        zero: "بايت",
        one: "بايت",
        two: "بايتان",
        few: "بايتات",
        many: `بايت${AN}`,
        other: "بايت",
      },
    },
    kb: {
      aliases: [
        ...alias("kb"),
        "كيلوبايت",
        "كيلوبايتان",
        "كيلوبايتات",
        `كيلوبايت${AN}`,
        "كيلوبايتا",
      ],
      symbol: "كيلوبايت",
      forms: {
        zero: "كيلوبايت",
        one: "كيلوبايت",
        two: "كيلوبايتان",
        few: "كيلوبايتات",
        many: `كيلوبايت${AN}`,
        other: "كيلوبايت",
      },
    },
    mb: {
      aliases: [
        ...alias("mb"),
        "ميغابايت",
        "ميجابايت",
        "ميغابايتان",
        "ميغابايتات",
        `ميغابايت${AN}`,
        "ميغابايتا",
      ],
      symbol: "ميغابايت",
      forms: {
        zero: "ميغابايت",
        one: "ميغابايت",
        two: "ميغابايتان",
        few: "ميغابايتات",
        many: `ميغابايت${AN}`,
        other: "ميغابايت",
      },
    },
    gb: {
      aliases: [
        ...alias("gb"),
        "غيغابايت",
        "جيجابايت",
        "غيغابايتان",
        "غيغابايتات",
        `غيغابايت${AN}`,
        "غيغابايتا",
      ],
      symbol: "غيغابايت",
      forms: {
        zero: "غيغابايت",
        one: "غيغابايت",
        two: "غيغابايتان",
        few: "غيغابايتات",
        many: `غيغابايت${AN}`,
        other: "غيغابايت",
      },
    },
    tb: {
      aliases: [
        ...alias("tb"),
        "تيرابايت",
        "تيرابايتان",
        "تيرابايتات",
        `تيرابايت${AN}`,
        "تيرابايتا",
      ],
      symbol: "تيرابايت",
      forms: {
        zero: "تيرابايت",
        one: "تيرابايت",
        two: "تيرابايتان",
        few: "تيرابايتات",
        many: `تيرابايت${AN}`,
        other: "تيرابايت",
      },
    },
    // The IEC four. Transcribed, not translated: كيبي is "kibi", and it is a
    // coined prefix in Arabic exactly as it is in English. The alternative — a
    // descriptive "كيلوبايت ثنائي" — is two words and could never lex back.
    kib: {
      aliases: [
        ...alias("kib"),
        "كيبيبايت",
        "كيبيبايتان",
        "كيبيبايتات",
        `كيبيبايت${AN}`,
        "كيبيبايتا",
      ],
      symbol: "كيبيبايت",
      forms: {
        zero: "كيبيبايت",
        one: "كيبيبايت",
        two: "كيبيبايتان",
        few: "كيبيبايتات",
        many: `كيبيبايت${AN}`,
        other: "كيبيبايت",
      },
    },
    mib: {
      aliases: [
        ...alias("mib"),
        "ميبيبايت",
        "ميبيبايتان",
        "ميبيبايتات",
        `ميبيبايت${AN}`,
        "ميبيبايتا",
      ],
      symbol: "ميبيبايت",
      forms: {
        zero: "ميبيبايت",
        one: "ميبيبايت",
        two: "ميبيبايتان",
        few: "ميبيبايتات",
        many: `ميبيبايت${AN}`,
        other: "ميبيبايت",
      },
    },
    gib: {
      aliases: [
        ...alias("gib"),
        "غيبيبايت",
        "جيبيبايت",
        "غيبيبايتان",
        "غيبيبايتات",
        `غيبيبايت${AN}`,
        "غيبيبايتا",
      ],
      symbol: "غيبيبايت",
      forms: {
        zero: "غيبيبايت",
        one: "غيبيبايت",
        two: "غيبيبايتان",
        few: "غيبيبايتات",
        many: `غيبيبايت${AN}`,
        other: "غيبيبايت",
      },
    },
    tib: {
      aliases: [
        ...alias("tib"),
        "تيبيبايت",
        "تيبيبايتان",
        "تيبيبايتات",
        `تيبيبايت${AN}`,
        "تيبيبايتا",
      ],
      symbol: "تيبيبايت",
      forms: {
        zero: "تيبيبايت",
        one: "تيبيبايت",
        two: "تيبيبايتان",
        few: "تيبيبايتات",
        many: `تيبيبايت${AN}`,
        other: "تيبيبايت",
      },
    },
  },
});
