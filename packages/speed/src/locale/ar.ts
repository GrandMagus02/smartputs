import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Arabic words for the speed units.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind), `aliases` derived from `units.ts` rather than retyped,
 * and an explicit `symbol` on every unit (ruling R8). What differs is the
 * `forms` table — and which units get one at all, which here is exactly one of
 * the four.
 *
 * **Three of the four are compounds and carry no `forms`.** Arabic writes a
 * speed as "كيلومتر في الساعة" — three words, and the middle one is في, which
 * `@smartput/core/locale/ar` claims as the `in` keyword. So the spelled-out name
 * would not merely fail to lex as one unit token; it would lex as a
 * *conversion*, "kilometres into the hour". The abbreviated forms carry "/",
 * which is always division. Either way there is no single Arabic token meaning
 * "kilometres per hour", and a `forms` table for one would be six rows of prose
 * no input could reach — the ruling `en.ts` records for "metres per second" and
 * `ru.ts` restates for "километров в час".
 *
 * Absent forms keep the renderer on the symbol, and the symbols are the written
 * Arabic ones with their slash intact: م/ث، كم/س، ميل/س. That slash is not a
 * defect being tolerated. `parse/lex.ts` reads "/" as division, so "100 كم/س"
 * reaches the resolver as كم ÷ س and this kind's own `length ÷ duration` bridge
 * turns metres over seconds into a speed — the route English's "m/s" has always
 * taken. It needs `@smartput/length`'s Arabic vocabulary installed beside
 * `@smartput/duration`'s, which is why `ar.test.ts` here asserts the printing
 * and leaves the reading-back to the barrel's own locale test.
 *
 * **The head nouns are deliberately not aliases.** The alias index is one flat
 * map with no kind in the key, so claiming كيلومتر for `kph` here would give
 * "5 كيلومتر" a second reading in any engine where `@smartput/length` is also
 * installed — a length and a speed, told apart by nothing. The bridge above is
 * what Arabic gets instead, and it needs no alias of this kind's at all. The
 * symbols may name them, because a symbol is printed and never indexed.
 *
 * **`knot` is the exception, and it is a real Arabic noun.** عقدة — the nautical
 * knot — is one word, so it declares all six categories:
 *
 * ```
 * zero   0            عقدة       genitive singular
 * one    1            عقدة       nominative singular
 * two    2            عقدتان     the DUAL — and on a feminine noun the suffix
 *                                *replaces* the ة rather than following it
 * few    3-10         عقد        the broken plural: the stem re-arranged
 * many   11-99        عقدة       accusative SINGULAR with tanwīn (tamyīz), and
 *                                a tanwīn on a tāʾ marbūṭa writes nothing
 * other  100+, all    عقدة       genitive singular
 *        fractions
 * ```
 *
 * So five of the six rows are one string and only the dual stands apart, which
 * is the shape every feminine unit noun takes in this repo's Arabic
 * vocabularies. Both cells that differ from the singular — عقدتان and عقد — are
 * listed as aliases, because neither is reachable from عقدة by any rule in
 * `@smartput/core/locale/ar`'s analyzer chain: the dual replaces a letter rather
 * than appending to it, and the plural re-arranges the stem.
 *
 * `other` is where every fraction lands and where a count-free conversion target
 * lands (ruling R5), and in Arabic it is a **singular** — "1.5 عقدة", the
 * opposite of French. The Latin aliases are reused through `aliasesFor` rather
 * than retyped, so "3 mps" keeps working in an Arabic engine and the micro path
 * (`parseSpeed`) cannot drift from it.
 *
 * **Right-to-left changes nothing here.** A JavaScript string is in logical
 * order, so "2 عقدتان" holds the number first exactly as "2 knots" does, and the
 * Unicode Bidirectional Algorithm is what puts it on the right at display time.
 * That is true of "100 كم/س" as well: the slash sits between كم and س in memory
 * whichever way the line is drawn.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "م/ث" },
    kph: { aliases: alias("kph"), symbol: "كم/س" },
    // ميل is Arabic for the mile and there is no shorter written form of it, so
    // the numerator of this symbol is a whole word where the two above are
    // letters. Russian's "миль/ч" has the same asymmetry for the same reason.
    mph: { aliases: alias("mph"), symbol: "ميل/س" },
    knot: {
      aliases: [...alias("knot"), "عقدة", "عقدتان", "عقد", "عقدات"],
      symbol: "عقدة",
      forms: {
        zero: "عقدة",
        one: "عقدة",
        two: "عقدتان",
        few: "عقد",
        many: "عقدة",
        other: "عقدة",
      },
    },
  },
});
