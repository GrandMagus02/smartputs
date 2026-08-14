import type { AnalyzedForm, Analyzer, Language, QuantityParts } from "../types";
import { defineLanguage } from "./define";
import { cardinalNumerals, identity, suffixStripper } from "./helpers";
import { CARDINALS, spellPortuguese } from "./pt-cardinals";
import { defaultRenderQuantity } from "./render";

const plural = new Intl.PluralRules("pt");

/**
 * The plural classes Portuguese forms by **replacing** an ending rather than by
 * adding to one — the half of its morphology `suffixStripper` structurally
 * cannot reach, since that helper only ever cuts a suffix off and hands back
 * the stem.
 *
 * "galões" is not "galõe" + s and no amount of cutting makes it "galão";
 * "barris" is not "barri" + s and no amount of cutting makes it "barril". A
 * language that shipped only the stripper would read "2 galões" as an unknown
 * word while reading "2 galão" fine, which is the wrong way round: the plural
 * is the form a sentence actually contains.
 *
 * Written here rather than added to `locale/helpers.ts` deliberately. Fifteen
 * languages are being written against these seams at once and a new export in
 * the shared helper barrel is the one edit that collides with all of them; the
 * type is the escape hatch (`Analyzer` is an ordinary function), and a language
 * that needs a rule the shipped helpers do not have is expected to declare one.
 * If Spanish and Italian turn out to want the same shape, promoting it is a
 * later, deliberate move with three call sites to justify it.
 *
 * Emits **every** matching rewrite rather than the longest, exactly as
 * `suffixStripper` does: "quintais" is both "quintal" (-ais → -al) and the
 * nonexistent "quintail" (-is → -il), the resolver keeps whichever is a
 * registered alias, and a word that is neither simply finds nothing.
 */
function pluralReplacer(opts: {
  /** `[plural ending, singular ending]`, tried longest-first. */
  pairs: readonly (readonly [string, string])[];
  minStem: number;
  weight?: number;
}): Analyzer {
  const weight = opts.weight ?? -2;
  const pairs = [...opts.pairs].sort((a, b) => b[0].length - a[0].length);

  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const [ending, singular] of pairs) {
      if (!surface.endsWith(ending)) continue;
      const stem = surface.slice(0, surface.length - ending.length);
      if (stem.length < opts.minStem) continue;
      out.push({ form: stem + singular, weight });
    }
    return out;
  };
}

/**
 * The numerals that agree in gender with the noun they count, masculine key to
 * feminine value. Portuguese inflects exactly these and no others: `um`, `dois`
 * and the hundreds from 200 up. Everything from `três` to `dezenove`, every ten
 * from `vinte` to `noventa`, `cem`/`cento` and `mil` are invariable, and
 * `milhão`/`bilhão`/`trilhão` are masculine *nouns* in their own right rather
 * than agreeing numerals — which is what `SCALE_NOUNS` below is for.
 *
 * Unlike Spanish there is no apocope to account for: Portuguese writes "um
 * metro" where Spanish writes "un metro", so the key here is the same word
 * `spellPortuguese` already emits and no second spelling has to be predicted.
 *
 * Every value is also a declared key of `CARDINALS.units` or `CARDINALS.tens` —
 * "uma", "duas", "duzentas" and the rest are all listed there, as read-only
 * variants declared after their masculine twins — so a feminised numeral reads
 * back as the number it came from. That is rule 5 applied to a numeral rather
 * than to a unit word: this file may print nothing the table cannot read.
 */
const FEMININE: Readonly<Record<string, string>> = {
  um: "uma",
  dois: "duas",
  duzentos: "duzentas",
  trezentos: "trezentas",
  quatrocentos: "quatrocentas",
  quinhentos: "quinhentas",
  seiscentos: "seiscentas",
  setecentos: "setecentas",
  oitocentos: "oitocentas",
  novecentos: "novecentas",
};

