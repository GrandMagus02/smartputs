/**
 * Regenerates `packages/rate/corpus/uk.tsv`. Same rule as
 * `packages/kinds/.scratch/gen-uk.ts`: hand-written inputs, generated answer
 * columns, every row read before it landed.
 *
 * ```sh
 * bun run packages/rate/.scratch/gen-uk.ts
 * ```
 */
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { number } from "@smartput/number";
import { money } from "../src/money";
import { snapshot } from "../src/snapshot";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });
const engine = createEngine({
  locales: [composeLocale(uk)],
  kinds: [number, money],
  rates,
});

const LINES: string[] = [
  "# input\tkind\tcanonical\tformatted",
  "30 usd",
  "30 usd - 10 eur",
  "100 usd в uah",
  "5 eur + 5 eur",
  "-10 usd",
  "10 usd в eur",
  "10 eur * 3",
  "100 eur / 4",
  "(1 usd / 3) * 3",
  "50 uah + 50 uah",
  "100 uah в usd",
  "# What this file adds over `en.tsv`, and the reason it is worth having: the",
  "# ISO codes are the same in every language, so the *input* half of a money",
  "# corpus barely moves — and the output half moves entirely. Ukrainian writes",
  '# the decimal comma and groups with U+00A0, so "₴1 000,00" is the same',
  '# amount English prints as "₴1,000.00" and the two strings share no',
  "# separator. A currency symbol is not a translation and stays put.",
  "1 000 uah",
  "1,5 eur",
  "1 000 000 uah в eur",
  "# No vocabulary is composed into this engine at all — `composeLocale(uk)`",
  "# with nothing after it — so every code above is reached through the kind's",
  "# own unit keys. That is the same claim `en.tsv` makes, and it is what says",
  "# the money kind is language-free: `грн` is not readable here, and adding it",
  "# would be `@smartput/rate/locale/uk`'s job rather than the table's.",
  "45,5 uah в eur",
];

const out: string[] = [];
for (const line of LINES) {
  if (line.startsWith("#")) {
    out.push(line);
    continue;
  }
  const r = engine.evaluate(line);
  out.push([line, r.kind, r.value.canonical.toString(), r.formatted].join("\t"));
}
await Bun.write(new URL("../corpus/uk.tsv", import.meta.url), `${out.join("\n")}\n`);
