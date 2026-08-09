import type { Language } from "../types";
import { defineLanguage } from "./define";
import { cardinalNumerals, cardinalSpeller, identity, suffixStripper } from "./helpers";
import { CARDINALS } from "./uk-cardinals";

const plural = new Intl.PluralRules("uk");

/**
 * The Ukrainian language: how Ukrainian is read and written, with no word for
 * any unit in it.
 *
 * Ukrainian is why `selectForm` returns an opaque string instead of a CLDR
 * plural category. Its grammar needs two axes where English needs one — case
 * *and* number — so a key here is `` `${case}-${category}` ``: eight keys per
 * unit, not two. The engine never learns what `"loc"` means. It asks the
 * language for a key and indexes the unit's `forms` table with it (design
 * decision I3), which is the only reason a language can add an axis without
 * anything upstream of `forms` changing shape.
 *
 * The case comes from the slot, and `conversion-target` is locative because
 * that is what `в` governs: "в 5 кілограмах", never "в 5 кілограмів". That row
 * — a unit word chosen with no count in hand at all — is the one the old
 * one-dimensional `display` model could not express, and it is why Ukrainian is
 * a phase of this plan rather than a follow-up to it.
 *
 * Words for units are not here: they are `Vocabulary` tables beside the kinds
 * that declare the units, and they reach this object through `composeLocale`.
 */
export const ukrainian: Language = defineLanguage({
  id: "uk",
  // Read from CLDR rather than hand-written, the same as `en`. This runtime's
  // `Intl.NumberFormat("uk")` groups with U+00A0 and marks the decimal with
  // ",", and `uk.test.ts` pins both — but pinning the *output* of the "intl"
  // branch is different from bypassing it: a language that transcribes its own
  // separators is a language that can disagree with the platform.
  numberFormat: "intl",
  analyze: [
    identity(),
    // Ukrainian inflects for seven cases across two numbers, so unlike English
    // — where two suffixes cover the whole of it — a fallback stripper needs
    // the endings a unit noun actually takes. Each is here for one reason:
    //
    //   ами  instrumental plural       кілограмами -> кілограм
    //   ою   instrumental sg. feminine тонною      -> тонн
    //   ів   genitive plural           кілограмів  -> кілограм
    //   ом   instrumental sg. masc.    кілограмом  -> кілограм
    //   ам   dative plural             кілограмам  -> кілограм
    //   ах   locative plural           кілограмах  -> кілограм   (the "в …" row)
    //   и    nominative plural         кілограми   -> кілограм
    //   і    nom. plural / locative sg. метрі      -> метр
    //   а    genitive sg. masculine    кілограма   -> кілограм   (the 1,5 row)
    //   у    dative/locative sg. masc. кілограму   -> кілограм
    //
    // This is a fallback, not the vocabulary: a `Vocabulary` lists the forms a
    // reader is expected to type, and the stripper only catches what it did
    // not think to list. `minStem: 3` keeps it away from the two-letter
    // symbols Ukrainian units are usually written with ("кг", "га", "хв") —
    // shredding those would hand the resolver stems of one letter. `weight:
    // -2` is the same penalty `en` uses, so an exact alias always outranks a
    // stripped one. `suffixStripper` sorts longest-first itself, so "ами" is
    // tried before "и" regardless of the order written here.
    suffixStripper({
      suffixes: ["ами", "ою", "ів", "ом", "ам", "ах", "и", "і", "а", "у"],
      minStem: 3,
      weight: -2,
    }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  spell: cardinalSpeller(CARDINALS),
  keywords: {
    // "в"/"у" are the same preposition (the choice between them is euphonic,
    // not semantic), and "до" is the "into" of a conversion: "1 кг в г",
    // "1 кг у грамах", "1 кг до грамів".
    in: ["в", "у", "до"],
    of: ["від"],
    // "знижка" is the noun ("discount"), the word a Ukrainian price line
    // actually carries. As in `en`, one surface word for this operator and no
    // more: an operator that reads as a preposition should not be collecting
    // synonyms.
    off: ["знижка"],
    plus: ["плюс"],
    minus: ["мінус"],
    times: ["помножити"],
    over: ["поділити"],
    by: ["на"],
  },
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "loc" : "nom";
    // one | few | many | other. "other" is the fractional category in
    // Ukrainian — "1,5 кілограма", genitive *singular* — and it is also the
    // answer when there is no count at all (ruling R5), which is what makes
    // "loc-other" the key a bare conversion target lands on.
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
});

export default ukrainian;
