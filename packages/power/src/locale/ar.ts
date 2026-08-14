import { aliasesFor, defineVocabulary } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) on the
 * final consonant, then the alif (U+0627) that carries it, in that codepoint
 * order.
 *
 * Written the way `@smartput/core/locale/ar` writes the same two characters in
 * its suffix stripper, and for the same reason. U+064B is a combining mark that
 * renders *on top of* the letter before it, so a literal is a smudge one
 * careless retype away from vanishing — and if it vanished, the `many` row would
 * silently become the `one` row and every test here would still pass, because
 * the bare spelling is a listed alias too.
 *
 * Every unit in this kind is masculine and ends in a consonant, so every one of
 * them takes the visible alif — unlike `energy`'s سعرة or `duration`'s ساعة,
 * where the tanwīn sits on a tāʾ marbūṭa and nothing is written.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the power units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table, and unlike Russian's — which drops `hp` because "лошадиная
 * сила" is two inflecting words — all five units here keep one, because Arabic
 * says the horsepower with a single noun.
 *
 * **Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on one axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Russian has eight on two axes.
 * Taking واط through all six:
 *
 * ```
 * zero   0            واط        genitive singular
 * one    1            واط        nominative singular
 * two    2            واطان      the DUAL — a suffix, not a second word
 * few    3-10         واطات      plural
 * many   11-99        واطًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    واط        genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ واطًا" is a singular noun in the accusative,
 * which is why it takes the alif of `AN` above rather than the plural's ـات. And
 * `other` — every fraction, and a count-free conversion target (ruling R5) — is
 * the genitive **singular**, so "1.5 كيلوواط" and never "1.5 كيلوواطات". That is
 * the opposite of French, where a bare target is plural.
 *
 * `zero`, `one` and `other` hold the same string on every unit. That is correct,
 * not a half-finished table: they differ only in a final short vowel, and Arabic
 * does not write short vowels.
 *
 * **Symbols are the spelled nominative singulars**, R8's second branch. The
 * single-letter symbol Arabic physics writing uses for the watt is و — which is
 * also the conjunction "and", the commonest word in the language and a prefix
 * `@smartput/core/locale/ar` explicitly refuses to strip for exactly that
 * reason. Printing it would put a unit label on a surface that means "and", so
 * the noun ships instead. It is one token, it is already an alias, and it is
 * what an Arabic sentence writes.
 *
 * **Two spellings of the same borrowing are read.** واط and وات are one word: the
 * Gulf and the Levant differ on whether to write the final ṭāʾ or tāʾ, and the
 * same goes for كيلوواط/كيلووات. And ميغا/ميجا، غيغا/جيجا are the foreign /g/
 * written with ghayn or with jīm. All are read; one of each is printed, since
 * recognition is many-to-one while generation stays the single `forms` table.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "5 kw" keeps working in an Arabic engine and the micro path (`parsePower`)
 * cannot drift from it.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "2 واطان" holds the number first exactly as "2 watts" does, and the
 * Unicode Bidirectional Algorithm is what puts it on the right at display time.
 * Nothing is reversed and nothing should be.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "power",
  units: {
    w: {
      aliases: [...alias("w"), "واط", "وات", "واطان", "واطات", `واط${AN}`, "واطا"],
      symbol: "واط",
      forms: {
        zero: "واط",
        one: "واط",
        two: "واطان",
        few: "واطات",
        many: `واط${AN}`,
        other: "واط",
      },
    },
    kw: {
      aliases: [
        ...alias("kw"),
        "كيلوواط",
        "كيلووات",
        "كيلوواطان",
        "كيلوواطات",
        `كيلوواط${AN}`,
        "كيلوواطا",
      ],
      symbol: "كيلوواط",
      forms: {
        zero: "كيلوواط",
        one: "كيلوواط",
        two: "كيلوواطان",
        few: "كيلوواطات",
        many: `كيلوواط${AN}`,
        other: "كيلوواط",
      },
    },
    // The megawatt, matching `units.ts`: the milliwatt has no spelling in this
    // kind in any language, because "MW" and "mW" fold to one alias key. Arabic
    // would not even have the casing to lose — its script has no case at all —
    // so the ruling costs it nothing to honour.
    mw: {
      aliases: [
        ...alias("mw"),
        "ميغاواط",
        "ميجاواط",
        "ميغاوات",
        "ميغاواطان",
        "ميغاواطات",
        `ميغاواط${AN}`,
        "ميغاواطا",
      ],
      symbol: "ميغاواط",
      forms: {
        zero: "ميغاواط",
        one: "ميغاواط",
        two: "ميغاواطان",
        few: "ميغاواطات",
        many: `ميغاواط${AN}`,
        other: "ميغاواط",
      },
    },
    gw: {
      aliases: [
        ...alias("gw"),
        "غيغاواط",
        "جيجاواط",
        "غيغاوات",
        "غيغاواطان",
        "غيغاواطات",
        `غيغاواط${AN}`,
        "غيغاواطا",
      ],
      symbol: "غيغاواط",
      forms: {
        zero: "غيغاواط",
        one: "غيغاواط",
        two: "غيغاواطان",
        few: "غيغاواطات",
        many: `غيغاواط${AN}`,
        other: "غيغاواط",
      },
    },
    /**
     * **The unit Russian had to give up on, and Arabic does not.**
     *
     * `@smartput/power/locale/ru` ships `hp` with no `forms` and the contracted
     * symbol "лс", because Russian says "лошадиная сила" — an adjective agreeing
     * with a noun, so a space sits inside the unit label and `parse/lex.ts` ends
     * the word token there. Arabic says حصان, one word, which is the whole of the
     * difference: a car spec sheet in Arabic reads "قوة ٣٠٠ حصان", and حصان is
     * the token after the number.
     *
     * So this unit gets the full six-row table, and its rows are not the
     * borrowings' rows. حصان is a **native** Arabic noun, so its plural is
     * *broken*: أحصنة, the stem re-arranged around an added hamza and a tāʾ
     * marbūṭa, which no suffix rule can produce and which therefore has to be a
     * listed alias — twice, since the orthographic fold deletes a hamza and can
     * never invent one, so احصنة is declared beside it.
     *
     * حصانات, the sound plural, is listed and never printed. It is what a writer
     * who treats حصان as a borrowed measure noun rather than as a horse will
     * type, and recognition is many-to-one while generation stays the one table.
     * The same goes for the invariant "٥ حصان" of loose usage: it is already the
     * `one`/`other` spelling, so it reads without a second entry.
     */
    hp: {
      aliases: [
        ...alias("hp"),
        "حصان",
        "حصانان",
        "أحصنة",
        "احصنة",
        "حصانات",
        `حصان${AN}`,
        "حصانا",
      ],
      symbol: "حصان",
      forms: {
        zero: "حصان",
        one: "حصان",
        two: "حصانان",
        few: "أحصنة",
        many: `حصان${AN}`,
        other: "حصان",
      },
    },
  },
});
