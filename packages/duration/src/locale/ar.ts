import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

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
 * It appears on the two **masculine** units only. A noun ending in tāʾ marbūṭa
 * carries the same tanwīn as a bare mark with no alif under it, so ثانية،
 * دقيقة and ساعة spell their `many` row exactly like their singular — see each
 * unit's own note below.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the duration units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table, and this is the package where Arabic's grammar costs the most,
 * because five of these six nouns are native Arabic words rather than
 * borrowings — so they take **broken plurals**, which are formed by re-arranging
 * the stem and cannot be produced by any suffix rule.
 *
 * **Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on one axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Russian has eight on two axes.
 * Taking ساعة through all six:
 *
 * ```
 * zero   0            ساعة       genitive singular
 * one    1            ساعة       nominative singular
 * two    2            ساعتان     the DUAL — a suffix, not a second word, and
 *                                on a feminine noun it *replaces* the ة
 * few    3-10         ساعات      plural
 * many   11-99        ساعة       accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    ساعة       genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ يومًا" is a singular noun in the accusative,
 * which is why the masculines spell it with the alif of `AN` above and not with
 * a plural. And `other` — where every fraction lands, and where a count-free
 * conversion target lands (ruling R5) — is the genitive **singular**, so
 * "1.5 ساعة" and never "1.5 ساعات". That is the opposite of French, where a bare
 * target is plural, and it is what makes "1 h + 30 min" print a singular noun.
 *
 * `zero`, `one` and `other` hold the same string on every unit here, and on the
 * three feminines `many` holds it as well. That is correct, not a half-finished
 * table: those cells differ only in a final short vowel, and Arabic does not
 * write short vowels.
 *
 * **Gender changes two rows, not one.** A noun ending in tāʾ marbūṭa (ثانية،
 * دقيقة، ساعة) builds its dual by *replacing* the ة — ساعة becomes ساعتان — which
 * no suffix strip undoes, so every one of those duals has to be a listed alias.
 * And its accusative takes no alif, because the tanwīn sits on the ة itself, so
 * its written `many` form is spelled exactly like the singular. The masculines
 * (يوم، أسبوع) do the opposite: their dual is a plain suffix the stripper can
 * undo, and their tamyīz is visibly different from the singular.
 *
 * **Broken plurals are why the alias lists are long.** ثوان، دقائق، أيام and
 * أسابيع are formed by re-arranging the stem, so there is no ending for
 * `@smartput/core/locale/ar`'s suffix stripper to take off and nothing in the
 * analyzer chain can derive them. Rule: every form this file prints is a form it
 * lists. The hamza spellings need the same care in the other direction — the
 * orthographic fold deletes a hamza the user typed and can never invent one they
 * did not — so أيام is listed beside ايام, and أسابيع beside اسابيع, or a
 * plain-alif typist reaches nothing.
 *
 * **Symbols split down R8's two branches, and the split is real rather than
 * inconsistent.** Arabic genuinely abbreviates the clock units: ث for ثانية، د
 * for دقيقة، س for ساعة is what an Arabic timetable and an Arabic stopwatch
 * print. It does not abbreviate the day or the week at all, so those two take
 * the spelled nominative singular, which is R8's fallback and the same choice
 * `en` makes for a unit it writes out. Each of the three letters is listed as an
 * alias, which is also why `@smartput/core/locale/ar` floors its suffix stripper
 * at `minStem: 2` — a floor that could manufacture a one-letter stem would put
 * ث، د and س in reach of every three-letter word in the language.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "2 ساعتان" holds the number first exactly as "2 hours" does, and the
 * Unicode Bidirectional Algorithm is what puts it on the right at display time.
 * Nothing is reversed and nothing should be; `@smartput/core/locale/ar`'s header
 * names the two "fixes" that break the round trip.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "duration",
  units: {
    /**
     * **The one unit with no `forms`, and no Arabic symbol either.**
     *
     * Arabic's name for the millisecond is "ميلي ثانية" — two words, because
     * ثانية is a native noun that the borrowed prefix cannot fuse to the way it
     * fuses in كيلوغرام or ميليمتر. `parse/lex.ts` builds a word token out of a
     * run of letters, so a space ends the token: the phrase reaches the resolver
     * as two words and no alias can ever claim it. A `forms` table here would be
     * six rows of prose no input could reach, which is the ruling `speed`'s
     * "metres per second" and `energy`'s "watt hour" already record.
     *
     * That leaves the symbol, and Arabic has no settled one-token abbreviation
     * for it. "م.ث" is what a datasheet writes, and "." is not a letter — the
     * token ends there and a printed "500 م.ث" would come back as "م" plus a
     * stray character, exactly the reason `@smartput/duration/locale/ru` prints
     * the dotless "дн" instead of "дн.". The dotless contraction "مث" was the
     * obvious next move and is **not** taken: unlike ru's "дн" it is not a
     * spelling anyone writes, it is one this file would have coined, and R8 asks
     * for the language's own abbreviation or the spelled singular — never an
     * invented one.
     *
     * So the Latin "ms" ships, which is what Arabic technical writing prints
     * anyway, and it costs nothing to read back because `units.ts` already
     * declares it. `@smartput/energy/locale/uk` makes the identical call for
     * BTU, and for the identical reason.
     */
    ms: { aliases: alias("ms"), symbol: "ms" },
    /**
     * Feminine. The dual replaces the ة (ثانية → ثانيتان), and the plural is
     * **broken**: ثوان, from a re-arranged stem, not ثانيات. Fully vocalised it
     * is ثوانٍ, with a kasratan the orthographic fold in
     * `@smartput/core/locale/ar` deletes on the way in — so a reader who types
     * the vocalised spelling still lands here, while the bare ثوان is what gets
     * printed. ثواني is the colloquial spelling of the same plural and is listed
     * beside it.
     *
     * `many` is ثانية and not ثانيةً with a visible ending: the tanwīn on a tāʾ
     * marbūṭa is a bare mark with no alif under it, so "١١ ثانية" and "١ ثانية"
     * are the same string in unvocalised writing.
     */
    s: {
      aliases: [...alias("s"), "ث", "ثانية", "ثانيتان", "ثوان", "ثواني"],
      symbol: "ث",
      forms: {
        zero: "ثانية",
        one: "ثانية",
        two: "ثانيتان",
        few: "ثوان",
        many: "ثانية",
        other: "ثانية",
      },
    },
    // Feminine, and another broken plural: دقائق, with an infixed alif and a
    // hamza the singular has no trace of. "دق" is the clipped spelling an Arabic
    // stopwatch reading uses beside the bare د; neither is derivable from the
    // other, so both are listed.
    min: {
      aliases: [...alias("min"), "د", "دق", "دقيقة", "دقيقتان", "دقائق"],
      symbol: "د",
      forms: {
        zero: "دقيقة",
        one: "دقيقة",
        two: "دقيقتان",
        few: "دقائق",
        many: "دقيقة",
        other: "دقيقة",
      },
    },
    // Feminine, and the one unit here whose plural is *sound* rather than
    // broken: ساعات is the ordinary feminine ـات ending, which the suffix
    // stripper could in fact undo. It is listed anyway, because a printed form
    // recovered only through a penalised guess is a form this vocabulary does
    // not really own — and because listing it costs one line.
    h: {
      aliases: [...alias("h"), "س", "ساعة", "ساعتان", "ساعات"],
      symbol: "س",
      forms: {
        zero: "ساعة",
        one: "ساعة",
        two: "ساعتان",
        few: "ساعات",
        many: "ساعة",
        other: "ساعة",
      },
    },
    // Masculine, so the two rows the feminines collapse are separate here: the
    // dual يومان is a plain suffix, and the tamyīz يومًا carries the alif that
    // makes "١١ يومًا" visibly different from "١ يوم". أيام is the broken plural
    // — the stem re-arranged, nothing appended — and ايام is the same word after
    // the orthographic fold, listed because that fold runs one way only.
    //
    // The symbol is the noun itself: Arabic writes يوم out and has no
    // abbreviation for it, which is R8's second branch.
    d: {
      aliases: [...alias("d"), "يوم", "يومان", "أيام", "ايام", `يوم${AN}`, "يوما"],
      symbol: "يوم",
      forms: {
        zero: "يوم",
        one: "يوم",
        two: "يومان",
        few: "أيام",
        many: `يوم${AN}`,
        other: "يوم",
      },
    },
    // Masculine, and the unit with a hamza in every form: أسبوع، أسبوعان،
    // أسابيع. Each is listed twice — once as written and once with the plain
    // alif — because the fold deletes a hamza and can never invent one, so a
    // typist who writes اسبوع reaches nothing unless that spelling is declared.
    // أسابيع is broken (the stem re-arranged around an infixed alif and a
    // yāʾ), so nothing in the analyzer chain could have derived it.
    wk: {
      aliases: [
        ...alias("wk"),
        "أسبوع",
        "اسبوع",
        "أسبوعان",
        "اسبوعان",
        "أسابيع",
        "اسابيع",
        `أسبوع${AN}`,
        "أسبوعا",
        "اسبوعا",
      ],
      symbol: "أسبوع",
      forms: {
        zero: "أسبوع",
        one: "أسبوع",
        two: "أسبوعان",
        few: "أسابيع",
        many: `أسبوع${AN}`,
        other: "أسبوع",
      },
    },
  },
});
