import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * U+093C DEVANAGARI SIGN NUKTA, as an escape rather than a literal.
 *
 * हफ़्ता is written with फ़, and फ़ has two encodings: the precomposed U+095E and
 * the sequence फ + nukta. U+095E is a Unicode *composition exclusion*, so NFKC
 * decomposes it — and `normalize()` NFKC-folds every input before a word reaches
 * the alias index. A table written with the precomposed character therefore
 * tests green against direct calls on this object and is unreachable through the
 * engine, which is the worst shape a bug can take. Spelling the mark out is what
 * makes the decomposed form the one that ships, and it survives a careless
 * retype: a literal nukta renders *underneath* the letter before it and is one
 * smudge away from vanishing silently.
 *
 * `@smartput/core/locale/hi` writes ज़ and ड़ the same way in हज़ार and जोड़, for
 * the same reason, and asserts NFKC-stability over its own tables. `hi.test.ts`
 * here asserts it over this one.
 */
const NUKTA = "\u093C";

/** The stem of हफ़्ता, which is the one word in this file that inflects twice over. */
const HAFT = `हफ${NUKTA}्त`;

/**
 * The same stem with no nukta at all, which is a different matter from the one
 * above and needs its own constant rather than a `replace`.
 *
 * NFKC settles how a nukta is *encoded*; nothing ever supplies one that was not
 * typed. हफ्ता is what a keyboard without a nukta key produces and it is at
 * least as common in running text as the correct spelling, so all three of its
 * inflected forms are read. Listing them is not redundant with the fuzzy
 * matcher: "एक हफ्ता" does resolve today, but only because a missing nukta is
 * one edit away from `HAFT` and the typo path picked it up — a penalised
 * reading that competes with every other unit one edit from the same string.
 * The rule this file states for its own output runs the same way on the way in:
 * a spelling this common should be read at full weight, not guessed at. Every
 * other Hindi vocabulary in the repo declares its nukta-less twin for exactly
 * this reason (फ़ीसदी/फीसदी, एकड़/एकड, गज़/गज, फ़ारेनहाइट/फारेनहाइट).
 */
const HAFT_PLAIN = "हफ्त";

