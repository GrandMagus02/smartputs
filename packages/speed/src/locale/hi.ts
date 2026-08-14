import { aliasesFor, defineVocabulary } from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Hindi words for the speed units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind — that is what lets this file be imported without linking
 * the ratio table or the `length ÷ duration` bridge), `aliases` derived from
 * `units.ts` rather than retyped, and an explicit `symbol` on every unit (ruling
 * R8). What differs is which units get `forms` at all, and here that is exactly
 * one of the four.
 *
 * **Three of the four are compounds and carry no `forms`.** Hindi writes a speed
 * as "किलोमीटर प्रति घंटा" — three words, and `parse/lex.ts` ends a word token at
 * the space — or as "किमी/घंटा", where "/" is always division. Either way there
 * is no single Hindi token meaning "kilometres per hour", so a `forms` table for
 * one would be two rows of prose no input could reach. That is the ruling
 * `en.ts` records for "metres per second" and every translation beside it
 * restates.
 *
 * Absent forms keep the renderer on the symbol, and the symbols are the written
 * Hindi ones with their slash intact: मी/सेकंड, किमी/घंटा, मील/घंटा — what a
 * Hindi road sign and a Hindi news report print. The slash is not a defect being
 * tolerated. `lex` reads "/" as division, so "100 किमी/घंटा" reaches the resolver
 * as किमी ÷ घंटा and this kind's own `length ÷ duration` bridge turns a length
 * over a time into a speed, the route English's "m/s" has always taken. It needs
 * `@smartput/length`'s Hindi vocabulary installed beside `@smartput/duration`'s,
 * which is why the round trip is asserted in `@smartput/kinds`' own `hi` test —
 * where both are installed — rather than here, where an engine of one kind
 * cannot resolve either half of the compound.
 *
 * **Each half of a compound symbol is the component unit's own symbol**, and
 * that is a rule rather than a coincidence: length's किमी over duration's घंटा,
 * length's मील over the same घंटा, length's मी over duration's सेकंड. It is what
 * makes the slash compute, because a half that is not an alias its own kind
 * indexes is a half the bridge cannot reach. `mps` is where that mattered — see
 * its note below, and the keyword it collided with.
 *
 * **The head nouns are deliberately not aliases.** The alias index is one flat
 * map with no kind in the key, so claiming किलोमीटर for `kph` here would give
 * "5 किलोमीटर" a second reading in any engine where `@smartput/length` is also
 * installed — a length and a speed, told apart by nothing. The bridge above is
 * what Hindi gets instead, and it needs no alias of this kind's at all. A symbol
 * may name them, because a symbol is printed and never indexed.
 *
 * **`knot` is the exception, and its Hindi word is a borrowing rather than a
 * translation.** नॉट is the nautical knot as Hindi maritime and news writing
 * spells it. गाँठ — the ordinary Hindi word for a knot tied in a rope — is
 * deliberately absent: it is the literal translation and it is not the unit, and
 * a surface that means a piece of string in every other sentence should not mean
 * a speed in this one. नॉट is one token, it is already an alias, and it takes the
 * two identical rows every consonant-final borrowing in this phase takes: a Hindi
 * measure noun stays in the direct singular after a numeral, so "पाँच नॉट" and
 * never "पाँच नॉटें".
 *
 * The boundary between those rows is not English's — Hindi's `one` is CLDR's
 * `i = 0 or n = 1`, so 0, 0.5 and 1 all take `one` where English puts 0 in
 * `other` — which is invisible while the two rows agree, and pinned in
 * `hi.test.ts` anyway.
 *
 * `hindi.renderQuantity` sets a Devanagari symbol off from the number with a
 * space and leaves a Latin one tight, so a Hindi speed prints "100 किमी/घंटा"
 * where English prints the tight "100kph".
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "3 mps" keeps working in a Hindi engine and the micro path (`parseSpeed`)
 * cannot drift from it.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "speed",
  units: {
    // **The denominator is सेकंड and not से, and the reason is this language's
    // own keyword table.** मी/से is how a Hindi physics text abbreviates the
    // metre per second, and it is the one spelling this engine can never read:
    // से is one of `hindi`'s three `in` keywords, and a keyword is claimed by
    // `lex` at the token level. Splitting at the slash does not protect it — it
    // is what exposes it. "5 मी/से" reaches the parser as number, word(मी),
    // op(/), **keyword(in)**, and the parse fails with `Cannot parse "5 मी/से"
    // as a quantity`. Every Hindi speed printed in mps was unreadable, including
    // the engine's own output, because mps is this kind's canonical unit and so
    // the string every unconverted speed comes back as.
    //
    // सेकंड is what `@smartput/duration/locale/hi` declares as the second's own
    // symbol, for a reason of its own: Hindi has no abbreviation of the second
    // that survives being written down, so that vocabulary spells all six of its
    // units out. Composing this symbol out of the component units' symbols —
    // length's मी over duration's सेकंड — is the rule the other two rows below
    // already follow (किमी/घंटा is length's किमी over duration's घंटा, मील/घंटा
    // is length's मील over the same), and it is what makes the slash compute:
    // both halves are aliases their own kinds index, so "5 मी/सेकंड" reaches the
    // `length ÷ duration` bridge and comes back a speed. मी/से followed no rule
    // and reached nothing.
    mps: { aliases: alias("mps"), symbol: "मी/सेकंड" },
    kph: { aliases: alias("kph"), symbol: "किमी/घंटा" },
    // मील is a whole word where किमी and मी are abbreviations, because Hindi has
    // no shorter written form of the mile. Ukrainian's "миль/год" has the same
    // asymmetry for the same reason.
    mph: { aliases: alias("mph"), symbol: "मील/घंटा" },
    knot: {
      aliases: [...alias("knot"), "नॉट"],
      symbol: "नॉट",
      forms: { one: "नॉट", other: "नॉट" },
    },
  },
});
