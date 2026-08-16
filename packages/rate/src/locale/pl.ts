import { currencyVocabulary } from "@smartput/currency";
import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/** One currency's Polish half: what may be typed, and what may be printed. */
interface PolishWords {
  readonly aliases: readonly string[];
  /**
   * Eight keys, because `polish.selectForm` keys on `` `${case}-${category}` ``
   * — the case from the slot, the category from CLDR's four — and a table may
   * hold exactly the keys the language can ask for, no more and no fewer.
   */
  readonly forms: Readonly<Record<string, string>>;
}

/**
 * The Polish words for the currencies that have one.
 *
 * Five rows deserve naming before the table, because they are the rows a
 * plural-only model cannot express and the ones easiest to get plausibly wrong:
 *
 *   `nom-one`   the 1 row           "1 dolar"    nominative singular
 *   `nom-few`   the 2/3/4 row       "2 dolary"   nominative **plural**
 *   `nom-many`  the 0/5–21/teens    "5 dolarów"  genitive plural — and it
 *                                   reaches **21**: "21 dolarów"
 *   `nom-other` the *fractional*    "1,5 dolara" genitive **singular**
 *   `loc-*`     the conversion target, "w dolarach" — locative, which is what
 *                                   `w` governs
 *
 * Two of those are where a table ported from a neighbour goes wrong, and they
 * fail in opposite directions:
 *
 *   - **From `ru`.** Russian's 2/3/4 row is a genitive *singular* ("2 доллара")
 *     and is therefore the same word as its fractional row. Polish's is a
 *     nominative *plural* ("2 dolary"), a different word from "1,5 dolara". A
 *     Russian table restemmed into Polish prints "2 dolara", which is wrong and
 *     which no shape-based test would catch — every key would still be present.
 *   - **From `uk`.** Ukrainian agrees 21 with the singular ("двадцять один
 *     долар"); Polish counts every -1 above twenty by its final digit the way it
 *     counts 5, so 21, 101 and 1001 all take the genitive plural. A Ukrainian
 *     table restemmed into Polish prints "21 dolar", which reads as a typo
 *     rather than as a bug.
 *
 * Gender and declension class drive every ending, and this table happens to
 * carry four of them, which is why it is not one paradigm with the stem swapped:
 *
 *   dolar, funt, jen, frank   masculine hard — nom. pl. -y/-i, gen. pl. -ów,
 *                                              gen. sg. -a
 *   hrywna                    feminine hard  — gen. sg. -y, gen. pl. a bare stem
 *                                              with a fill vowel ("5 hrywien"),
 *                                              loc. sg. -ie
 *   złoty                     *adjectival*   — it declines like an adjective,
 *                                              not like a noun: "2 złote", "5
 *                                              złotych", "1,5 złotego", "w
 *                                              złotym"
 *   euro                      indeclinable   — one word in all eight cells
 *
 * The locative singular is the cell that proves the four paradigms are really
 * four, because each of them forms it differently and three run a consonant
 * alternation to get there: `dolar` → "dolarze" (r→rz), `funt` → "funcie"
 * (t→c), `frank` → "franku" (a velar stem takes -u rather than -e, so there is
 * no alternation and no -e either), `hrywna` → "hrywnie" (n→ń, spelled -nie).
 * None of them is reachable from the nominative by a suffix rule, which is the
 * whole reason they are listed.
 *
 * Every form printed is also listed as an alias (`aliases` repeats what `forms`
 * holds), because a printed word recovered only by the language's penalised
 * suffix stripper is a word this vocabulary is guessing at rather than declaring
 * — and the stripper cannot recover several of these anyway: "hrywien" strips
 * nothing at all, and "złotych" would have to lose an adjectival ending that is
 * not in the list.
 */
