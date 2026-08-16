import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * U+093C DEVANAGARI SIGN NUKTA, as an escape rather than a literal.
 *
 * हर्ट्ज़ ends in ज़, and ज़ has two encodings: the precomposed U+095B and the
 * sequence ज + nukta. U+095B is a Unicode *composition exclusion*, so NFKC
 * decomposes it — and `normalize()` NFKC-folds every input before a word reaches
 * the alias index. A table written with the precomposed character therefore
 * tests green against direct calls on this object and is unreachable through the
 * engine, which is the worst shape a bug can take. Spelling the mark out is what
 * makes the decomposed form the one that ships, and it survives a careless
 * retype: a literal nukta renders *underneath* the letter before it and is one
 * smudge away from vanishing silently — and if it vanished here, the printed
 * symbol would quietly become the nukta-less variant that is listed as an alias
 * beside it, so every equality in this file would still hold.
 *
 * `@smartput/core/locale/hi` writes ज़ and ड़ the same way in हज़ार and जोड़, for
 * the same reason, and asserts NFKC-stability over its own tables. `hi.test.ts`
 * here asserts it over this one.
 */
const NUKTA = "\u093C";

/** हर्ट्ज़, the hertz, with its nukta spelled out. */
const HERTZ = `हर्ट्ज${NUKTA}`;

/**
 * Hindi words for the tempo units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s: the same `kind` id string (never an import of the
 * kind — that is what lets this file be imported without linking the ratio table
 * or the reciprocal bridge to `duration`), `aliases` derived from `units.ts`
 * rather than retyped, and an explicit `symbol` on both units (ruling R8). Two
 * units, and they take opposite decisions about `forms` for the same reason
 * English's do: one of them has a single-token name and the other does not.
 *
 * **`bpm` carries no `forms`.** Hindi says "बीट प्रति मिनट" — three words, and
 * `parse/lex.ts` ends a word token at the space — and abbreviates it "बीट/मिनट",
 * where "/" is always division. Neither can ever be one token, which is the
 * ruling `en.ts` records for "beats per minute" and `speed`'s mps and kph record
 * for theirs.
 *
 * What ships instead is बीपीएम: the Latin initialism transliterated letter by
 * letter into Devanagari, which is what a Hindi music or fitness article prints
 * ("गाने का टेम्पो 120 बीपीएम है"). It is one run of letters with no operator
 * character and no space in it, so it lexes as a single unit word and re-reads as
 * the unit that printed it. That matters more here than anywhere else in this
 * phase, because `tempo` has no escape hatch: `energy` survives a compound
 * symbol by making the arithmetic true ("किलोवाट·घंटा" computes as power ×
 * duration) and `speed` by the same trick with a slash, but tempo's canonical
 * *is* beats per minute — there is no "beat" kind for बीट to be a quantity of,
 * and `index.ts` declares only the two reciprocal `in` bridges and no `/` at all.
 * So a slash in the symbol would have nothing to compute and the printed tempo
 * would throw on its own output. `uk.ts` reasons its way to "бпм" through exactly
 * this argument; Hindi's transliteration is the same answer.
 *
 * बीट is listed beside it as a second way in, the numerator of the abbreviation
 * standing for the whole of it, by the same elision that lets English "bpm" be
 * typed for a tempo. Only बीपीएम also comes back out. ताल — the Hindi word for a
 * rhythmic cycle in Indian classical music — is deliberately absent: it names a
 * whole metrical structure rather than a count per minute, and one surface should
 * not mean both.
 *
 * **`hz` declares both keys, and both hold हर्ट्ज़.** `hindi.selectForm` returns
 * CLDR's `"one" | "other"` and nothing else, and a Hindi measure noun stays in
 * the direct singular after a numeral — "पाँच हर्ट्ज़", never "पाँच हर्ट्ज़ें" —
 * so the two rows agree for the same reason every consonant-final borrowing in
 * this phase agrees. English arrives at one word for both rows by a different
 * route (hertz is its own plural in English), and Arabic declines it outright;
 * this is the third answer, and it is the language's own.
 *
 * The boundary between those rows is not English's — Hindi's `one` is CLDR's
 * `i = 0 or n = 1`, so 0, 0.5 and 1 all take `one` where English puts 0 in
 * `other` — which is invisible while the two rows agree, and pinned in
 * `hi.test.ts` anyway.
 *
 * `hindi.renderQuantity` sets a Devanagari symbol off from the number with a
 * space and leaves a Latin one tight, so a Hindi tempo prints "120 बीपीएम" where
 * English prints the tight "120bpm".
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "120 bpm" keeps working in a Hindi engine and the micro path (`parseTempo`)
 * cannot drift from it.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "बीपीएम", "बीट"],
      symbol: "बीपीएम",
    },
    // हर्ट्ज without the nukta is the spelling a keyboard without a nukta key
    // produces, and it is common enough in print that leaving it out would make
    // the unit unreadable for half its writers. It is read and never printed;
    // see `NUKTA` above for why the printed one is spelled with an escape.
    hz: {
      aliases: [...alias("hz"), HERTZ, "हर्ट्ज"],
      symbol: HERTZ,
      forms: { one: HERTZ, other: HERTZ },
    },
  },
});
