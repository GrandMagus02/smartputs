export interface CurrencyDef {
  /** Decimal places at which this currency is displayed. JPY has none. */
  minorUnits: number;
  symbol: string;
  aliases: string[];
  /**
   * Plural forms, the same shape every core kind's lexicon carries. Money
   * renders through its own format hook, so these are not what `$30.00` is
   * made of — they are what `complete()` inserts ("30 dollars") and what the
   * facade's parser accepts back.
   *
   * Every word here MUST be a single token that resolves back to this
   * currency, i.e. an alias or something the locale's analyzer stems to one:
   * completion's insert text is meant to be handed straight back to
   * `evaluate`. That rules out "Canadian dollar" — the lexer cannot take a
   * two-word unit token — so CAD and AUD declare no display forms and their
   * completions insert the ISO code, which parses. Omission is the honest
   * answer; a word the engine then rejects is not.
   */
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /**
   * The magnitude band people actually type this currency in, read by
   * completion's `scaleFit`. Without it every currency ties at zero and
   * `complete("30 u")` ranks `uah` above `usd` on alphabetical order alone.
   * Bands are per currency because the unit of account is: 30 of something is
   * an ordinary dollar amount and an implausibly small yen one.
   */
  typical: [number, number];
}

/**
 * The currencies ECB's daily reference file covers, plus the euro itself.
 * Deliberately not the full ISO 4217 list: a code with no rate behind it can
 * only ever raise MissingRateError, so listing it would promise nothing.
 */
export const CURRENCIES: Record<string, CurrencyDef> = {
  eur: {
    minorUnits: 2,
    symbol: "€",
    aliases: ["eur", "euro", "euros"],
    display: { one: "euro", other: "euros" },
    typical: [1, 10000],
  },
  usd: {
    minorUnits: 2,
    symbol: "$",
    aliases: ["usd", "dollar", "dollars"],
    display: { one: "dollar", other: "dollars" },
    typical: [1, 10000],
  },
  gbp: {
    minorUnits: 2,
    symbol: "£",
    aliases: ["gbp", "pound", "pounds"],
    display: { one: "pound", other: "pounds" },
    typical: [1, 10000],
  },
  jpy: {
    minorUnits: 0,
    symbol: "¥",
    aliases: ["jpy", "yen"],
    display: { one: "yen", other: "yen" },
    typical: [100, 1000000],
  },
  chf: {
    minorUnits: 2,
    symbol: "CHF",
    aliases: ["chf", "franc", "francs"],
    display: { one: "franc", other: "francs" },
    typical: [1, 10000],
  },
  pln: {
    minorUnits: 2,
    symbol: "zł",
    aliases: ["pln", "zloty"],
    display: { one: "zloty", other: "zlotys" },
    typical: [5, 50000],
  },
  uah: {
    minorUnits: 2,
    symbol: "₴",
    aliases: ["uah", "hryvnia"],
    display: { one: "hryvnia", other: "hryvnias" },
    typical: [50, 500000],
  },
  cad: {
    minorUnits: 2,
    symbol: "CA$",
    aliases: ["cad"],
    typical: [1, 10000],
  },
  aud: {
    minorUnits: 2,
    symbol: "A$",
    aliases: ["aud"],
    typical: [1, 10000],
  },
  sek: {
    minorUnits: 2,
    symbol: "kr",
    // The display words are aliases too, or completion would insert a token
    // the engine cannot read back.
    aliases: ["sek", "krona", "kronor"],
    display: { one: "krona", other: "kronor" },
    typical: [10, 100000],
  },
  nok: {
    minorUnits: 2,
    symbol: "NOK",
    aliases: ["nok", "krone", "kroner"],
    display: { one: "krone", other: "kroner" },
    typical: [10, 100000],
  },
  czk: {
    minorUnits: 2,
    symbol: "Kč",
    aliases: ["czk", "koruna", "korunas"],
    display: { one: "koruna", other: "korunas" },
    typical: [20, 200000],
  },
};