const POLISH: Readonly<Record<string, PolishWords>> = {
  // Indeclinable, and the one entry whose eight cells are one word. Polish
  // borrowed "euro" as a neuter noun ending in -o, and the standard declines it
  // in no case at all: "1 euro", "5 euro", "w euro". The colloquial "eurów" that
  // some speakers produce is not listed, because the whole point of the entry is
  // to say that this noun has one form. Nothing is added to `aliases` either —
  // "euro" is already the generated table's own word.
  eur: {
    aliases: [],
    forms: {
      "nom-one": "euro",
      "nom-few": "euro",
      "nom-many": "euro",
      "nom-other": "euro",
      "loc-one": "euro",
      "loc-few": "euro",
      "loc-many": "euro",
      "loc-other": "euro",
    },
  },
  // Polish writes the dollar with one "l" — "dolar", never "dollar" — so not one
  // cell of this paradigm overlaps the generated English aliases beside it.
  usd: {
    aliases: [
      "dolar",
      "dolara",
      "dolarowi",
      "dolarem",
      "dolarze",
      "dolary",
      "dolarów",
      "dolarom",
      "dolarach",
      "dolarami",
      // The Polish half of what `en`'s COLLOQUIAL layer is: "baks" is the
      // borrowed "buck", and it is what a price is quoted in out loud. It reads
      // and is never printed — no `forms` cell holds it — for the same reason
      // "bucks" is an alias of `usd` next door and not its display word.
      "baks",
      "baksa",
      "baksy",
      "baksów",
      "baksach",
    ],
    forms: {
      "nom-one": "dolar",
      "nom-few": "dolary",
      "nom-many": "dolarów",
      "nom-other": "dolara",
      "loc-one": "dolarze",
      "loc-few": "dolarach",
      "loc-many": "dolarach",
      "loc-other": "dolarach",
    },
  },
  // "funt" is also `@smartput/mass`'s word for the pound, in this language as in
  // English ("5 pounds" is the same ambiguity), and it is left standing for the
  // same reason: the two readings are separated by the kinds installed and by
  // weight, never by taking a word away from the language that has it.
  // "szterling" is the clipping of "funt szterling", whose second word can never
  // be an alias — a unit word is one token.
  gbp: {
    aliases: [
      "funt",
      "funta",
      "funtowi",
      "funtem",
      "funcie",
      "funty",
      "funtów",
      "funtom",
      "funtach",
      "funtami",
      "szterling",
      "szterlinga",
      "szterlingów",
      "szterlingach",
    ],
    forms: {
      "nom-one": "funt",
      "nom-few": "funty",
      "nom-many": "funtów",
      "nom-other": "funta",
      "loc-one": "funcie",
      "loc-few": "funtach",
      "loc-many": "funtach",
      "loc-other": "funtach",
    },
  },
  // "jen" is the Polish spelling of the yen, and it declines like any other
  // masculine hard noun — which is the difference from Russian's feminine
  // "иена" and from English's uncountable "yen", where all four CLDR rows are
  // the same word.
  jpy: {
    aliases: [
      "jen",
      "jena",
      "jenowi",
      "jenem",
      "jenie",
      "jeny",
      "jenów",
      "jenom",
      "jenach",
      "jenami",
    ],
    forms: {
      "nom-one": "jen",
      "nom-few": "jeny",
      "nom-many": "jenów",
      "nom-other": "jena",
      "loc-one": "jenie",
      "loc-few": "jenach",
      "loc-many": "jenach",
      "loc-other": "jenach",
    },
  },
  chf: {
    aliases: [
      "frank",
      "franka",
      "frankowi",
      "frankiem",
      "franku",
      "franki",
      "franków",
      "frankom",
      "frankach",
      "frankami",
    ],
    forms: {
      "nom-one": "frank",
      "nom-few": "franki",
      "nom-many": "franków",
      "nom-other": "franka",
      // The velar stem's locative singular is -u with no alternation at all: "we
      // franku". Russian's is "франке" and Ukrainian's "франку", so all three
      // Slavic tables disagree in this one cell — which is exactly why none of
      // them may be a copy of another.
      "loc-one": "franku",
      "loc-few": "frankach",
      "loc-many": "frankach",
      "loc-other": "frankach",
    },
  },
  // The adjectival one, and the currency this language actually spends. "złoty"
  // is a substantivised adjective — it *means* "golden" — so it takes adjective
  // endings all the way through: "2 złote" (nominative plural in -e, not -y),
  // "5 złotych", "1,5 złotego", "w złotym". Every cell here would be wrong if
  // the masculine noun paradigm above had been copied down.
  //
  // "zł" is the abbreviation every Polish price tag carries, and it is an alias
  // rather than the `symbol` for the reason given below — the generated symbol
  // is already "zł", and a currency sign is not this file's to restate.
  // "złotówka" is the colloquial feminine ("5 złotówek"), which reads and is
  // never printed.
  pln: {
    aliases: [
      "złoty",
      "złotego",
      "złotemu",
      "złotym",
      "złote",
      "złotych",
      "złotymi",
      "zł",
      "złotówka",
      "złotówki",
      "złotówek",
      "złotówkach",
    ],
    forms: {
      "nom-one": "złoty",
      "nom-few": "złote",
      "nom-many": "złotych",
      "nom-other": "złotego",
      "loc-one": "złotym",
      "loc-few": "złotych",
      "loc-many": "złotych",
      "loc-other": "złotych",
    },
  },
  // Feminine hard, so the genitive plural is a bare stem — and Polish inserts a
  // fill vowel into the consonant cluster it leaves behind, giving "5 hrywien"
  // rather than the "hrywn" a stripper would produce. The 2/3/4 row and the
  // fractional row are both "hrywny", the genitive singular doubling as the
  // nominative plural, which is a coincidence of this declension and not a rule
  // that transfers to the masculines above.
  uah: {
    aliases: [
      "hrywna",
      "hrywny",
      "hrywnie",
      "hrywnę",
      "hrywną",
      "hrywien",
      "hrywnom",
      "hrywnach",
      "hrywnami",
    ],
    forms: {
      "nom-one": "hrywna",
      "nom-few": "hrywny",
      "nom-many": "hrywien",
      "nom-other": "hrywny",
      "loc-one": "hrywnie",
      "loc-few": "hrywnach",
      "loc-many": "hrywnach",
      "loc-other": "hrywnach",
    },
  },
};