/**
 * Hindi words for the duration units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind — that is what lets this file be imported without linking
 * the ratio table), `aliases` derived from `units.ts` rather than retyped, and
 * an explicit `symbol` on every unit (ruling R8).
 *
 * **This is the package where Hindi's two `forms` rows stop being one word**,
 * and it is worth saying why the others are. `hindi.selectForm` returns CLDR's
 * `"one" | "other"` and nothing else, and across `mass`, `datasize`, `energy`
 * and `power` both rows hold the same string: a Hindi measure noun stays in the
 * direct singular after a numeral ("पाँच किलोग्राम", never "पाँच किलोग्रामें"),
 * because the numeral carries the count and the noun does not repeat it.
 *
 * घंटा is the exception, and it is a genuine one rather than a stylistic
 * preference. Hindi's plural marking is not a suffix; it is a substitution of
 * the final vowel, and it applies to **ā-final masculine** nouns only. घंटा is
 * one, so its direct plural is घंटे, and "दो घंटे" is what every speaker says —
 * "दो घंटा" is wrong in a way "पाँच किलोग्राम" is not. The other five units here
 * are consonant-final masculines (मिलीसेकंड, सेकंड, मिनट, दिन, सप्ताह) whose
 * direct plural is spelled exactly like the singular, so their two rows agree
 * for the ordinary reason.
 *
 * ```
 * one    0, 0.5, 1        घंटा     ā-final masculine, direct singular
 * other  1.5, 2, 5, …     घंटे     the same noun with its final vowel replaced
 * ```
 *
 * **The boundary is not English's.** Hindi's `one` is CLDR's `i = 0 or n = 1`,
 * so 0, 0.5 and 1 all take `one` — "आधा घंटा", "0 घंटा" — while 1.5 and 2 take
 * `other`. English puts 0 in `other`. On every other kind in this phase that
 * difference is invisible because the two rows agree; here it is the difference
 * between printing घंटा and घंटे, so `hi.test.ts` pins each count that moves it.
 *
 * **The oblique plural is read and never written.** "पाँच घंटों में" is what a
 * plural noun becomes in front of a postposition, and the postposition is
 * exactly where `hindi.keywords.in` (में/को/से) puts it. `hindi`'s analyzer chain
 * strips ों at `weight: -2`, but that strip lands on घंट — a stem, not a lemma —
 * so घंटों is listed explicitly here rather than left to the fallback. The rule
 * running the other way is firmer: every string this file *prints* is also a
 * string it reads, at full weight, because a word the printer emits must never
 * come back through the penalised path.
 *
 * **Symbols are the spelled singulars, and Hindi's own abbreviations are the
 * reason.** Hindi abbreviates these six — घं., मि., से., दि., मि.से. — and every
 * one of them is written with full stops. A full stop is not a letter, so `lex`
 * ends the word token at the first dot and no alias could ever claim the rest;
 * this is the same wall `@smartput/mass/locale/hi` hits with कि.ग्रा., and there
 * the dotless remnant (किग्रा) was itself in wide use and could ship as the
 * symbol. Here the remnants are worse than unavailable, they are actively
 * wrong: मि is the head of both मिनट and मिलीसेकंड, and से — the natural clipping
 * of सेकंड — is one of `hindi`'s three `in` keywords, so listing it would make
 * "5 से" a conversion with a missing target rather than five seconds. R8 wants
 * an explicit symbol, not an invented one, so all six take the spelled
 * nominative singular. It costs little: every unit here has `forms`, and a form
 * outranks a symbol in the renderer's label precedence, so these are what
 * `Printer`'s `symbols: true` mode emits rather than what `formatValue` does.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "2 h" keeps working in a Hindi engine and the micro path (`parseDuration`)
 * cannot drift from it. That also carries `"m"` for minutes, whose ambiguity
 * with `length`'s metre is the solver's to rank and not this file's to remove.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "duration",
  units: {
    // सेकंड, सेकण्ड and सेकेंड are one word with three current spellings: the
    // anusvara (ं) and the conjunct ण् are two ways of writing the same nasal,
    // and the े is the vowel a phonetic keyboard reaches for. Nothing folds them
    // — they differ inside the word, not at its ending — so each is listed and
    // one is printed. The same three-way choice recurs on मिलीसेकंड below.
    ms: {
      aliases: [...alias("ms"), "मिलीसेकंड", "मिलिसेकंड", "मिलीसेकण्ड"],
      symbol: "मिलीसेकंड",
      forms: { one: "मिलीसेकंड", other: "मिलीसेकंड" },
    },
    s: {
      // से is deliberately absent, and it is the one omission in this file that
      // would break the engine rather than merely narrow it: `hindi` claims से
      // as an `in` keyword ("किलोग्राम से ग्राम"), `buildKeywords` folds it
      // before the alias index is consulted, and a unit that claimed it too
      // would turn every conversion written with से into a stray quantity.
      aliases: [...alias("s"), "सेकंड", "सेकण्ड", "सेकेंड"],
      symbol: "सेकंड",
      forms: { one: "सेकंड", other: "सेकंड" },
    },
    min: {
      aliases: [...alias("min"), "मिनट", "मिनिट"],
      symbol: "मिनट",
      forms: { one: "मिनट", other: "मिनट" },
    },
    // The one unit in the phase whose two rows are two words. घंटा is ā-final
    // masculine, so the direct plural replaces the vowel: घंटा → घंटे. घण्टा and
    // घण्टे are the conjunct spelling of the same pair, common in print and
    // unreachable from the anusvara spelling by any rule, so both cells are
    // listed twice over. घंटों is the oblique plural a postposition governs,
    // listed rather than left to the ों strip, which would only reach the stem
    // घंट.
    h: {
      aliases: [...alias("h"), "घंटा", "घंटे", "घंटों", "घण्टा", "घण्टे"],
      symbol: "घंटा",
      forms: { one: "घंटा", other: "घंटे" },
    },
    // दिन is consonant-final masculine: the direct plural is spelled exactly like
    // the singular, so "दो दिन" and "एक दिन" carry the same noun. Only the
    // oblique plural marks anything, and it is दिनों — which the ों strip does
    // reach (the stem it leaves *is* दिन), listed anyway so the exact alias wins
    // over a penalised reading.
    d: {
      aliases: [...alias("d"), "दिन", "दिनों"],
      symbol: "दिन",
      forms: { one: "दिन", other: "दिन" },
    },
    // सप्ताह is the formal word and हफ़्ता the everyday one, and they are not two
    // spellings of one noun: सप्ताह is a consonant-final Sanskrit borrowing that
    // does not mark its plural, while हफ़्ता is an ā-final Perso-Arabic borrowing
    // that does (हफ़्ते), exactly like घंटा above. Both paradigms are read; the
    // invariant one is printed, because a written Hindi duration is a सप्ताह and
    // choosing the register-marked word for output would be this file editorial-
    // ising. See `NUKTA` above for why the फ़ is spelled out, and `HAFT_PLAIN`
    // for why all three forms are listed a second time without it.
    wk: {
      aliases: [
        ...alias("wk"),
        "सप्ताह",
        "सप्ताहों",
        `${HAFT}ा`,
        `${HAFT}े`,
        `${HAFT}ों`,
        `${HAFT_PLAIN}ा`,
        `${HAFT_PLAIN}े`,
        `${HAFT_PLAIN}ों`,
      ],
      symbol: "सप्ताह",
      forms: { one: "सप्ताह", other: "सप्ताह" },
    },
  },
});
