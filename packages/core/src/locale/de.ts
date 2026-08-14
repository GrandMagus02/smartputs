import type { Language } from "../types";
import { germanNumerals, germanSpeller } from "./de-cardinals";
import { defineLanguage } from "./define";
import { compoundSplitter, identity, suffixStripper } from "./helpers";
import { defaultRenderQuantity } from "./render";

/**
 * The nouns a German measurement compound may end in.
 *
 * **This is morphology, not vocabulary, and the distinction is the reason it is
 * allowed to live in a `Language` at all.** A `Vocabulary` maps a word to a
 * unit id inside a kind, with a symbol and a `forms` table; this is a flat list
 * of strings with no unit, no kind and no meaning attached. It says only *where
 * a German compound may be cut* — a Germanic compound is right-headed, so its
 * last element says what the word is a kind of — and every question about what
 * the resulting string denotes is answered by the alias index, which is built
 * from vocabularies this file has never seen. Drop `@smartput/mass/locale/de`
 * from an engine and `gramm` below still splits and simply resolves to nothing.
 *
 * The alternative was to derive the list from the installed vocabularies at
 * compose time. It was rejected because `Language.analyze` is built once, before
 * `composeLocale` runs and without any argument that could carry a registry —
 * and because the heads German actually compounds on are a *smaller* set than
 * the aliases (nobody writes `Quadratkg`), so deriving it would hand the
 * splitter hundreds of two-letter symbols to cut on.
 *
 * **Inflected heads are listed separately** because the analyzer chain does not
 * iterate: `createAnalyzerChain` runs every analyzer over the same original
 * surface and pools the results, so the `-n` that `suffixStripper` would take
 * off `Quadratmetern` never reaches the splitter. `metern` is therefore a head
 * in its own right, as is every other dative plural a printed German unit word
 * can take.
 *
 * **Three heads deliberately left out**, each because the cost is a real German
 * word rather than a hypothetical one:
 *
 * - `bar`, the pressure unit. `-bar` is German's productive adjective suffix —
 *   *sichtbar*, *brauchbar*, *wunderbar*, *essbar* — so listing it turns a
 *   large open class of ordinary adjectives into pressures.
 * - `tag`. All seven weekday names end in it (*Montag*, *Dienstag*, …), and a
 *   head list containing `tag` reads every one of them as a count of days.
 * - `grad`. German writes the temperature unit as a free noun ("Grad Celsius")
 *   and compounds on it only in rarities, so it would buy almost nothing — and
 *   it would cost *Belgrad*, *Leningrad* and every other `-grad` place name.
 *
 * `gramm` is kept despite the same hazard (*Programm*, *Diagramm*, *Telegramm*
 * all end in it) because there is no alternative: German never writes "Kilo
 * Gramm" apart, so without this head every mass compound in the language is
 * unreadable. The cost is bounded — a split is only ever consulted for a token
 * standing where a unit goes, and it is offered at `compoundSplitter`'s penalty
 * so any exact alias outranks it.
 */
const COMPOUND_HEADS = [
  // Length. `meile` carries its plural because it is one of the few German
  // unit nouns whose plural is actually marked (Meile/Meilen).
  "meter",
  "metern",
  "meile",
  "meilen",
  // Volume and mass. `gramm` and `liter` are invariant in the plural, so only
  // the dative plural `-n` of `liter` is a second form.
  "liter",
  "litern",
  "gramm",
  "tonne",
  "tonnen",
  // Time. Every one of these is a weak feminine whose plural and dative plural
  // are both `-n`, except `monat`/`jahr`, which are masculine and neuter.
  "sekunde",
  "sekunden",
  "minute",
  "minuten",
  "stunde",
  "stunden",
  "woche",
  "wochen",
  "monat",
  "monate",
  "monaten",
  "jahr",
  "jahre",
  "jahren",
  // Data. Loanwords, so they take the English `-s` plural rather than a German
  // one — which is exactly why they are listed and not left to `suffixStripper`.
  "byte",
  "bytes",
  "bit",
  "bits",
  // Electrical, energy and frequency. All invariant in the plural after a
  // number ("zwei Watt", never "zwei Watts"), which is why each is a single
  // entry.
  "watt",
  "volt",
  "ampere",
  "joule",
  "hertz",
  "newton",
  "pascal",
  "kalorie",
  "kalorien",
];

