import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

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
 */
const AN = "\u064Bا";

/**
 * Arabic words for the tempo units.
 *
 * The shape is `en.ts`'s: the same `kind` id string (never an import of the
 * kind), `aliases` derived from `units.ts` rather than retyped, and an explicit
 * `symbol` on both units (ruling R8). Two units, and they take opposite
 * decisions about `forms` for the same reason English's do — one of them has a
 * single-token name and the other does not.
 *
 * **`bpm` carries no `forms`.** Arabic says "نبضة في الدقيقة" — three words, and
 * the middle one is في, which `@smartput/core/locale/ar` claims as the `in`
 * keyword, so the spelled-out name would lex as a *conversion* rather than as a
 * unit. The abbreviated "ن/د" carries "/", which is always division. Neither can
 * ever be one token, which is the ruling `en.ts` records for "beats per minute"
 * and `speed`'s mps and kph record for theirs.
 *
 * What ships instead is the bare noun نبضة as the symbol, with the "في الدقيقة"
 * elided. That is a real loss — "120 نبضة" states a count of beats where the
 * full phrase states a rate — and it is the same elision
 * `@smartput/datarate/locale/ru` makes with "Мбит", chosen for the same reason:
 * every string this vocabulary can print is then a string it can read. The
 * alternative was Russian's, a transliteration of the Latin initialism, and
 * Arabic has none in circulation to transliterate.
 *
 * Absent forms keep the renderer on the symbol, and Arabic's `renderQuantity`
 * sets a symbol off from the number with a space, so a tempo prints "120 نبضة"
 * where English prints the tight "120bpm".
 *
 * **`hz` declares all six categories.** هرتز is one token, it is already an
 * alias, and it inflects: dual هرتزان, sound plural هرتزات, tamyīz هرتزًا. Taking
 * it through the six keys `arabic.selectForm` can produce:
 *
 * ```
 * zero   0            هرتز       genitive singular
 * one    1            هرتز       nominative singular
 * two    2            هرتزان     the DUAL — a suffix, not a second word
 * few    3-10         هرتزات     plural
 * many   11-99        هرتزًا     accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    هرتز       genitive singular
 *        fractions
 * ```
 *
 * `many` is **not a plural** — "٥٠ هرتزًا" is a singular noun in the accusative,
 * hence the alif of `AN` above — and `other`, where every fraction and every
 * count-free conversion target lands (ruling R5), is the genitive **singular**.
 * That is what makes "0.5 هرتز" right and "0.5 هرتزات" wrong, and it is the
 * opposite of French.
 *
 * Declining هرتز at all is a decision worth naming, because English does not:
 * `en.ts` spells both its categories "hertz" on the grounds that the word is its
 * own plural. Arabic inflects borrowed unit nouns productively — كيلوغرام duals
 * to كيلوغرامان in `@smartput/core/locale/ar`'s own worked example, and جول، واط
 * and بايت follow it in the vocabularies beside this one — so leaving one
 * borrowing invariant would be the inconsistency, not the inflection. Loose
 * usage does write "٥٠ هرتز" for every count; that spelling is the `one`/`other`
 * row already, so it reads without a second entry.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "2 هرتزان" holds the number first exactly as "2 hertz" does, and the
 * Unicode Bidirectional Algorithm is what puts it on the right at display time.
 * Nothing is reversed and nothing should be.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "tempo",
  units: {
    // نبضة is feminine, so its dual replaces the ة (نبضتان) and its plural is
    // the sound نبضات. Both are listed even though neither is printed: the
    // symbol is the only string this unit can emit, and recognition stays
    // many-to-one. دقة — "beat" in the percussive sense — is left out, because
    // it is also "accuracy" and one surface should not mean both.
    bpm: {
      aliases: [...alias("bpm"), "نبضة", "نبضتان", "نبضات"],
      symbol: "نبضة",
    },
    hz: {
      aliases: [...alias("hz"), "هرتز", "هرتزان", "هرتزات", `هرتز${AN}`, "هرتزا"],
      symbol: "هرتز",
      forms: {
        zero: "هرتز",
        one: "هرتز",
        two: "هرتزان",
        few: "هرتزات",
        many: `هرتز${AN}`,
        other: "هرتز",
      },
    },
  },
});
