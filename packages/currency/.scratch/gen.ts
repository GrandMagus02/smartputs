import { Decimal } from "@smartput/core";
import { formatAmount } from "../src/format";
import { parseAmount } from "../src/parse";

const INPUTS: [string, boolean][] = [
  ["30 usd", false],
  ["30 dollars", false],
  ["1,250.50 dollars", false],
  ["-4 eur", false],
  ["0.05 eur", false],
  ["1200 jpy", false],
  ["1200 yen", false],
  ["100 uah", false],
  ["50 gbp", false],
  ["7.5 chf", false],
  ["30 USD", false],
  ["2.345 usd", false],
  ["1000 kwd", false],
  ["$30", true],
  ["€0.05", true],
  ["30 €", true],
  ["£12.34", true],
  ["-$10", true],
  ["¥1200", true],
  // Refusals. Part of the contract, not the leftovers.
  ["usd 30", false],
  ["30", false],
  ["30 xyz", false],
  ["30 usd each", false],
  ["$30", false],
  ["dollars", false],
];

for (const [input, symbols] of INPUTS) {
  const p = parseAmount(input, { symbols });
  const mode = symbols ? "symbols" : "plain";
  if (!p.ok) {
    console.log(`${input}\t${mode}\t${p.code}\t-\t-\t-`);
    continue;
  }
  const formatted = formatAmount(new Decimal(p.raw), p.currency);
  console.log(`${input}\t${mode}\tok\t${p.currency}\t${p.amount}\t${formatted}`);
}
