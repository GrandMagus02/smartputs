import type { Language, QuantityParts } from "../types";
import { defineLanguage } from "./define";
import { CARDINALS, spellSpanish } from "./es-cardinals";
import { cardinalNumerals, identity, suffixStripper } from "./helpers";
import { defaultRenderQuantity } from "./render";

const plural = new Intl.PluralRules("es");

/**
 * The numerals that agree in gender with the noun they count, masculine key to
 * feminine value. Spanish inflects exactly these and no others: `uno` and every
 * compound ending in it, and the hundreds from 200 up. `mil` is invariable,
 * every unit word from `dos` to `cien` is invariable, and `millón`/`billón` are
 * masculine nouns in their own right rather than agreeing numerals — which is
 * what `SCALE_NOUNS` below is for.
 *
 * The keys are the apocopated forms, because those are the strings
 * `spellSpanish` actually emits at the position where agreement bites: it
 * writes `un`, never `uno`, immediately before the noun (see `APOCOPE` in
 * `es-cardinals.ts`). Every value is also a declared key of `CARDINALS.units`
 * or `CARDINALS.tens` — `una`, `veintiuna`, `doscientas` and the rest are all
 * listed there — so a feminised numeral reads back as the number it came from,
 * which is the same round-trip property the masculine spelling has.
 */
const FEMININE: Readonly<Record<string, string>> = {
  un: "una",
  veintiún: "veintiuna",
  doscientos: "doscientas",
  trescientos: "trescientas",
  cuatrocientos: "cuatrocientas",
  quinientos: "quinientas",
  seiscientos: "seiscientas",
  setecientos: "setecientas",
  ochocientos: "ochocientas",
  novecientos: "novecientas",
};

/**
 * The scale words that are *nouns*, and therefore agree with nothing further
 * to their right: in "doscientos millones de libras" the hundreds are
 * masculine because they count `millones`, not `libras`.
 *
 * `mil` is deliberately absent. It is a quantifier rather than a noun — it
 * takes no plural and no article — so agreement passes straight through it,
 * and "doscientas mil libras" is the feminine that "doscientos millones" is
 * not. That single difference is why agreement is applied to the tail after
 * the last scale noun rather than to the last word alone.
 */
const SCALE_NOUNS = new Set([
  "millón",
  "millon",
  "millones",
  "billón",
  "billon",
  "billones",
]);

/**
 * Spanish nouns ending in -a that are nevertheless masculine.
 *
 * Gender is otherwise recoverable from the noun's own ending, which is why
 * this is a morphological rule and not a per-unit table: a Spanish noun in -a
 * is feminine, and every one of the twenty-odd unit nouns the repo prints
 * obeys that (pulgada, milla, hora, tonelada, libra, pinta, hectárea,
 * caloría, vuelta, pica, grivna…), while every noun in -o, -e, -n, -l, -r
 * and -án is masculine.
 *
 * `día` is the exception the rule cannot reach. It is a Greek loan that kept
 * its masculine through Latin, and it is a real word of the language rather
 * than a fact about `@smartput/duration` — no ending distinguishes it from
 * `caloría`, which is feminine and scans identically. Listing it here is the
 * one place this file names a string that also happens to be a unit's word,
 * and the alternative was worse: an axis on `selectForm` that every other
 * translator would have to fill, to carry a fact only Spanish has.
 */
const MASCULINE_IN_A = new Set(["día", "días"]);

const isFeminine = (noun: string): boolean =>
  (noun.endsWith("a") || noun.endsWith("as")) && !MASCULINE_IN_A.has(noun);

/**
 * Rewrite a spelled numeral to agree with the noun it is about to stand in
 * front of.
 *
 * A no-op unless every condition holds at once: the number was spelled into
 * words (a digit string contains no key of `FEMININE`), the label is a noun
 * this language wrote rather than a symbol or a bare alias, and that noun is
 * feminine. So the ordinary path — "1 pulgada", "1,5 kg" — is untouched byte
 * for byte, and only `Printer`'s `spelled` mode can reach the rewrite.
 */
const agree = (spelled: string, noun: string): string => {
  if (!isFeminine(noun)) return spelled;
  const words = spelled.split(" ");
  // Everything up to and including the last scale noun counts *that* noun and
  // stays masculine; only what follows it counts the unit.
  let from = 0;
  for (const [index, word] of words.entries()) {
    if (SCALE_NOUNS.has(word)) from = index + 1;
  }
  let changed = false;
  for (let index = from; index < words.length; index++) {
    const feminine = FEMININE[words[index] as string];
    if (feminine === undefined) continue;
    words[index] = feminine;
    changed = true;
  }
  return changed ? words.join(" ") : spelled;
};

