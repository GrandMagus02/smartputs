import { defineLanguage } from "./define";
import {
  type CardinalTables,
  cardinalNumerals,
  cardinalSpeller,
  identity,
  suffixStripper,
} from "./helpers";

// One table, two directions: `cardinalNumerals` reads it to parse "thirty"
// back to `30`, `cardinalSpeller` reads it to spell `30` as "thirty". Hoisted
// so the two can never drift apart the way two separately-maintained copies
// eventually would.
const CARDINALS: CardinalTables = {
  units: {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  },
  tens: {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  },
  scales: {
    hundred: 100,
    thousand: 1_000,
    million: 1_000_000,
    billion: 1_000_000_000,
    trillion: 1_000_000_000_000,
  },
  // "and" is a numeral connector, not an operator. A locale cannot have it
  // both ways, and "two hundred and five" is the commoner input.
  connectors: ["and"],
};

const plural = new Intl.PluralRules("en");

export default defineLanguage({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    // Regular plurals: metres -> metre, inches -> inche (harmless: no such alias),
    // kilograms -> kilogram. Penalised so an exact alias always wins.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
  ],
  numerals: cardinalNumerals(CARDINALS),
  spell: cardinalSpeller(CARDINALS),
  keywords: {
    in: ["in", "to", "as"],
    of: ["of"],
    // Only "off" spells this. "discount" and "less" were considered and left
    // out: "less" is already a comparative in ordinary English input, and a
    // second surface word for an operator that reads as a preposition is how
    // a locale starts claiming words it has no business claiming.
    off: ["off"],
    plus: ["plus"],
    minus: ["minus"],
    times: ["times", "multiplied"],
    over: ["over", "divided"],
    by: ["by"],
  },
  // "one" | "other" — so every `display` table in the repo becomes a `forms`
  // table with no edit beyond the field name.
  selectForm: ({ count }) =>
    count === undefined ? "other" : plural.select(count.toNumber()),
});