const plural = new Intl.PluralRules("de");

/**
 * German nouns ending in `-e` that are nevertheless **not** feminine, matched by
 * their own tail so one entry covers a whole prefix family.
 *
 * Gender is otherwise recoverable from the noun's ending, which is what makes
 * `isFeminine` below a morphological rule rather than a per-unit table: a German
 * noun in `-e` is feminine (Meile, Tonne, Unze, Gallone, Stunde, Minute,
 * Sekunde, Woche, Kalorie, Wattstunde, Pferdestärke — every one of the unit
 * nouns this repo prints), and so is every noun in `-ung` (Umdrehung) without
 * exception, that suffix being one of the handful German inflects with rather
 * than borrows.
 *
 * The exceptions are all of one class, which is why naming them is a statement
 * about the language and not a list of units: a loanword in `-e` keeps the
 * neuter — *das Byte*, *das Joule*, *das Acre*, and outside this repo *das
 * Interview*, *das Image*, *das Ampere*. That last one is the warning label: the
 * day a kind declares the ampere, `-ampere` belongs on this list, and nothing
 * else would catch it.
 *
 * `MASCULINE_IN_A` has no German counterpart and there is deliberately no `-a`
 * rule at all. German `-a` nouns split with no morphological signal — *die
 * Hrywnja* is feminine, *das Pica* is neuter — so the tail says nothing, and
 * `@smartput/rate/locale/de` accordingly still spells "ein Hrywnja" where German
 * wants "eine". That is a named under-application rather than a wrong guess: it
 * reaches one opt-in currency, where a bad `-a` rule would reach a printed unit.
 */
const NEUTER_IN_E = ["joule", "byte", "acre"];

/**
 * Does this printed noun take `eine` rather than `ein`?
 *
 * Case-folded because the noun arrives capitalised — every German noun does —
 * and the endings are lowercase generalisations about the language.
 *
 * Sound for a **singular** noun and only for one, which is why `agree` below
 * fires on nothing but the bare `ein`: `Tage` and `Grade` are masculine plurals
 * that end in `-e`, and no ending distinguishes them from `Meile`.
 */
const isFeminine = (noun: string): boolean => {
  const word = noun.toLocaleLowerCase("de");
  if (word.endsWith("ung")) return true;
  if (!word.endsWith("e")) return false;
  return !NEUTER_IN_E.some((tail) => word.endsWith(tail));
};

/**
 * Make a spelled numeral agree with the noun it is about to stand in front of.
 *
 * German inflects exactly one numeral for gender and it is the word for 1:
 * *ein Meter* and *ein Kilogramm* against *eine Meile*, *eine Stunde*, *eine
 * Kilowattstunde*. `zwei` and everything above it are invariable, which makes
 * this a far narrower rewrite than the Spanish one next door — there is no
 * hundreds series to feminise and no `mil`/`millón` distinction to reason about.
 *
 * **The whole spelled number must be the bare word `ein`**, and that exact
 * equality is the guard rather than a suffix test. Two different things would
 * break without it.
 *
 * German writes every numeral below a million as a single token, and the `ein`
 * *inside* one of those never agrees: 21 is `einundzwanzig` before a feminine
 * noun exactly as before a masculine one, and so are `einhundert` and
 * `eintausend`. So a prefix test would produce `eineundzwanzig`, which is not a
 * German word.
 *
 * A *suffix* test — rewrite a last word ending in `ein`, catching
 * `einhundertein` and `eintausendein` too — was written first and is wrong for
 * a subtler reason: those counts are CLDR `other`, so the noun beside them is
 * the **plural**, and `isFeminine` reads a plural's ending as if it were a
 * singular's. `Tage` and `Grade` are masculine plurals that end in `-e`, so
 * "101 Tage" came out "einhunderteine Tage". The ending rule is sound for a
 * singular noun and only for one, and the bare `ein` is the only spelling that
 * guarantees a singular: `germanSpeller` writes it for the value 1 and for
 * nothing else, and 1 is the only count `selectForm` answers `one` for.
 *
 * What that gives up, named rather than hidden: a count of 101 or 1001 in front
 * of a feminine unit stays "einhundertein Meilen" where careful German would
 * write "einhundertundeine Meile" — singular noun and all. That construction
 * needs the *noun* to go singular too, which is CLDR's call and not this
 * function's: `Intl.PluralRules("de").select(101)` is `other`, so the vocabulary
 * has already been asked for a plural by the time the number is rendered.
 * Correcting the numeral alone would produce a feminine numeral agreeing with a
 * plural noun, which is further from German than leaving both alone.
 *
 * A no-op on every ordinary path. A digit string is never the word `ein`, so
 * "1 Meile" and "1,5 Meilen" are untouched byte for byte, and only `Printer`'s
 * `spelled` mode can reach the rewrite at all.
 *
 * The rewritten word reads back: `de-cardinals.ts` declares `eine` in
 * `standalone`, so `readUnder100` resolves it to 1. A printer that emits a word
 * its own parser refuses is the defect four Ukrainian vocabularies shipped with
 * the suite green.
 */
