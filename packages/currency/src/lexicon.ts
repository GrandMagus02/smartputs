import type { Lexicon } from "@smartput/core";
import { CURRENCIES } from "./currencies";

/**
 * The vocabulary half of the `money` kind, built from the shipped table.
 *
 * The core import is type-only and compiles away, so this module is a loop over
 * `CURRENCIES` and nothing else — but the package does reach core at runtime
 * anyway, through `Decimal`: core's `decimal.ts` sets the 28-digit precision as
 * a module-load side effect, and a currency parser holding raw decimal.js would
 * silently run at its ~20-digit default. A shared engine constant is cheaper
 * than a second precision.
 *
 * Split out of `@smartput/rate`'s `money.ts` because it is the half that has
 * nothing to do with rates: aliases, symbol, plural display forms and the
 * magnitude band completion scores against are all facts about a currency, and
 * the same loop would have to be written again by anyone registering a money
 * kind of their own — which is the whole reason it is exported.
 */
export function currencyLexicon(): Lexicon {
  const lexicon: Lexicon = {};
  for (const [code, def] of Object.entries(CURRENCIES)) {
    // The full lexeme shape core's own kinds carry (mass.ts is the reference):
    // aliases and symbol alone leave `display` — what completion inserts — and
    // `typical` — what its scaleFit scores — empty for every currency.
    lexicon[code] = {
      aliases: def.aliases,
      symbol: def.symbol,
      ...(def.display ? { display: def.display } : {}),
      typical: def.typical,
    };
  }
  return lexicon;
}
