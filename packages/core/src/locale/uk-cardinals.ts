import type { CardinalTables } from "./helpers";

/**
 * Ukrainian cardinals: one table, two directions. `cardinalNumerals` reads it
 * to parse "двадцять два" back to `22`; `cardinalSpeller` reads the same object
 * to spell `22` as "двадцять два". Hoisted into one const, exactly as `en.ts`
 * does, so the reading and the writing halves can never drift apart.
 *
 * Two things English never had to deal with, and this table does:
 *
 * **Apostrophes.** п'ять, дев'ять and дев'яносто are set with U+2019 (’) by
 * anyone typing carefully and with an ASCII apostrophe (') by everyone else.
 * Both spellings are declared, mapping to the same value, because a reader has
 * no way to know which one a user's keyboard produced. The typographic form is
 * declared first so `cardinalSpeller` — which keeps the FIRST word it sees for
 * a value — writes the one a typographer would.
 *
 * **Gender and inflection on the way in.** "дві" is 2 as surely as "два" is
 * (feminine agreement: "дві тонни"), and "тисячі"/"тисяч" are 1000 as surely as
 * "тисяча" is. Those variants are extra keys on the same value, always declared
 * *after* the base masculine nominative, for the same first-word-wins reason.
 *
 * Which leaves a known limitation, named here rather than hidden: the shared
 * `cardinalSpeller` has no inflection machinery, so it composes scale words in
 * their bare nominative singular. `2000` spells as "два тисяча" — readable, and
 * wrong; Ukrainian wants "дві тисячі". Parsing is unaffected (all three forms
 * are declared), and a language that needs agreement on the way out would
 * supply its own `spell` rather than teach the shared helper about gender.
 */
export const CARDINALS: CardinalTables = {
  units: {
    нуль: 0,
    один: 1,
    // Feminine and neuter agreement — "одна тонна", "одне ядро". Extra keys on
    // 1, never the spelling, so `spell` keeps the masculine "один".
    одна: 1,
    одне: 1,
    два: 2,
    дві: 2,
    три: 3,
    чотири: 4,
    "п’ять": 5,
    "п'ять": 5,
    шість: 6,
    сім: 7,
    вісім: 8,
    "дев’ять": 9,
    "дев'ять": 9,
    десять: 10,
    одинадцять: 11,
    дванадцять: 12,
    тринадцять: 13,
    чотирнадцять: 14,
    "п’ятнадцять": 15,
    "п'ятнадцять": 15,
    шістнадцять: 16,
    сімнадцять: 17,
    вісімнадцять: 18,
    "дев’ятнадцять": 19,
    "дев'ятнадцять": 19,
  },
  tens: {
    двадцять: 20,
    тридцять: 30,
    сорок: 40,
    "п’ятдесят": 50,
    "п'ятдесят": 50,
    шістдесят: 60,
    сімдесят: 70,
    вісімдесят: 80,
    "дев’яносто": 90,
    "дев'яносто": 90,
  },
  scales: {
    сто: 100,
    тисяча: 1_000,
    // Nominative plural ("дві тисячі") and genitive plural ("п'ять тисяч") —
    // the forms a Ukrainian sentence actually contains. Reading only.
    тисячі: 1_000,
    тисяч: 1_000,
    мільйон: 1_000_000,
    мільйона: 1_000_000,
    мільйонів: 1_000_000,
    мільярд: 1_000_000_000,
    мільярда: 1_000_000_000,
    мільярдів: 1_000_000_000,
    трильйон: 1_000_000_000_000,
    трильйона: 1_000_000_000_000,
    трильйонів: 1_000_000_000_000,
  },
  // "і"/"та" are numeral connectors, not operators: "сто і п'ять". Neither is
  // claimed by `keywords`, so there is no ambiguity to resolve here.
  connectors: ["і", "та"],
};