const agree = (spelled: string, noun: string): string =>
  spelled === "ein" && isFeminine(noun) ? "eine" : spelled;

/**
 * The German language: how German is read and written, with no word for any
 * unit in it.
 *
 * German is the third language this engine learned, and it was written as a
 * proof before it was written as a product: `third-language.test.ts` built
 * exactly this language inside a test file to find out which of the finished
 * seams generalise past English and Ukrainian. This ships what that file
 * proved, plus the two things it explicitly declined to build (see `numerals`
 * and `spell` below).
 *
 * Three ways German stresses the model that neither built-in does:
 *
 * **Compounding.** `Zentimeter`, `Quadratmeter` and `Bandmeter` are single
 * tokens the lexer cannot cut and no vocabulary can enumerate — there is no
 * closed set of them. English writes "square metre" as two words and Ukrainian
 * inflects rather than compounds, so `compoundSplitter` exists for this
 * language and is not optional in it.
 *
 * **Capitals.** Every German noun is capitalised, so every unit word arrives
 * with a capital in ordinary prose and without one in a search box. Analyzers
 * are handed the surface exactly as typed — `parse/candidates.ts` folds the
 * *form* on the way out, not the surface on the way in — so both spellings have
 * to reach the same reading, and this is the first shipped language where that
 * path is load-bearing.
 *
 * **A `forms` table on two axes with a different shape from Ukrainian's.**
 * German's noun plural is frequently *identical* to its singular
 * (Meter/Meter, Kilometer/Kilometer) while its dative plural is not (Metern) —
 * the mirror image of English, where number is always marked and case never is.
 * So the number axis is often inert and the case axis is not, which is the
 * arrangement that catches a printer quietly ignoring one of the two.
 */
