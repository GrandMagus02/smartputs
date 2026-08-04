export interface CurrencyDef {
  /** Decimal places at which this currency is displayed. JPY has none. */
  minorUnits: number;
  symbol: string;
  aliases: string[];
}

/**
 * The currencies ECB's daily reference file covers, plus the euro itself.
 * Deliberately not the full ISO 4217 list: a code with no rate behind it can
 * only ever raise MissingRateError, so listing it would promise nothing.
 */
export const CURRENCIES: Record<string, CurrencyDef> = {
  eur: { minorUnits: 2, symbol: "€", aliases: ["eur", "euro", "euros"] },
  usd: { minorUnits: 2, symbol: "$", aliases: ["usd", "dollar", "dollars"] },
  gbp: { minorUnits: 2, symbol: "£", aliases: ["gbp", "pound", "pounds"] },
  jpy: { minorUnits: 0, symbol: "¥", aliases: ["jpy", "yen"] },
  chf: { minorUnits: 2, symbol: "CHF", aliases: ["chf", "franc", "francs"] },
  pln: { minorUnits: 2, symbol: "zł", aliases: ["pln", "zloty"] },
  uah: { minorUnits: 2, symbol: "₴", aliases: ["uah", "hryvnia"] },
  cad: { minorUnits: 2, symbol: "CA$", aliases: ["cad"] },
  aud: { minorUnits: 2, symbol: "A$", aliases: ["aud"] },
  sek: { minorUnits: 2, symbol: "kr", aliases: ["sek"] },
  nok: { minorUnits: 2, symbol: "NOK", aliases: ["nok"] },
  czk: { minorUnits: 2, symbol: "Kč", aliases: ["czk"] },
};
