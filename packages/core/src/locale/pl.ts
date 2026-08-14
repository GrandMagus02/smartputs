import type { Language } from "../types";
import { defineLanguage } from "./define";
import { identity, suffixStripper } from "./helpers";
import { polishNumerals, polishSpeller } from "./pl-cardinals";
import { defaultRenderQuantity } from "./render";

const plural = new Intl.PluralRules("pl");

/**
 * The Polish language: how Polish is read and written, with no word for any
 * unit in it.
 *
 * Polish keys its `forms` tables on two axes, case × CLDR category, exactly as
 * Ukrainian and German do. What makes it worth shipping beside them is that it
 * disagrees with Ukrainian on the *contents* of both axes while sharing their
 * shape, which is the arrangement that catches a vocabulary copied across the
 * two Slavic languages without being re-read:
 *
 * **The `many` category reaches further than Ukrainian's.** Both languages have
 * `one`, `few`, `many` and `other`, and both put 2–4 in `few`. They part at the
 * compounds: Polish counts 21 by its final 1 the way it counts 5 — "dwadzieścia
 * jeden kilogramów", genitive plural, category `many` — where Ukrainian agrees
 * 21 with the singular ("двадцять один кілограм", category `one`). 101 and 1001
 * go the same way. A Polish table that mirrors `uk`'s therefore prints the
 * nominative singular at every -1 above twenty, which reads as a typo rather
 * than as a bug and is exactly the kind of thing a green suite does not notice.
 *
 * **`other` is the fractional row, and it is a genitive singular.** "1,5
 * kilograma", not a plural of any kind — the same trap Ukrainian's `nom-other`
 * carries, and the reason the key is not named after a number. It is also the
 * category a count-free conversion target falls to (ruling R5), and in Polish
 * those two positions want *different words*: see `selectForm` for why
 * `loc-other` is a locative plural while `nom-other` is a genitive singular,
 * even though both keys end in the same syllable.
 *
 * **The case axis comes from the preposition.** Polish `w` governs the locative
 * — "w 5 kilogramach", never "w 5 kilogramów" — and `w` is what the printer
 * emits for a conversion, being the first word this language declares under
 * `in`. See `selectForm` for what that costs the two other prepositions
 * declared beside it.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const polish: Language = defineLanguage({
  id: "pl",
  /**
   * Read from CLDR rather than transcribed, the same as every other language
   * here. This runtime's `Intl.NumberFormat("pl")` groups with U+00A0 and marks
   * the decimal with "," — Ukrainian's pair rather than German's — and
   * `pl.test.ts` pins both as escapes, because U+00A0 is invisible in source and
   * degrades to a plain space the moment anyone retypes the line. Pinning the
   * *output* of the "intl" branch is not the same as bypassing it: a language
   * that transcribes its own separators is a language that can disagree with the
   * platform.
   */
  numberFormat: "intl",
  analyze: [
    // Required, not decorative. `createResolver` looks a surface up only through
    // the forms some analyzer produced — there is no unconditional lookup of the
    // raw word — so a Polish chain without `identity()` could not reach its own
    // aliases at all. `third-language.test.ts` measures that failure and reports
    // it as a wrong unit rather than an error.
    identity(),
    // Polish inflects for seven cases across two numbers, so as in Ukrainian a
    // fallback stripper needs the endings a unit noun actually takes rather than
    // the one or two that cover English. Each is here for one reason, and the
    // masculine `kilogram` and feminine `tona` between them show why the list is
    // this long:
    //
    //   ami  instrumental plural        kilogramami -> kilogram, tonami -> ton
    //   ach  locative plural            kilogramach -> kilogram   (the "w …" row)
    //   owi  dative sg. masculine       kilogramowi -> kilogram
    //   ów   genitive plural masculine  kilogramów  -> kilogram   (the 5+ row)
    //   om   dative plural              kilogramom  -> kilogram
    //   em   instrumental sg. masculine kilogramem  -> kilogram
    //   ie   locative singular          kilogramie  -> kilogram, tonie -> ton
    //   y    nominative plural          kilogramy   -> kilogram   (the 2–4 row)
    //   e    nom./acc. plural, soft stem  mile      -> mil
    //   ę    accusative sg. feminine    tonę        -> ton
    //   ą    instrumental sg. feminine  toną        -> ton
    //   a    genitive sg. masculine     kilograma   -> kilogram   (the 1,5 row)
    //        and nominative sg. feminine  tona      -> ton
    //   u    gen./loc. sg. of the masculines that take it   roku -> rok
    //   i    genitive sg. of the soft feminines             mili -> mil
    //
    // The two nasal vowels are the reason `ę` and `ą` are listed as characters
    // in their own right and not as `e`/`a`: `tonę` and `toną` do not end in the
    // plain vowels, and a stripper that only knew the plain ones would leave a
    // stem ending in a nasal that matches no alias.
    //
    // The feminine genitive plural is a *bare stem* — five tonnes is "5 ton",
    // with no ending at all where the masculine takes -ów — so that row needs no
    // suffix here and is instead the one form a feminine vocabulary must
    // remember to list, since there is nothing for a stripper to take off it.
    //
    // This is a fallback, never the vocabulary: a `Vocabulary` lists the forms a
    // reader is expected to type, and the stripper only catches what it did not
    // think to list. `minStem: 3` keeps it away from the two-letter symbols
    // Polish units are usually written with (kg, cm, km, ml, ha), which it would
    // otherwise shred into single letters, and `weight: -2` is the penalty `en`,
    // `uk` and `de` all use, so an exact alias always outranks a stripped one.
    // `suffixStripper` sorts longest-first itself, so "ami" is tried before "i"
    // regardless of the order written here.
    suffixStripper({
      suffixes: [
        "ami",
        "ach",
        "owi",
        "ów",
        "om",
        "em",
        "ie",
        "y",
        "e",
        "ę",
        "ą",
        "a",
        "u",
        "i",
      ],
      minStem: 3,
      weight: -2,
    }),
  ],
  /**
   * Polish's own, rather than the shared `cardinalNumerals`/`cardinalSpeller`.
   * The parsing half of the shared pair would have fitted — Polish spaces its
   * numerals, unlike German — but the spelling half cannot write "dwieście
   * trzydzieści cztery" (fused hundreds that add rather than multiply) or "dwa
   * tysiące" (a scale noun that agrees with its multiplier). See
   * `pl-cardinals.ts`, which is one table read in both directions.
   */
  numerals: polishNumerals(),
  spell: polishSpeller(),
  keywords: {
    // Three prepositions, all of them ordinary ways to say a conversion:
    // "1 kg w gramach", "1 kg na gramy", "1 kg do gramów". "we" is the same
    // preposition as "w" — the choice between them is euphonic, before a
    // consonant cluster, not semantic — so it is a fourth surface and not a
    // fourth meaning. "w" is first because generation reads `keywords.in[0]`,
    // and `selectForm`'s case axis is chosen to agree with that one word.
    //
    // "na" is the one of the four that takes something away, and the cost is
    // stated here rather than left to be met at a keystroke. `buildKeywords`
    // maps a surface to exactly one key, so a word given to `in` is a word no
    // other operator may have — and "podzielić na 2" is at least as ordinary
    // Polish for division as the "podzielić przez 2" below it. With "na" spoken
    // for, that phrase reaches the parser as a division followed by a conversion
    // and fails. It is still the right trade: "przeliczyć X na Y" is *the*
    // Polish verb phrase for a unit conversion, so "na" earns its place under
    // `in` more strongly than it would under `by`, and the division survives
    // intact under "przez" and under "/". The reverse trade would have lost the
    // commoner half.
    in: ["w", "we", "na", "do"],
    // "z" is the partitive "of": "20% z 200". It is also "with" in ordinary
    // Polish, which costs nothing here — a keyword is only consulted where the
    // parser is looking for a connective.
    of: ["z"],
    // No word claimed for `off`, and that is a decision rather than an omission,
    // the same one German makes. Polish states a discount as a noun plus a
    // preposition — "20% zniżki na 50" — and `off` is a single-token keyword
    // with no way to carry the "na". Worse than German's case: "na" is already
    // claimed above as `in`, so a `zniżki` keyword would turn that phrase into a
    // discount followed by a conversion and fail at the parser. The arithmetic
    // stays reachable through `-` and `%`.
    plus: ["plus"],
    minus: ["minus"],
    // "razy" is the multiplication word of every Polish classroom — "trzy razy
    // cztery" — and it needs no particle after it, so it is a bare `times`.
    // "pomnożyć" is the spelled-out verb and does take one, exactly as English's
    // "multiplied by" does.
    times: ["razy", "pomnożyć"],
    over: ["podzielić"],
    // The particle both verbs above take, swallowed into the same op token by
    // `foldWordOps`. The cost, stated rather than hidden: a bare "10 przez 2"
    // does not parse, because a stray `by` fails at the parser. Claiming "przez"
    // as `over` instead was rejected for the reason German rejects it for
    // "durch" — it would make the commoner, fully spelled "podzielić przez" emit
    // two division operators in a row. English pays the same price for "10 by 2".
    by: ["przez"],
  },
  /**
   * Two axes: case × CLDR category. **The key set is therefore exactly eight** —
   * `nom-one`, `nom-few`, `nom-many`, `nom-other`, `loc-one`, `loc-few`,
   * `loc-many`, `loc-other` — and that is the contract every Polish
   * `Vocabulary` keys its `forms` table off. No more and no fewer, which is what
   * `assertLocaleContract`'s fourth check asserts.
   *
   * The case comes from the slot, because a conversion target is governed by the
   * preposition in front of it and `w` governs the locative: "w 5 kilogramach",
   * never "w 5 kilogramów". The other two prepositions under `in` govern
   * something else — `na` takes the accusative ("na gramy") and `do` the
   * genitive ("do gramów") — and a slot cannot tell them apart, because by the
   * time the printer asks for a target form it has already chosen which word to
   * write and that word is always `keywords.in[0]`. So the locative is not a
   * compromise between three cases; it is the case of the one preposition
   * generation actually emits, and the other two are read-only spellings.
   * Recognition is many-to-one and generation is one, which is the same
   * asymmetry `composeLocale`'s `buildKeywords` documents.
   *
   * The category comes from `Intl.PluralRules("pl")`, which declares four. Their
   * boundaries are the half of this language most likely to be got wrong from
   * memory: 0 is `many`, 2–4 are `few`, 5–21 are `many` — 21 included, which is
   * where Polish and Ukrainian part company — 22 is `few` again, and `other` is
   * reserved for fractions alone.
   *
   * Ruling R5: a conversion target has no magnitude to agree with, and `other`
   * is the category CLDR requires every locale to define as its generic one, so
   * `loc-other` is where a bare target lands. **That makes the two `-other` rows
   * hold different words in Polish, and a vocabulary that fills them from one
   * word is wrong.** `nom-other` is reached only with a fractional count, where
   * Polish takes the genitive singular ("1,5 kilograma"); `loc-other` is reached
   * only *without* a count, where the word is the plain locative plural ("w
   * kilogramach") — nothing in the engine passes a fraction into a target slot,
   * and `formatValue` never passes a target slot at all.
   *
   * The engine never learns what `"loc"` means. It asks for a key and indexes
   * `forms` with it, which is the only reason a language may add an axis without
   * anything upstream of `forms` changing shape.
   */
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
  /**
   * `defaultRenderQuantity` with one change, the same one German makes: a symbol
   * is set off from the number by a space rather than tight against it.
   *
   * That is PN-EN ISO 80000, the SI convention Polish typography follows — "5
   * kg", never "5kg" — and it is the one place the default template, written for
   * English's tight `5kg`, says something wrong about this language. The word
   * branch is untouched because it already spaces, and `gap` still wins wherever
   * the caller resolved a separator of its own, so `Printer`'s `spacing` option
   * reaches through here exactly as it does through the default.
   */
  renderQuantity: (parts) =>
    parts.form === undefined && parts.alias === undefined && parts.symbol !== undefined
      ? `${parts.number}${parts.gap ?? " "}${parts.symbol}`
      : defaultRenderQuantity(parts),
});

export default polish;
