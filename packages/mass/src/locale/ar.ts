import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

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
 * "١١ كيلوغراما" is what a newspaper sets. So this ending is not a diacritic the
 * repo could fold away — it is a real, visible difference between the singular
 * and the tamyīz, and that is exactly why Arabic needs a `many` row at all.
 */
const AN = "\u064Bا";

/**
 * Arabic words for the mass units — the same six units `en` next door names,
 * and the same per-unit decision: all six are nouns an Arabic speaker writes
 * out, so all six carry `forms`.
 *
 * Arabic is the hardest language shipped here, and it is worth naming the three
 * reasons where a translator will actually meet them.
 *
 * **1. Six `forms` keys, one of which is a dual.** `arabic.selectForm` returns
 * exactly the six CLDR categories on one axis — `zero`, `one`, `two`, `few`,
 * `many`, `other` — where English has two and Ukrainian has eight on two axes.
 * The `two` row is a *dual*: كيلوغرامان is a suffixed form of the noun meaning
 * precisely two of the thing, and no other language in this repo has one. Taking
 * كيلوغرام through all six:
 *
 * ```
 * zero   0            كيلوغرام        genitive singular
 * one    1            كيلوغرام        nominative singular
 * two    2            كيلوغرامان      the DUAL — a suffix, not a second word
 * few    3-10         كيلوغرامات      plural
 * many   11-99        كيلوغرامًا      accusative SINGULAR with tanwīn (tamyīz)
 * other  100+, all    كيلوغرام        genitive singular
 *        fractions
 * ```
 *
 * Two rows are the ones a table ported by renaming English columns gets wrong.
 * `many` is **not a plural**: "١١ كيلوغرامًا" is a singular noun in the
 * accusative, which is why it is spelled with the alif of `AN` above and not
 * with the plural's ـات. And `other` — where the fractions land, and where a
 * count-free conversion target lands (ruling R5) — is the genitive **singular**,
 * so "1.5 كيلوغرام" and never "1.5 كيلوغرامات". That is the opposite of French,
 * where a bare target is plural, and it is the assertion `ar.test.ts` pins.
 *
 * `zero`, `one` and `other` hold the *same string* on every unit here. That is
 * correct, not a half-finished table: the three differ only in a final short
 * vowel, and Arabic does not write short vowels. A vocabulary that invented
 * three different spellings would be inventing them.
 *
 * **2. The digits, and why every number in this file's tests is Latin.**
 * `@smartput/core/locale/ar` pins `numberFormat: { group: ",", decimal: "." }`
 * — the `latn` numbering system, written out rather than read from `Intl`. The
 * engine can only *emit* Latin digits (`Decimal.toFixed()` is ASCII, `lex`'s
 * `isDigit` is a `"0"…"9"` range check), so pairing Arabic-Indic separators with
 * them would produce `1٬234٫5`, a hybrid nobody writes, and would not buy
 * Arabic-Indic *input* either — ٥ is neither a digit nor a letter and `lex`
 * drops it. So this vocabulary reads and prints beside Latin digits, and
 * "٥ كغ" is a core-level gap named in `ar.ts`, not one a word list can close.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "2 كيلوغرامان" holds the number first and the noun second
 * exactly as "2 kilograms" does, and the Unicode Bidirectional Algorithm is what
 * puts the number on the right when it is displayed. **Nothing here is reversed,
 * and nothing here should be.** A "fix" that swapped the order would emit the
 * noun before the number in memory, which `parse` then reads as a unit followed
 * by a number, and `parse(format(v)) === v` breaks.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in an Arabic engine and
 * the micro path (`parseMass`) cannot drift from it. The Arabic spellings are
 * appended in every shape a reader is likely to type, and three groups of them
 * are there because `arabic`'s analyzers *cannot* reach them:
 *
 * - **Broken plurals** (أطنان, أرطال). Arabic forms them by re-arranging the
 *   stem, so there is no ending for the suffix stripper to take off.
 * - **Hamza spellings.** The orthographic fold runs one way — it deletes a
 *   hamza the user typed and can never invent one they did not — so أونصة needs
 *   اونصة listed beside it, or a plain-alif typist reaches nothing.
 * - **The bare tamyīz** (كيلوغراما, no mark). The stripper does recover it, at
 *   `weight: -2`; listing it means the commonest spelling of the `many` row is
 *   read at full weight instead of through a guess.
 *
 * `symbol` is Arabic where Arabic actually abbreviates — كغ, غ, ملغ are what a
 * scale, a recipe and a medicine box print — and the spelled nominative singular
 * where it does not: طن, أونصة and رطل have no accepted Arabic abbreviation, the
 * same choice `en` makes for units it writes out. R8 wants an explicit symbol on
 * every unit, not an invented one.
 *
 * One deviation from idiomatic Arabic is structural and worth stating rather
 * than hiding. Arabic normally omits the numeral for one and two, because the
 * noun's own form already says it — a shopkeeper writes كيلوغرامان, not
 * "٢ كيلوغرامان" — and CLDR's `two` pattern for `ar` accordingly has no `{0}`
 * placeholder in it. `renderQuantity` always prints the number, and must:
 * dropping it would emit a string with no number token in it, which `parse`
 * cannot read back as a quantity at all.
 *
 * Like `en`, this file names `mass` by id string and never imports the kind,
 * which is what lets `@smartput/mass/locale/ar` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "mass",
  units: {
    // مليغرام with one lām is the spelling in ordinary use; ملليغرام doubles it
    // to mirror the geminate of "milli-" and ميليغرام transliterates the vowel
    // instead. All three are read, one is printed — recognition is many-to-one
    // and only generation has to choose. مليجرام is the same word with the
    // Egyptian jīm for the foreign /g/, which is a pronunciation difference
    // written down, not a different unit.
    mg: {
      aliases: [
        ...alias("mg"),
        "ملغ",
        "ملغم",
        "مليغرام",
        "ملليغرام",
        "ميليغرام",
        "مليجرام",
        "مليغرامان",
        "مليغرامات",
        `مليغرام${AN}`,
        "مليغراما",
      ],
      symbol: "ملغ",
      forms: {
        zero: "مليغرام",
        one: "مليغرام",
        two: "مليغرامان",
        few: "مليغرامات",
        many: `مليغرام${AN}`,
        other: "مليغرام",
      },
    },
    g: {
      aliases: [
        ...alias("g"),
        "غ",
        "غم",
        "جم",
        "غرام",
        "جرام",
        "غرامان",
        "غرامات",
        `غرام${AN}`,
        "غراما",
      ],
      symbol: "غ",
      forms: {
        zero: "غرام",
        one: "غرام",
        two: "غرامان",
        few: "غرامات",
        many: `غرام${AN}`,
        other: "غرام",
      },
    },
    // كيلو is the colloquial clipping and it means *kilogram* in Arabic speech,
    // never kilometre, which is why it is listed here and not in
    // `@smartput/length/locale/ar`. Same reason `units.ts` lists "kilo".
    kg: {
      aliases: [
        ...alias("kg"),
        "كغ",
        "كغم",
        "كجم",
        "كيلو",
        "كيلوغرام",
        "كيلوجرام",
        "كيلوغرامان",
        "كيلوغرامات",
        `كيلوغرام${AN}`,
        "كيلوغراما",
      ],
      symbol: "كغ",
      forms: {
        zero: "كيلوغرام",
        one: "كيلوغرام",
        two: "كيلوغرامان",
        few: "كيلوغرامات",
        many: `كيلوغرام${AN}`,
        other: "كيلوغرام",
      },
    },
    // Two letters, and the unit `@smartput/core/locale/ar` names when it
    // explains why its suffix stripper floors at `minStem: 2` rather than 3:
    // طنان has to reduce to طن, and a floor of 3 would lose it. The 3-10 row is
    // the broken plural أطنان — the stem re-arranged, not suffixed — so it is
    // listed as an alias because nothing in the analyzer chain can derive it.
    t: {
      aliases: [...alias("t"), "طن", "طنان", "أطنان", "اطنان", `طن${AN}`, "طنا"],
      symbol: "طن",
      forms: {
        zero: "طن",
        one: "طن",
        two: "طنان",
        few: "أطنان",
        many: `طن${AN}`,
        other: "طن",
      },
    },
    // The feminine one, and it changes two rows rather than swapping a stem.
    // A noun ending in tāʾ marbūṭa builds its dual by *replacing* the ة —
    // أونصة becomes أونصتان — which no suffix strip undoes, so the dual is an
    // alias here of necessity. And its accusative takes no alif: the tanwīn on a
    // ة is a bare mark, so the written `many` form is spelled exactly like the
    // singular. Hence no `AN` on this unit, and four of its six rows coincide.
    //
    // أوقية is left out on purpose. It is what a nutrition label often uses for
    // an ounce, but it is also a historical unit of a different weight and the
    // name of the Mauritanian currency, so claiming it here would make one
    // surface mean three things — the same reason `@smartput/area/locale/ar`
    // declines فدان for the acre.
    oz: {
      aliases: [
        ...alias("oz"),
        "أونصة",
        "اونصة",
        "أونصتان",
        "اونصتان",
        "أونصات",
        "اونصات",
      ],
      symbol: "أونصة",
      forms: {
        zero: "أونصة",
        one: "أونصة",
        two: "أونصتان",
        few: "أونصات",
        many: "أونصة",
        other: "أونصة",
      },
    },
    // رطل is the Arabic word for the pound and takes the broken plural أرطال.
    // باوند is the transliteration, read but not printed: it is also how Arabic
    // writes the pound *sterling*, and a printer that emitted it would be
    // choosing the ambiguous spelling over the unambiguous one.
    lb: {
      aliases: [
        ...alias("lb"),
        "رطل",
        "رطلان",
        "أرطال",
        "ارطال",
        `رطل${AN}`,
        "رطلا",
        "باوند",
        "باوندات",
      ],
      symbol: "رطل",
      forms: {
        zero: "رطل",
        one: "رطل",
        two: "رطلان",
        few: "أرطال",
        many: `رطل${AN}`,
        other: "رطل",
      },
    },
  },
});