/**
 * The scale words that are *nouns*, and therefore agree with nothing further to
 * their right: in "duzentos milhões de libras" the hundreds are masculine
 * because they count `milhões`, not `libras`.
 *
 * `mil` is deliberately absent, exactly as it is in `es.ts`. It is a quantifier
 * rather than a noun — no plural ("dois mil", never "dois mis"; see
 * `SCALE_PLURALS` in `pt-cardinals.ts`) and no "de" after it — so agreement
 * passes straight through it and "duzentas mil libras" is the feminine that
 * "duzentos milhões" is not. That one difference is why agreement is applied to
 * the tail *after the last scale noun* rather than to the last word alone.
 *
 * The accent-free spellings are listed beside the accented ones even though
 * `spellPortuguese` only ever writes the accented form: `CARDINALS` reads both,
 * and a set that answered only for the form this file happens to emit today
 * would be a set that silently stopped covering the table it is derived from.
 */
const SCALE_NOUNS = new Set([
  "milhão",
  "milhao",
  "milhões",
  "milhoes",
  "bilhão",
  "bilhao",
  "bilhões",
  "bilhoes",
  "trilhão",
  "trilhao",
  "trilhões",
  "trilhoes",
]);

/**
 * Portuguese nouns ending in -a that are nevertheless masculine.
 *
 * Gender is otherwise recoverable from the noun's own ending — a Portuguese
 * noun in -a is feminine (polegada, milha, hora, tonelada, libra, onça, pinta,
 * caloria, jarda, volta, paica, semana…), and every noun in -o, -e, -l, -r, -z,
 * -u and -ão is masculine — so this is a morphological rule with a named
 * exception list rather than a per-unit gender table. A per-unit table was the
 * alternative and it is worse for the reason rule 6 gives: gender is a property
 * of the noun, not of the count or the slot, so it must not become a `forms`
 * axis that every other translator then has to fill.
 *
 * Two exceptions, and they are the whole of it for the units this repo prints:
 *
 * **-grama.** "o grama", "o quilograma", "o miligrama" are masculine, because
 * they are the Greek neuter -γραμμα borrowed through Latin, the same class as
 * "o programa" and "o telegrama". This is the single commonest gender mistake
 * in Brazilian Portuguese — "duzentos gramas de farinha" is the correct line and
 * "duzentas gramas" is the one people say — so getting it wrong here would print
 * an error a reader would recognise on sight. Written as a suffix test rather
 * than three literals so that any further -grama compound is covered by the rule
 * that actually explains it.
 *
 * **dia.** Another Greek loan that kept its masculine, and no ending
 * distinguishes it from "caloria", which is feminine and scans identically.
 * `@smartput/duration/locale/pt` says the same thing about the same word; this
 * is the one place a language file names a string that is also a unit's word,
 * and the alternative — an axis on `selectForm` — would make fourteen other
 * languages carry a fact only Portuguese and Spanish have.
 */
const isMasculineInA = (noun: string): boolean =>
  noun === "dia" || noun === "dias" || noun.endsWith("grama") || noun.endsWith("gramas");

const isFeminine = (noun: string): boolean =>
  (noun.endsWith("a") || noun.endsWith("as")) && !isMasculineInA(noun);

/**
 * Rewrite a spelled numeral to agree with the noun it is about to stand in
 * front of.
 *
 * A no-op unless every condition holds at once: the number was spelled into
 * words (a digit string contains no key of `FEMININE`), the label is a noun this
 * language wrote rather than a symbol or a bare alias, and that noun is
 * feminine. So the ordinary path — "1 polegada", "1,5 kg" — is untouched byte
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
 * `defaultRenderQuantity`, with the one thing Portuguese assembles differently:
 * the number agrees with the noun.
 *
 * This is the seam that makes gender expressible without a `forms` axis for it,
 * and it is the right one precisely because gender is *not* a property of the
 * slot or the count — the two things `selectForm` is told. It is a property of
 * the noun, and this is the only call at which the language sees the noun and
 * the number together. `NumeralSpeller` cannot do it: it is handed a magnitude
 * and nothing else, which is why `spellPortuguese` writes the masculine and says
 * so, and why the correction belongs here rather than there. `es.ts` reached the
 * same conclusion about the same grammar first; this is that seam used a second
 * time, which is the evidence that it was the right seam.
 *
 * Everything else is delegated, `gap` included, so `Printer`'s `spacing` option
 * and `formatValue`'s tight symbols keep behaving exactly as they do for every
 * other language.
 */