/**
 * Polish words for the currencies, layered over the generated table.
 *
 * `currencyVocabulary` takes a locale, and it is worth stating exactly what that
 * argument does today: it stamps the tag on the returned `Vocabulary` and
 * nothing else. `CURRENCIES` holds one set of words, and they are English
 * ("dollar", "kronor"), so `currencyVocabulary("pl")` returns English words
 * under a `pl` label — its own doc comment says as much, and `pl.test.ts` pins
 * it so that the day the table grows localized names, this file stops being
 * right and that test stops being green together. What the call is still good
 * for is the half of a currency that is *not* language: the ISO code, the Latin
 * aliases and the currency sign. So the generated half stays generated exactly
 * as in `en`, `de` and `ru`, and the two English-specific things it carries are
 * handled deliberately:
 *
 *   - its `aliases` are kept, all of them. Reading them costs nothing and losing
 *     them would mean "30 usd" stops parsing the moment the format locale
 *     changes — recognition is many-to-one, generation is one (design decision
 *     I6). It is the same reuse `@smartput/mass/locale/pl` performs with
 *     `aliasesFor`, and it is why "dollars" is readable here.
 *   - its `forms` are dropped, every one of them. They are keyed `one`/`other`,
 *     which is what `english.selectForm` produces; `polish.selectForm` never
 *     returns either, so keeping them would leave a table the engine can only
 *     miss — and every word in them is English besides.
 *
 * The two lists are deduped as they are joined, which no sibling translation has
 * needed: Polish spells the euro exactly as the generated table does, so `eur`
 * is the one row where a Polish word and a generated one are the same string,
 * and an alias indexed twice is a duplicate candidate at every keystroke.
 *
 * `symbol` is the generated one throughout, and that is a decision rather than
 * an oversight. A currency sign is a fact about the currency and not about a
 * language: ₴ is ₴ in every script, and `money`'s format hook prints
 * `symbolOf(code)` from the same table without ever consulting a locale — so a
 * Polish symbol here could never be the string a formatted result carries, and
 * would only ever reach `Printer`'s `symbols: true`, giving one currency two
 * spellings that disagree. It costs nothing for the złoty in any case, whose
 * generated symbol already *is* the Polish abbreviation "zł"; what that
 * abbreviation is not is an alias, so this file adds it as one, and "5 zł" —
 * the string on every price tag in the country — parses because of that line.
 *
 * Five currencies get no Polish word at all, for two reasons worth telling
 * apart:
 *
 *   cad, aud — their Polish names are "dolar kanadyjski" and "dolar
 *     australijski", a qualifier plus the head noun `usd` already owns. Two
 *     tokens cannot be one alias, and the qualifier alone is an adjective that
 *     means nothing on its own. `en` omits exactly these two for exactly this
 *     reason.
 *   sek, nok, czk — Polish calls all three "korona", separated only by the same
 *     kind of qualifier ("szwedzka", "norweska", "czeska"). One word for three
 *     units of one kind has no reading at all: no context the engine has would
 *     separate them, so the word is left unclaimed rather than given to
 *     whichever happened to be written first. Unlike German — where "Krone" is
 *     already `nok`'s own generated alias and the collision is decided for us —
 *     nothing in the Latin table spells the Polish word, so leaving it out is an
 *     actual choice.
 *
 * All five keep their ISO codes and the table's Latin aliases, which is what a
 * Polish speaker types for them anyway, and no `forms` — the renderer then falls
 * back to the symbol, which is what a Polish price list prints for a currency it
 * has no word for.
 *
 * Named by **id string**, like `en`: this file links neither the rate machinery
 * nor `Decimal`, so `@smartput/rate/locale/pl` is a translation someone can ship
 * without owning the kind.
 */
const units: Record<string, UnitWords> = {};
for (const [code, generated] of Object.entries(currencyVocabulary("pl").units)) {
  const polish = POLISH[code];
  units[code] = {
    aliases: [...new Set([...generated.aliases, ...(polish?.aliases ?? [])])],
    ...(generated.symbol !== undefined ? { symbol: generated.symbol } : {}),
    ...(polish !== undefined ? { forms: polish.forms } : {}),
  };
}

export default defineVocabulary({ locale: "pl", kind: "money", units });
