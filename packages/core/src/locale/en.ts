import { defineLocale } from "./define";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

export default defineLocale({
  id: "en",
  numberFormat: "intl",
  analyze: [
    identity(),
    // Regular plurals: metres -> metre, inches -> inche (harmless: no such alias),
    // kilograms -> kilogram. Penalised so an exact alias always wins.
    suffixStripper({ suffixes: ["s", "es"], minStem: 2, weight: -2 }),
    tableAnalyzer({ feet: "foot", inches: "inch" }, -1),
  ],
  keywords: {
    in: ["in", "to", "as"],
    plus: ["plus"],
    minus: ["minus"],
    of: ["of"],
  },
});