const renderPortugueseQuantity = (parts: QuantityParts): string => {
  const noun = parts.form;
  if (noun === undefined) return defaultRenderQuantity(parts);
  const number = agree(parts.number, noun);
  // `milhão` and `bilhão` are nouns, so what follows them is a complement and
  // not an apposition: "um milhão de gramas", never *"um milhão gramas". The
  // preposition appears only when the scale noun is the *last* word — a
  // remainder behind it makes the number a compound quantifier again and the
  // "de" drops out ("um milhão e quinhentas mil milhas"). `mil` never takes it,
  // being a quantifier and not a noun, which is the same distinction
  // `SCALE_NOUNS` draws for agreement.
  //
  // Only the word branch: a symbol is not a noun this language inflected, and
  // "um milhão de km/h" is a judgement about an abbreviation rather than about
  // Portuguese. `selectForm`'s doc comment notes that CLDR files this register
  // under `many`; the "de" is the half of that register the spelled printer does
  // reach, which is why it is handled here while the plural row still is not.
  //
  // The cost is written down rather than hidden: "de" is also this language's
  // `of` keyword, so a spelled million does not lex back as the quantity it came
  // from. That is the register's own grammar and not a choice — Portuguese has
  // no way to say "um milhão de gramas" without the preposition — and `es.ts`
  // pays exactly the same price for exactly the same sentence.
  const words = number.split(" ");
  const de = SCALE_NOUNS.has(words[words.length - 1] as string) ? " de" : "";
  return defaultRenderQuantity({ ...parts, number: `${number}${de}` });
};

