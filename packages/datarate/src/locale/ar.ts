import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) on the
 * final consonant, then the alif (U+0627) that carries it, in that codepoint
 * order.
 *
 * Written the way `@smartput/core/locale/ar` writes the same two characters in
 * its suffix stripper, and for the same reason: U+064B is a combining mark that
 * renders *on top of* the letter before it, so a literal is a smudge one
 * careless retype away from vanishing — and it would vanish silently, because
 * the bare spelling is a listed alias too.
 *
 * This kind prints none of these forms (see the `forms` ruling below), so here
 * the ending only ever appears on the reading side: "١١ ميغابتًا" is what a
 * careful Arabic writer types, and the vocabulary has to understand it.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the datarate units.
 *
 * Shaped exactly like `en.ts` and `ru.ts` next door, down to naming `datarate`
 * by **id string** rather than importing the kind — that is what lets this file
 * be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and `ru.ts`
 * restates, and Arabic is the language where it bites hardest. Arabic writes a
 * rate as "ميغابت في الثانية" — three words, and the middle one is في, which
 * `@smartput/core/locale/ar` claims as the `in` keyword. So the spelled-out
 * name would not merely fail to lex as one unit token; it would lex as a
 * *conversion*, "megabits into the second". The abbreviated "م.ب/ث" is no better
 * from the other end: "/" is always division and "." is not a letter, so the
 * token ends at the first of them. There is no single token in Arabic that
 * means "megabits per second", and a `forms` table here would be six rows of
 * prose no input could ever reach.
 *
 * Absent forms keep the renderer on the symbol. Arabic's `renderQuantity` sets a
 * symbol off from the number with a space (the SI convention holds in Arabic
 * typography, and an Arabic symbol is letters), so a rate prints "100 ميغابت"
 * where Russian prints the tight "100Мбит".
 *
 * **What the symbols give up.** They are the bare nouns — بت، كيلوبت، ميغابت،
 * غيغابت، تيرابت — with the "في الثانية" elided. That is a real loss of meaning:
 * "100 ميغابت" states a count of megabits where the full phrase states a rate.
 * What it buys is that every string this vocabulary can print is a string it can
 * read, and it is the elision an Arabic speaker already makes in speech
 * ("عندي مئة ميغا"). The same trade `ru.ts` makes with "Мбит", and for the same
 * reason.
 *
 * **Aliases.** The Latin set is reused through `aliasesFor` rather than retyped
 * — an Arabic speaker types "100 mbps" as readily as "١٠٠ ميغابت", and deriving
 * them keeps the micro path (`parseDatarate`) and the engine path agreeing by
 * construction — and the Arabic spellings are appended to it. Each unit lists
 * the four shapes the noun takes after a numeral even though none is printed,
 * because recognition is many-to-one while generation stays the one symbol:
 * the singular (بت), the dual (بتان), the sound plural (بتات) and the tamyīz
 * accusative in both its vocalised and its bare spelling (بتًا / بتا).
 *
 * The ج spellings — ميجابت، جيجابت — are not a different unit and not a typo.
 * Egyptian and Levantine Arabic write the foreign /g/ with jīm where the Gulf
 * and the Maghreb write it with ghayn, so ميغا and ميجا are one prefix spelled
 * two ways. Both are read; only the ghayn spelling is printed.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "100 ميغابت" holds the number first exactly as "100 mbps" does and
 * the Unicode Bidirectional Algorithm is what puts it on the right at display
 * time. Nothing in this file is reversed and nothing should be; see
 * `@smartput/core/locale/ar`'s header for the two "fixes" that break the round
 * trip.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "datarate",
  units: {
    // بت is the bit and بايت is the byte — two letters apart in Arabic as in
    // English, and a whole factor of eight apart in meaning. The byte spellings
    // belong to `@smartput/datasize` and deliberately appear nowhere here.
    //
    // Two letters is also exactly the floor `@smartput/core/locale/ar`'s suffix
    // stripper is set at (`minStem: 2`), which is what lets بتان reduce to بت at
    // all; a floor of 3 would lose this unit entirely.
    bps: {
      aliases: [...alias("bps"), "بت", "بتان", "بتات", `بت${AN}`, "بتا"],
      symbol: "بت",
    },
    kbps: {
      aliases: [
        ...alias("kbps"),
        "كيلوبت",
        "كيلوبتان",
        "كيلوبتات",
        `كيلوبت${AN}`,
        "كيلوبتا",
      ],
      symbol: "كيلوبت",
    },
    mbps: {
      aliases: [
        ...alias("mbps"),
        "ميغابت",
        "ميجابت",
        "ميغابتان",
        "ميغابتات",
        `ميغابت${AN}`,
        "ميغابتا",
      ],
      symbol: "ميغابت",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "غيغابت",
        "جيجابت",
        "غيغابتان",
        "غيغابتات",
        `غيغابت${AN}`,
        "غيغابتا",
      ],
      symbol: "غيغابت",
    },
    tbps: {
      aliases: [
        ...alias("tbps"),
        "تيرابت",
        "تيرابتان",
        "تيرابتات",
        `تيرابت${AN}`,
        "تيرابتا",
      ],
      symbol: "تيرابت",
    },
  },
});