export const german: Language = defineLanguage({
  id: "de",
  /**
   * Read from CLDR rather than transcribed, the same as `en` and `uk`. This
   * runtime's `Intl.NumberFormat("de")` groups with "." and marks the decimal
   * with "," — the exact inverse of English — and `de.test.ts` pins both. Note
   * what that inverse costs and why it is still right: under this language
   * "1.500" is fifteen hundred and "1,5" is three halves, so a German reader
   * who types an English number gets a German answer. A language that
   * transcribed its own separators could not disagree with the platform, and
   * disagreeing with the platform is the whole failure mode being avoided.
   */
  numberFormat: "intl",
  analyze: [
    // Required, not decorative. `createResolver` looks a surface up only
    // through the forms some analyzer produced — there is no unconditional
    // lookup of the raw word — so a German chain without `identity()` cannot
    // reach its own aliases, and `Zentimeter` silently reads as the splitter's
    // `meter`. `third-language.test.ts` measures that exact failure.
    identity(),
    compoundSplitter({ vocabulary: COMPOUND_HEADS, minPart: 3 }),
    // The endings a German unit noun actually takes, and nothing else. A
    // fallback for the forms a `Vocabulary` did not think to list, never a
    // substitute for listing them:
    //
    //   en  plural of the weak feminines   Wochen  -> Woche, Tonnen -> Tonne
    //   e   plural of the strong masculines Grade  -> Grad,  Tage   -> Tag
    //   n   dative plural, the German case  Metern -> Meter
    //       no other language here marks, and the plural of every noun
    //       already ending in -e
    //   s   genitive singular and the loan plural  Bytes -> Byte
    //
    // `-er` and `-es` are left out: no unit noun in the language forms its
    // plural in `-er` (that class is *Kind/Kinder*, *Bild/Bilder*), so the rule
    // would only ever shorten a word that was already right — `Kilometer` to
    // `Kilomet` — and buy nothing back.
    //
    // `minStem: 3` keeps it away from the two-letter symbols German units are
    // written with (kg, cm, km, ml), and `weight: -2` is the penalty `en` and
    // `uk` both use, so an exact alias always outranks a stripped one.
    suffixStripper({ suffixes: ["en", "e", "n", "s"], minStem: 3, weight: -2 }),
  ],
  /**
   * German's own, rather than the shared `cardinalNumerals`. German writes
   * every numeral below a million as a single token — `einundzwanzig`,
   * `dreihundertfünfundvierzigtausendsechs` — and the shared helper models a
   * numeral as a run of words, so it reads `["einundzwanzig"]` as null and
   * `["ein", "und", "zwanzig"]` as 1. `third-language.test.ts` pins both of
   * those as findings and concludes that a German language ships its own; see
   * `de-cardinals.ts`, which is that, over one table read in both directions.
   *
   * `spell` writes the masculine `ein` for 1 and cannot do otherwise — a
   * `NumeralSpeller` is handed the magnitude and nothing else, and German's word
   * for 1 agrees in gender with the noun it counts. `renderQuantity` below is
   * where that is put right, because it is the one call that sees the number and
   * the noun together; see `agree`.
   */
  numerals: germanNumerals(),
  spell: germanSpeller(),
  keywords: {
    // "in" is English's "in", the same surface under the same `Keyword`, so
    // `buildKeywords` folds the two into one entry rather than refusing them.
    // "nach" and "zu" are the directional prepositions a conversion is spoken
    // with: "1 km in Meter", "1 km nach Meter", "1 kg zu Gramm".
    in: ["in", "nach", "zu"],
    of: ["von"],
    // No word claimed for `off`, and that is a decision rather than an
    // omission. German states a discount as a noun plus a preposition — "20 %
    // Rabatt auf 50" — and `off` is a single-token keyword with no way to
    // express the "auf". Claiming "rabatt" alone would make "20 % Rabatt 50"
    // the one spelling that works, which is a phrase no German writes; the
    // arithmetic itself stays reachable through `-` and `%`.
    plus: ["plus"],
    minus: ["minus"],
    // "mal" is the multiplication word in every German classroom: "drei mal
    // vier". It needs no particle after it, so it is a bare `times`.
    times: ["mal"],
    // "geteilt durch" is one operator, split the way English's "divided by" is:
    // the verb is `over` and the preposition following it is `by`, which
    // `foldWordOps` swallows into the same token.
    //
    // The cost, stated rather than hidden: a bare "10 durch 2" does not parse,
    // because "durch" is a `by` and a stray `by` fails at the parser. The
    // alternative — claiming "durch" as `over` — was rejected because it makes
    // the *commoner*, fully spelled "geteilt durch" emit two division operators
    // in a row, which is a parse error on the phrase a German is likelier to
    // write out. Notice this is exactly English's arrangement and exactly
    // English's cost: "10 by 2" does not parse there either.
    over: ["geteilt", "dividiert"],
    by: ["durch"],
  },
  /**
   * Two axes: case × CLDR category. Case comes from the slot, because that is
   * what the conversion prepositions govern — "in Metern", "zu Gramm" — and
   * German's `in` takes the dative when it answers "wo", which is the reading a
   * conversion target has. The category comes from `Intl.PluralRules("de")`,
   * which declares exactly two: `one` and `other`.
   *
   * **The dative is a decision, and the accusative is the alternative it beat.**
   * German's `in` is a two-way preposition: it takes the dative for a state
   * ("eine Angabe in Metern", "die Tiefe in Zentimetern") and the accusative for
   * a movement, which is what the verb *umrechnen* selects — "1 km in Meter
   * umrechnen". Both readings of `X in Y` are real German and they differ in
   * exactly one letter, the plural `-n`. The dative wins because this engine
   * prints a *statement of a quantity* and not an instruction: the target names
   * the unit the answer is expressed in, which is the "wo" reading. Both keys of
   * the other reading are still read on the way in — every vocabulary lists the
   * bare nominative as an alias, so "1 km in Meter" parses and comes back "in
   * Metern". The two other conversion keywords settle it further: `zu` and
   * `nach` govern the dative unconditionally, so only `in` was ever in question.
   *
   * **The key set is therefore exactly four**: `nom-one`, `nom-other`,
   * `dat-one`, `dat-other`. That is the contract every German `Vocabulary` keys
   * its `forms` table off, and it is closed — no more and no fewer, which is
   * what `assertLocaleContract`'s fourth check asserts.
   *
   * Three of the four are frequently the same string, and that is the German
   * rule rather than a table stopping halfway: `Meter` is nominative singular,
   * nominative plural *and* dative singular, and only the dative plural
   * `Metern` differs. A vocabulary that writes the same word four times is
   * correct; one that writes it four times for `Meile`, whose plural *is*
   * marked (Meile/Meilen), is not.
   *
   * The engine never learns what `"dat"` means. It asks for a key and indexes
   * `forms` with it, which is the only reason a language may add an axis
   * without anything upstream of `forms` changing shape.
   */
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "dat" : "nom";
    // Ruling R5: a conversion target has no magnitude to agree with, and
    // `other` is the category CLDR requires every locale to define as its
    // generic one — so `dat-other` is where a bare target lands.
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
  /**
   * `defaultRenderQuantity` with two changes, one for each branch it has.
   *
   * **A symbol is set off from the number by a space** rather than tight against
   * it. That is DIN 1301-1 and the SI convention German typography actually
   * follows — "5 kg", never "5kg" — and it is the one place the default
   * template, written for English's tight `5kg`, says something wrong about this
   * language. `gap` still wins wherever the caller resolved a separator of its
   * own, so `Printer`'s `spacing` option reaches through here exactly as it does
   * through the default.
   *
   * **A spelled number agrees in gender with the noun it counts** — see `agree`
   * above. This is the only call at which the language sees the number and the
   * noun together, which is exactly why the correction belongs here:
   * `NumeralSpeller` is handed a magnitude and nothing else, and `selectForm` is
   * told the count and the slot, neither of which carries gender. Gender is a
   * property of the *noun*, so no axis on `forms` could express it either — it
   * would be a fifth key every German vocabulary had to fill with the same word.
   * `@smartput/core/locale/es` reaches the same seam by the same argument, from
   * a language whose agreement is broader and whose morphology is looser.
   *
   * Applied to `form` and not to `alias`, again as Spanish has it: a `form` is a
   * noun this language's own vocabulary wrote and whose ending therefore means
   * what `isFeminine` reads into it, while an `alias` is whatever spelling the
   * index happened to key on and may be a symbol or another language's word.
   */
  renderQuantity: (parts) => {
    if (
      parts.form === undefined &&
      parts.alias === undefined &&
      parts.symbol !== undefined
    ) {
      return `${parts.number}${parts.gap ?? " "}${parts.symbol}`;
    }
    if (parts.form === undefined) return defaultRenderQuantity(parts);
    return defaultRenderQuantity({ ...parts, number: agree(parts.number, parts.form) });
  },
});

export default german;