/**
 * `defaultRenderQuantity`, with the one thing Spanish assembles differently:
 * the number agrees with the noun.
 *
 * This is the seam that makes gender expressible without a `forms` axis for
 * it, and it is the right one precisely because gender is *not* a property of
 * the slot or the count — the two things `selectForm` is told. It is a
 * property of the noun, and this is the only call at which the language sees
 * the noun and the number together. `NumeralSpeller` cannot do it: it is
 * handed a magnitude and nothing else, which is why `spellSpanish` writes the
 * masculine and says so, and why the correction belongs here rather than
 * there.
 *
 * Everything else is delegated, `gap` included, so `Printer`'s `spacing`
 * option and `formatValue`'s tight symbols keep behaving exactly as they do
 * for every other language.
 *
 * **What this deliberately does not do is insert "de" after a scale noun**,
 * and it is the one place where correct Spanish loses to a rule this engine
 * holds above it. "un millón de metros" is what the language says — `millón`
 * is a noun and takes a complement, where `mil` is a quantifier and does not
 * ("un millón quinientas mil millas"). But "de" is this language's own
 * `keywords.of`, so the lexer reads that string as `1000000 of metros`, the
 * solver looks for a `of | number | length` signature, finds none, and the
 * spelled printer has emitted a string its own engine answers with
 * `DimensionMismatchError`. A printer that cannot read its own output is the
 * defect four Ukrainian vocabularies shipped with every test green
 * (`packages/kinds/src/ukrainian.test.ts` documents the sweep that caught it),
 * and `@smartput/temperature/locale/es` states the rule from the other side:
 * the spelled path only ever emits words the parser can read. So the numeral
 * and the noun are set in apposition — "un millón metros" — which is the same
 * shape every other magnitude takes here.
 *
 * `SCALE_NOUNS` is therefore read for agreement only, which is what it was
 * introduced for. Reaching the real construction needs an `of`-shaped
 * signature over a bare count, and that is a change to the ops table rather
 * than to a language.
 */
const renderSpanishQuantity = (parts: QuantityParts): string => {
  const noun = parts.form;
  if (noun === undefined) return defaultRenderQuantity(parts);
  return defaultRenderQuantity({ ...parts, number: agree(parts.number, noun) });
};

