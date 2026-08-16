import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

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
 * It appears on the joule family only. سعرة ends in tāʾ marbūṭa, which carries
 * the same tanwīn as a bare mark with no alif under it, so its `many` row is
 * spelled exactly like its singular.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the energy units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table — and which units get one at all.
 *
 * **Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on one axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Russian has eight on two axes.
 * Taking جول through all six:
 *
 * ```
 * zero   0            جول        genitive singular
 * one    1            جول        nominative singular
 * two    2            جولان      the DUAL — a suffix, not a second word
 * few    3-10         جولات      plural
 * many   11-99        جولًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    جول        genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ جولًا" is a singular noun in the accusative,
 * which is why it takes the alif of `AN` above and not the plural's ـات. And
 * `other` — every fraction, and a count-free conversion target (ruling R5) — is
 * the genitive **singular**, so "1.5 كيلوجول" and never "1.5 كيلوجولات". That is
 * the opposite of French, where a bare target is plural, and it is what makes
 * "1 كيلوجول + 500 جول" print a singular noun.
 *
 * `zero`, `one` and `other` hold the same string on every unit here. That is
 * correct, not a half-finished table: they differ only in a final short vowel,
 * and Arabic does not write short vowels.
 *
 * **Three units carry no `forms`, and one carries no Arabic word at all.** The
 * watt-hour family is a compound in Arabic exactly as it is in English —
 * "كيلوواط ساعة", two words, and `parse/lex.ts` ends a word token at the space —
 * so there is no single token to put in a `forms` table. What ships instead is
 * the interpunct symbol, which is not a fallback but the *correct* Arabic
 * notation and re-reads as arithmetic; see `kwh` below. And BTU is
 * "وحدة حرارية بريطانية", three words abbreviated with dots ("و.ح.ب") that the
 * lexer cannot take either, so it keeps the Latin symbol — the same call
 * `@smartput/energy/locale/uk` makes, and for the same reason.
 *
 * **Symbols.** جول، كيلوجول، سعرة and their relatives are the spelled nominative
 * singulars, R8's second branch: Arabic has no settled one-token abbreviation
 * for any of them, and the letter symbols a physics textbook uses (ج، كج) are
 * borrowed straight from the Latin ones and collide — كج is also the kilogram.
 * Inventing an unambiguous one is what R8 forbids, so the noun itself ships; it
 * is one token, it is already an alias, and it is what an Arabic sentence
 * writes.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "5 kwh" keeps working in an Arabic engine and the micro path (`parseEnergy`)
 * cannot drift from it. The ج spellings (ميجاجول، ميجاواط) are appended because
 * Egyptian and Levantine Arabic write the foreign /g/ with jīm where the Gulf
 * writes it with ghayn — one prefix, two spellings, both read and one printed.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "2 جولان" holds the number first exactly as "2 joules" does, and the
 * Unicode Bidirectional Algorithm is what puts it on the right at display time.
 * Nothing is reversed and nothing should be.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "energy",
  units: {
    // جول is masculine and borrowed, so it takes the productive endings rather
    // than a broken plural: dual جولان, sound plural جولات, tamyīz جولًا. The
    // same paradigm كيلوغرام takes in `@smartput/core/locale/ar`'s worked
    // example, which is the paradigm every borrowed unit noun in this repo's
    // Arabic vocabularies follows.
    j: {
      aliases: [...alias("j"), "جول", "جولان", "جولات", `جول${AN}`, "جولا"],
      symbol: "جول",
      forms: {
        zero: "جول",
        one: "جول",
        two: "جولان",
        few: "جولات",
        many: `جول${AN}`,
        other: "جول",
      },
    },
    kj: {
      aliases: [
        ...alias("kj"),
        "كيلوجول",
        "كيلوجولان",
        "كيلوجولات",
        `كيلوجول${AN}`,
        "كيلوجولا",
      ],
      symbol: "كيلوجول",
      forms: {
        zero: "كيلوجول",
        one: "كيلوجول",
        two: "كيلوجولان",
        few: "كيلوجولات",
        many: `كيلوجول${AN}`,
        other: "كيلوجول",
      },
    },
    mj: {
      aliases: [
        ...alias("mj"),
        "ميغاجول",
        "ميجاجول",
        "ميغاجولان",
        "ميغاجولات",
        `ميغاجول${AN}`,
        "ميغاجولا",
      ],
      symbol: "ميغاجول",
      forms: {
        zero: "ميغاجول",
        one: "ميغاجول",
        two: "ميغاجولان",
        few: "ميغاجولات",
        many: `ميغاجول${AN}`,
        other: "ميغاجول",
      },
    },
    /**
     * The Arabic symbol for the watt-hour family is "كيلوواط·ساعة" — the
     * interpunct is the standard multiplication sign between a unit of power and
     * a unit of time, not decoration, and `parse/lex.ts` reads U+00B7 as a
     * spelling of `*`. So "5 كيلوواط·ساعة" reaches the resolver as "كيلوواط",
     * `*`, "ساعة", and this kind's own `* | power | duration` signature
     * multiplies kilowatts by hours into joules — the route English's "m/s" has
     * always taken, where the symbol is likewise no alias and re-reads as
     * arithmetic. It needs both operands registered, which is why `ar.test.ts`
     * proves it on an engine wired with `@smartput/power` and
     * `@smartput/duration` rather than on this kind alone.
     *
     * The interpunct spellings stay listed anyway, as documentation of what the
     * printer emits rather than as a working alias: "·" ends a word token, so no
     * alias containing one can ever match. Inventing a run-together "كيلوواطساعة"
     * to make one match would put a spelling nobody writes into the vocabulary.
     *
     * The other road not taken was the space-separated "كيلوواط ساعة", which is
     * how the phrase is actually written. It is two tokens, and the second of
     * them — ساعة — is `@smartput/duration`'s word for the hour, so the input
     * would read as a kilowatt followed by a stray unit rather than as a product.
     * The interpunct is the one spelling that is both correct Arabic and one
     * expression.
     */
    wh: { aliases: [...alias("wh"), "واط·ساعة"], symbol: "واط·ساعة" },
    kwh: { aliases: [...alias("kwh"), "كيلوواط·ساعة"], symbol: "كيلوواط·ساعة" },
    mwh: { aliases: [...alias("mwh"), "ميغاواط·ساعة"], symbol: "ميغاواط·ساعة" },
    // The feminine one, and it changes two rows rather than swapping a stem. A
    // noun ending in tāʾ marbūṭa builds its dual by *replacing* the ة — سعرة
    // becomes سعرتان — which no suffix strip undoes, so the dual is a listed
    // alias of necessity. And its accusative takes no alif: the tanwīn on a ة is
    // a bare mark, so the written `many` form is spelled exactly like the
    // singular. Hence no `AN` on this unit, and four of its six rows coincide.
    //
    // "سعرة حرارية" — the full phrase, with the adjective — is what a food label
    // prints, and it is deliberately not an alias: it is two words, and the
    // adjective inflects with the noun, so a table of it would be prose no input
    // could reach. The bare noun is the token people type after a number.
    cal: {
      aliases: [...alias("cal"), "سعرة", "سعرتان", "سعرات"],
      symbol: "سعرة",
      forms: {
        zero: "سعرة",
        one: "سعرة",
        two: "سعرتان",
        few: "سعرات",
        many: "سعرة",
        other: "سعرة",
      },
    },
    // كيلوسعرة, written as one word on the pattern of كيلوغرام and كيلومتر
    // rather than as the two-word "كيلو سعرة" that also appears — the joined
    // spelling is the one that can be a token at all, and Arabic joins كيلو to
    // its noun everywhere else in this repo.
    //
    // The food Calorie is `kcal` here and reachable only as `kcal`, exactly as
    // `units.ts` rules for English: "سعرة" already binds to the thermochemical
    // calorie above, and a capitalisation cannot separate them because aliases
    // fold before they are indexed — and Arabic has no capitals to fold in the
    // first place.
    kcal: {
      aliases: [...alias("kcal"), "كيلوسعرة", "كيلوسعرتان", "كيلوسعرات"],
      symbol: "كيلوسعرة",
      forms: {
        zero: "كيلوسعرة",
        one: "كيلوسعرة",
        two: "كيلوسعرتان",
        few: "كيلوسعرات",
        many: "كيلوسعرة",
        other: "كيلوسعرة",
      },
    },
    // **No Arabic word at all, and that is the finding rather than a gap.**
    // Arabic renders BTU as "وحدة حرارية بريطانية" — three words, one of them an
    // adjective agreeing with the noun — and abbreviates it "و.ح.ب", with dots
    // the lexer skips as unrecognized characters. Neither shape can be one
    // token, so there is nothing to declare: no alias, no `forms`, and the Latin
    // initialism as the symbol. `@smartput/energy/locale/uk` reached the same
    // answer from the other direction (Ukrainian has two competing spellings and
    // no settled one), and `ru.ts` differs only because Russian *does* have a
    // settled "БТЕ" to print.
    btu: { aliases: alias("btu"), symbol: "btu" },
  },
});