/**
 * The Portuguese language: how Portuguese is read and written, with no word for
 * any unit in it.
 *
 * **Brazilian, under the bare `pt` tag.** That is this project's ruling and it
 * is also what the platform does: `Intl.NumberFormat("pt")` resolves to the
 * Brazilian defaults — "." for groups and "," for the decimal — where
 * `Intl.NumberFormat("pt-PT")` groups with a space. There is no `pt-BR.ts` and
 * no `pt-PT.ts`; where the two standards differ on a *word* (the numerals
 * "dezesseis"/"dezasseis", "quatorze"/"catorze") both spellings are readable and
 * the Brazilian one is what gets written. See `pt-cardinals.ts`.
 *
 * The interesting half of Portuguese for this engine is not its plural
 * categories — it has the same two noun forms English does — but its plural
 * *morphology*, which is three classes wide where English is one:
 *
 *   metro   → metros     a vowel takes -s          (`suffixStripper`)
 *   colher  → colheres   -r/-z/-n take -es         (`suffixStripper`)
 *   galão   → galões     -ão is rewritten          (`pluralReplacer`)
 *   barril  → barris     -l is rewritten to -is    (`pluralReplacer`)
 *
 * The second interesting half is **gender**, which is not a plural category at
 * all: a Portuguese unit noun does not inflect for it, it *has* it, and what
 * inflects is the numeral standing in front — "um metro" against "uma milha",
 * "duzentos gramas" against "duzentas toneladas". So it is not a `forms` axis
 * (rule 6: nothing selects on it) and it is not the speller's either (it is
 * handed a magnitude and no unit). It lives in `renderQuantity` above, the one
 * call that sees both halves of the agreement — the same seam `es.ts` opened for
 * the same grammar.
 *
 * The last two plural rows are why this file declares an analyzer of its own.
 * `real` → `reais` is the one that matters most in practice: it is the Brazilian
 * currency, and its plural is the form every price line in the country is
 * written in.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const portuguese: Language = defineLanguage({
  id: "pt",
  // Read from CLDR rather than transcribed, the same as `en` and `uk`. Under
  // the bare tag this runtime groups with "." and marks the decimal with ",",
  // and `pt.test.ts` pins both — but pinning the *output* of the "intl" branch
  // is different from bypassing it: a language that writes down its own
  // separators is a language that can disagree with the platform.
  numberFormat: "intl",
  analyze: [
    // Required, not decorative: the resolver reaches an alias only through a
    // form some analyzer produced, so a chain without this one cannot read its
    // own vocabulary. See `third-language.test.ts`.
    identity(),
    // The additive half of the plural. "s" carries the vowel-final nouns, which
    // is nearly all of them (metros, gramas, toneladas, litros, segundos); "es"
    // carries the consonant-final ones (colheres, mares).
    //
    // `minStem: 2` and not Ukrainian's 3. Two is the length of the shortest
    // spelled unit noun Portuguese has — "pé", whose plural "pés" a stem floor
    // of 3 would refuse to fold — while the symbols a careless strip could
    // shred to nothing ("m", "g", "l", "h") are one letter and are refused at
    // 2 anyway. So this floor is exactly the boundary between a word and a
    // symbol in this language, rather than a round number.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
    // The rewriting half. Each row is here for a noun a vocabulary will want:
    //
    //   ões → ão   galões → galão, milhões → milhão
    //   ães → ão   pães → pão            (the smaller -ão class; no unit today,
    //                                     but it is the same ending and leaving
    //                                     it out would make the rule look like
    //                                     it knew something it does not)
    //   ãos → ão   grãos → grão          (the grain, a real unit of mass)
    //   ais → al   reais → real, quintais → quintal
    //   éis → el   papéis → papel
    //   eis → el   the same word typed without the accent
    //   óis → ol   lençóis → lençol
    //   ois → ol   likewise unaccented
    //   uis → ul   azuis → azul
    //   is  → il   barris → barril
    //
    // Left out: -ns → -m (homens → homem). It is the fourth class and no unit
    // noun in Portuguese ends in -m — the units that do are borrowed symbols
    // ("lm", "nm", "ohm") which take a plain -s when they are pluralized at
    // all — so the row would buy nothing and would hand the resolver a bad stem
    // for every word ending in "-ns", the nanosecond symbol among them.
    //
    // `minStem: 2`, one lower than it looks like it should be, because the
    // stem here is what is left *before* a three-character ending: "reais" is
    // "re" + "ais" and "grãos" is "gr" + "ãos". A floor of 3 would silently
    // drop both, which is the pair this analyzer exists for.
    pluralReplacer({
      pairs: [
        ["ões", "ão"],
        ["ães", "ão"],
        ["ãos", "ão"],
        ["ais", "al"],
        ["éis", "el"],
        ["eis", "el"],
        ["óis", "ol"],
        ["ois", "ol"],
        ["uis", "ul"],
        ["is", "il"],
      ],
      minStem: 2,
      weight: -2,
    }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  // Portuguese's own, not `cardinalSpeller`: it needs "e" inside every group,
  // a combining form of 100, and agreement on the scale word. The reasoning is
  // in `pt-cardinals.ts`, beside the table both directions read.
  spell: spellPortuguese,
  keywords: {
    // "em" is the preposition a conversion is spoken with — "5 kg em gramas" —
    // and "para" is the "into" of one: "5 kg para gramas". "a" ("de gramas a
    // quilos") is the third and is left out on purpose: it is one letter, it is
    // also the feminine article, and a keyword is claimed from the whole input
    // before any unit alias is consulted.
    in: ["em", "para"],
    of: ["de"],
    // As in `en` and `uk`, one surface word for this operator and no more.
    // "desconto" is the noun a Brazilian price line carries; "abatimento" and
    // "off" (which Brazilian retail does write, in English) are left out
    // because an operator that reads as a preposition should not be collecting
    // synonyms — and "off" in particular is already English's, so claiming it
    // here would say nothing new and would tie two languages' tables together.
    off: ["desconto"],
    plus: ["mais"],
    minus: ["menos"],
    // "3 vezes 4" and "3 por 4" are both multiplication, and "por" is the
    // operator itself here rather than a connective after a participle.
    //
    // That reading is forced, not chosen. Portuguese would rather spell
    // division "dividido por" and multiplication "multiplicado por", which
    // wants "por" as `by` — the word an operator swallows. But Spanish claims
    // exactly this surface as `times` (`locale/es.ts`, for "3 por 4"), and
    // `buildKeywords` refuses two languages that disagree about one word: an
    // engine reading both would throw on boot rather than at a keystroke (I9).
    // The two languages inherited "por" from the same Latin preposition and use
    // it the same way, so agreeing is the honest resolution rather than a
    // concession — and staying silent about the word would only hand the
    // decision to whichever engine happens to install Spanish beside this.
    times: ["vezes", "por"],
    // "sobre" is the one-word divisor connective — "doze sobre quatro" — and is
    // to Portuguese what "entre" is to Spanish. "dividido" is listed beside it
    // because it is the word a user reaches for first, and it works standing
    // alone; what it cannot do is carry its own "por", since that word is
    // `times` above and two operator tokens in a row is a parse error rather
    // than a phrase. "multiplicado" is left out for the same reason, and
    // without the same excuse: multiplication already has two one-word
    // spellings and does not need a participle that only half works.
    over: ["dividido", "sobre"],
    // No `by`. It exists only to be swallowed by a preceding operator, and the
    // sole Portuguese candidate — "por" — is an operator in its own right; one
    // surface cannot be both, and "3 por 4" is the commoner input. `es.ts`
    // reaches the same conclusion about the same word.
  },
  /**
   * One axis, two keys: `"one"` and `"other"`. Portuguese nouns have exactly
   * two number forms and no case, so unlike Ukrainian and German there is
   * nothing for the slot to decide — a conversion target ("em gramas") is
   * spelled the same as a bare quantity.
   *
   * The one thing worth reading twice is what this does *not* return. CLDR
   * gives Portuguese a third category, `many`, and this runtime's
   * `Intl.PluralRules("pt").select` hands it back for 1000000, 2000000 and
   * every other whole multiple of a million. It is a category about the
   * *numeral*, not about the noun: it exists so a compact rendering can say
   * "1 milhão" instead of "1 milhões", and the noun after it is plural like any
   * other — "2.000.000 de gramas" is spelled with the same "gramas" as
   * "2 gramas". Passing it through would put a third row in every `forms` table
   * in the language, identical to `other` in every one of them, and would fail
   * the contract check for every vocabulary that (reasonably) wrote two.
   *
   * So it is folded here, once, where the reasoning can be written down —
   * rather than fifteen times in fifteen vocabularies, where it would look like
   * an omission.
   *
   * Two rows a vocabulary author should expect and English does not have:
   * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 grama"),
   * and **1,5 selects `one`** as well — "1,5 milhão", "1,5 quilograma", which
   * is the Portuguese usage and the exact opposite of English's "1.5
   * kilograms". `pt.test.ts` pins both.
   */
  selectForm: ({ count }) => {
    if (count === undefined) return "other";
    const category = plural.select(count.toNumber());
    return category === "many" ? "other" : category;
  },
  // The one axis Portuguese has that `selectForm` cannot carry, applied at the
  // one call that can see both halves of the agreement. See
  // `renderPortugueseQuantity`.
  renderQuantity: renderPortugueseQuantity,
});

export default portuguese;