/**
 * The Spanish language: how Spanish is read and written, with no word for any
 * unit in it.
 *
 * The bare `es` tag, deliberately, and not `es-ES` or `es-419`: `Intl` resolves
 * it to CLDR's default content for Spanish, which is Spain's — group ".",
 * decimal "," — and that is what `numberFormat: "intl"` hands `parseNumber` and
 * the formatter. A regional variant is a different `Language` with a different
 * `id`, not a flag on this one, because every seam that reads a language reads
 * it by id: the alias index, `EvalOptions.locales`, `buildKeywords`. `es.test.ts`
 * pins the two separators this runtime actually produces, including the one
 * surprise in them (see there).
 *
 * Compared with the two built-ins, Spanish is the *simple* case on the axis
 * Ukrainian exists to stress and the interesting case on the one below it:
 * `selectForm` returns a bare CLDR plural category, English-style, and the work
 * is all in the numerals.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const spanish: Language = defineLanguage({
  id: "es",
  // Read from CLDR rather than hand-written, the same as `en` and `uk`. Pinning
  // the *output* of the "intl" branch in a test is a different thing from
  // bypassing it: a language that transcribes its own separators is a language
  // that can disagree with the platform.
  numberFormat: "intl",
  analyze: [
    // Required, not decorative: the resolver reaches a surface only through the
    // forms some analyzer produced, so without this Spanish cannot look up its
    // own aliases and would silently borrow another installed language's
    // `identity()` — see `third-language.test.ts`.
    identity(),
    // Spanish marks the plural and nothing else: no case, no gender agreement on
    // the noun itself, so unlike Ukrainian's ten endings two suffixes cover the
    // whole of it, exactly as in English.
    //
    //   s   after a vowel      metros    -> metro,   pulgadas -> pulgada
    //   es  after a consonant  quintales -> quintal, pies     -> pie
    //
    // `suffixStripper` sorts longest-first itself, so "es" is tried before "s"
    // regardless of the order written here, and "pies" reaches "pie" rather than
    // stopping at "pie" + "s" — both stems are offered and the resolver keeps
    // whichever one is a real alias.
    //
    // `minStem: 3` rather than English's 2, because Spanish unit symbols run to
    // three letters ("mm", "km", "mph") and a two-letter floor lets a stray "s"
    // be shaved off one of them; `weight: -2` is the same penalty both built-ins
    // use, so an exact alias always outranks a stripped one.
    //
    // What it does *not* catch, and a vocabulary must therefore list itself: a
    // plural that moves an accent ("galón" -> "galones" strips to "galon", which
    // is a different string from the alias) and one that changes its stem
    // consonant ("pie cúbico"-style compounds aside, -z/-ces words). A stripper
    // is a fallback for what a vocabulary did not think to list, never the
    // vocabulary.
    suffixStripper({ suffixes: ["es", "s"], minStem: 3, weight: -2 }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  // Hand-written, not `cardinalSpeller(CARDINALS)` — over the very same table.
  // The reasons are in `es-cardinals.ts`; the short version is that Spanish
  // writes "treinta y uno" where the shared helper composes "treinta uno".
  spell: spellSpanish,
  keywords: {
    // "en" is the locative preposition ("10 km en metros") and "a" the
    // directional one ("convertir 10 km a metros"). Both are ordinary in a
    // Spanish conversion and neither is a synonym of the other in general
    // Spanish, which is why both are listed where `off` below gets exactly one.
    in: ["en", "a"],
    // "el 20% de 50" — the partitive, and the same word as English's "of".
    of: ["de"],
    // The noun, as Ukrainian's "знижка" is: "20% descuento 50". "rebaja" and the
    // phrase "de descuento" were considered and left out, for the reason `en.ts`
    // gives — an operator that reads as a preposition should not be collecting
    // synonyms, and "de" is already claimed by `of`.
    off: ["descuento"],
    // With and without the acute. NFKC folding leaves a precomposed á as á — it
    // does not strip diacritics — so the spelling a keyboard without accents
    // produces has to be declared beside the correct one.
    plus: ["más", "mas"],
    minus: ["menos"],
    times: ["por"],
    // "entre" is the divisor connective a Spanish speaker says aloud: "doce
    // entre cuatro". "dividido" is left out because it is the participle rather
    // than the connective, and it wants a `by` word after it.
    over: ["entre"],
    // No `by`. Spanish spells the connective after both participles with the
    // same word — "multiplicado por", "dividido por" — and `by` exists only to
    // be swallowed by an operator that precedes it, so claiming "por" for it
    // would take it away from `times`, where it is the operator itself. One
    // surface cannot be both, and "3 por 4" is the commoner input.
  },
  /**
   * "one" | "other", so a Spanish `forms` table is the two-row English shape.
   *
   * CLDR gives `es` a third category, `many`, and this deliberately folds it
   * into `other`. That category exists for compact notation — it is what makes
   * `1 000 000` read as "1 millón" and `1,5` million as "1,5 millones", and in
   * that register Spanish also inserts "de" before the noun ("dos millones de
   * metros"). This engine never prints compact notation: `formatNumber` renders
   * every magnitude in full digits, so the count a vocabulary is agreeing with
   * is always the plain one and `many` would be a third row every translator
   * must fill with the same string as `other`. Rule 6 is satisfied by folding
   * here rather than by asking for a row that can never differ — and the day
   * compact printing arrives, the axis is added in this function and nowhere
   * else.
   *
   * The "de" is the one half of that register the engine *does* reach, because
   * `spell` writes scale words even though `formatNumber` never does: a spelled
   * million is "un millón", and Spanish then requires "un millón de metros".
   * `renderSpanishQuantity` inserts it, which leaves this fold intact — the
   * plural row still cannot differ, so it still is not asked for.
   */
  selectForm: ({ count }) => {
    if (count === undefined) return "other";
    const category = plural.select(count.toNumber());
    return category === "one" ? "one" : "other";
  },
  // The one axis Spanish has that `selectForm` cannot carry, applied at the one
  // call that can see both halves of the agreement. See `renderSpanishQuantity`.
  renderQuantity: renderSpanishQuantity,
});

export default spanish;
