import { Decimal } from "../decimal";
import type { NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

const THOUSAND = 1_000;

/**
 * One scale word, in both the numbers it takes.
 *
 * `CardinalTables.scales` is a flat `word -> value` map, which is all the
 * *reading* direction needs — "millón" and "millones" are the same multiplier
 * and it does not matter which one was typed. Writing needs to know that they
 * are one word inflected, because Spanish picks between them by the multiplier:
 * "un millón", "dos millones". So the pairing is declared here and `scales` is
 * derived from it below, rather than the two being written out side by side and
 * left to drift.
 *
 * `mil` is invariable — "dos mil", never "dos miles" — so its two columns are
 * the same string. That is a fact about the word, not a placeholder.
 *
 * Spanish is a **long-scale** language: `billón` is 10¹², not 10⁹. The `en`
 * table's `billion: 1_000_000_000` is a different word that merely looks like
 * this one, and translating it across would be the classic false friend. 10⁹
 * has no single word here at all — it is "mil millones", a thousand of the
 * previous scale — which is also the one number this table cannot read back;
 * see the limitation named in `es.test.ts`.
 */
interface ScaleWord {
  readonly value: number;
  /** The form after a multiplier of one, and the stem of the plural. */
  readonly singular: string;
  /** The form after any other multiplier. */
  readonly plural: string;
  /** Read-only spellings: what a keyboard without accents produces. */
  readonly variants?: readonly string[];
}

/**
 * Descending, because `spellSpanish` walks it looking for the largest scale at
 * or below a magnitude and takes the first match. `cardinalNumerals` reads the
 * derived map instead and is indifferent to the order.
 */
const SCALES: readonly ScaleWord[] = [
  {
    value: 1_000_000_000_000,
    singular: "billón",
    plural: "billones",
    variants: ["billon"],
  },
  { value: 1_000_000, singular: "millón", plural: "millones", variants: ["millon"] },
  { value: THOUSAND, singular: "mil", plural: "mil" },
];

const scalesByWord: Record<string, number> = {};
for (const scale of SCALES) {
  for (const word of [scale.singular, scale.plural, ...(scale.variants ?? [])]) {
    scalesByWord[word] = scale.value;
  }
}

/**
 * Spanish cardinals: one table, two directions. `cardinalNumerals` reads it to
 * parse "treinta y uno" back to `31`; `spellSpanish` below reads the same object
 * to spell `31` as "treinta y un". Hoisted into one const, exactly as `en.ts`
 * and `uk-cardinals.ts` do, so the reading and the writing halves cannot drift.
 *
 * Four things English never had to deal with, and this table does:
 *
 * **Fused teens and twenties.** 16–19 and 21–29 are single words in modern
 * orthography — dieciséis, veintiuno — and 31 upwards is three words joined by
 * "y": treinta y uno. So the fused range is declared as `units` entries, exactly
 * the way trece and catorce are, and the composed range falls out of `tens` plus
 * a connector. `cardinalNumerals` merges `units` and `tens` into one flat table
 * of addends with no assumption about their range (its own comment says so), so
 * "veintiuno" is read as one addend and "treinta y uno" as two with a connector
 * between them.
 *
 * **The hundreds are addends, not multiplications.** They sit in `tens` for the
 * reason Ukrainian's do: doscientos is not "dos ciento", and quinientos,
 * setecientos and novecientos are not even built on the units word they descend
 * from (not *cincocientos, not *sietecientos, not *nuevecientos). There is no
 * multiplication to express, so 100–900 are whole values that add. Nothing about
 * a hundred stays in `scales` — unlike Ukrainian's сто, Spanish never multiplies
 * with this word: 100 000 is "cien mil", which is the addend 100 multiplied by
 * the *scale* mil, and reads correctly with `ciento` declared as an addend.
 *
 * **Accents.** dieciséis, veintidós, veintitrés, veintiséis, millón and billón
 * are written with an acute in careful text and without one by everyone typing
 * quickly. `Normalizer` folds NFKC, which leaves a precomposed é as é — it does
 * not strip diacritics — so the bare spellings have to be declared. They are
 * declared *after* the accented form, because both this table's first-word-wins
 * inversion and `cardinalSpeller`'s keep the FIRST word seen for a value, so the
 * spelling a typographer would write is the one that comes back out.
 *
 * **Gender and apocope on the way in.** "un"/"una" are 1 as surely as "uno" is,
 * "veintiún"/"veintiuna" are 21, "cien" is 100 beside "ciento", and the hundreds
 * have a feminine plural (doscientas, quinientas) because they agree with the
 * noun they count: "quinientas millas". Every one of those is an extra key on a
 * value that already has one, always declared after the form `spellSpanish` is
 * meant to produce.
 */
export const CARDINALS: CardinalTables = {
  units: {
    cero: 0,
    // "uno" first so the inversion keeps it; `spellSpanish` apocopates it to
    // "un" itself, at the position where Spanish requires the short form.
    uno: 1,
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    // 16–19 fuse "diez y …" into one word. The seam is invisible in speech and
    // spelled out in the orthography, which is why they belong here and not in
    // any composition rule.
    dieciséis: 16,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    // 21–29 fuse the same way, on the older "veinte y …". 20 itself does not
    // fuse with anything and lives in `tens`, where it composes with nothing —
    // there is no *"veinte y uno" in modern Spanish.
    veintiuno: 21,
    veintiún: 21,
    veintiun: 21,
    veintiuna: 21,
    veintidós: 22,
    veintidos: 22,
    veintitrés: 23,
    veintitres: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiséis: 26,
    veintiseis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,
  },
  tens: {
    veinte: 20,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,
    // "ciento" is the full form and "cien" its apocope, so the full form is
    // declared first and `spellSpanish` shortens it where Spanish does: before a
    // noun or a larger scale ("cien metros", "cien mil"), never before a smaller
    // number ("ciento cinco").
    ciento: 100,
    cien: 100,
    doscientos: 200,
    doscientas: 200,
    trescientos: 300,
    trescientas: 300,
    cuatrocientos: 400,
    cuatrocientas: 400,
    // Not *cincocientos: quinientos is built on the Latin stem and has to be
    // listed, which is half the reason the hundreds are a table at all.
    quinientos: 500,
    quinientas: 500,
    seiscientos: 600,
    seiscientas: 600,
    setecientos: 700,
    setecientas: 700,
    ochocientos: 800,
    ochocientas: 800,
    novecientos: 900,
    novecientas: 900,
  },
  scales: scalesByWord,
  // "y" joins a tens word to a units word — "treinta y uno" — and nothing else:
  // Spanish does not write it between a hundreds word and its remainder
  // ("doscientos cinco", never *"doscientos y cinco"), nor at a scale boundary.
  // It is not claimed by `es.ts`'s `keywords`, so there is no ambiguity to
  // resolve here.
  connectors: ["y"],
};

/**
 * Apocope: the words that lose their ending immediately before the thing they
 * count.
 *
 * Spanish shortens `uno` to `un`, `veintiuno` to `veintiún` and `ciento` to
 * `cien` when the numeral is followed by the noun (or the scale word) it
 * quantifies, and keeps the full form when a smaller numeral follows instead.
 * That is a single rule with three lexical entries, so it is one table read at
 * one position — the last word of a group — rather than three special cases
 * scattered through the speller.
 *
 * The values here are also keys of `CARDINALS.units`/`tens`, so everything this
 * speller can emit is something the parser can read; `es.test.ts` asserts it
 * rather than trusting the eye.
 */
const APOCOPE: Readonly<Record<string, string>> = {
  uno: "un",
  veintiuno: "veintiún",
  ciento: "cien",
};

const firstWordFor = (source: Record<string, number>): Map<number, string> => {
  const table = new Map<number, string>();
  // First word for a value wins, the same rule `cardinalSpeller` uses, so that
  // the accented spelling declared first is the one that comes back.
  for (const [word, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, word);
  }
  return table;
};

const unitsByValue = firstWordFor(CARDINALS.units);
const tensByValue = firstWordFor(CARDINALS.tens);

const wordFor = (n: number): string | undefined =>
  unitsByValue.get(n) ?? tensByValue.get(n);

/** The short form, for the last word of a group. See `APOCOPE`. */
const apocopated = (word: string): string => APOCOPE[word] ?? word;

const spellUnder100 = (n: number): string | null => {
  // 0–29 and every round ten are whole words: "veinticinco" is not composed.
  const direct = wordFor(n);
  if (direct !== undefined) return apocopated(direct);
  const tens = tensByValue.get(Math.floor(n / 10) * 10);
  const rest = unitsByValue.get(n % 10);
  if (tens === undefined || rest === undefined) return null;
  // The only place "y" is written. 31 is "treinta y un" and not "treinta y uno",
  // because the numeral stands immediately before the noun it counts.
  return `${tens} y ${apocopated(rest)}`;
};

const spellUnder1000 = (n: number): string | null => {
  if (n < 100) return spellUnder100(n);
  const hundreds = Math.floor(n / 100) * 100;
  const rest = n - hundreds;
  const head = tensByValue.get(hundreds);
  if (head === undefined) return null;
  // "cien" when the hundreds word is last, "ciento cinco" when it is not — the
  // apocope rule, applied at the only position where it can bite. The other
  // hundreds are unaffected: `apocopated("doscientos")` is "doscientos".
  if (rest === 0) return apocopated(head);
  const tail = spellUnder100(rest);
  return tail === null ? null : `${head} ${tail}`;
};

const ONE = new Decimal(1);
/** Exclusive, mirroring `cardinalSpeller`: above this there is no word to compose. */
const CEILING = new Decimal(SCALES[0]?.value ?? THOUSAND).times(THOUSAND);

const spellInteger = (n: Decimal): string | null => {
  for (const scale of SCALES) {
    const value = new Decimal(scale.value);
    if (n.lt(value)) continue;
    const multiple = n.dividedToIntegerBy(value);
    const rest = n.minus(multiple.times(value));
    let head: string;
    if (multiple.equals(ONE)) {
      // "mil" alone, never *"un mil" — Spanish drops the multiplier on this one
      // scale. "millón" and "billón" are nouns and keep theirs: "un millón".
      head = scale.value === THOUSAND ? scale.singular : `un ${scale.singular}`;
    } else {
      // `multiple` is strictly below `value`, so this recursion always descends.
      const multiplier = spellInteger(multiple);
      if (multiplier === null) return null;
      head = `${multiplier} ${scale.plural}`;
    }
    if (rest.isZero()) return head;
    const tail = spellInteger(rest);
    return tail === null ? null : `${head} ${tail}`;
  }
  return spellUnder1000(n.toNumber());
};

/**
 * The inverse of `cardinalNumerals(CARDINALS)`, hand-written rather than
 * `cardinalSpeller(CARDINALS)`.
 *
 * The shared speller composes a sub-hundred value as `tens + " " + units` and
 * writes its connector only where a *hundred* scale joins a remainder. Spanish
 * needs the mirror image of both: "y" between the tens and the units and nowhere
 * else, and hundreds that are looked up rather than multiplied. Handed
 * `CARDINALS` it writes "treinta uno" for 31 and "dos ciento cinco" for 205 —
 * both readable, both wrong, and the second one only reachable because the
 * hundreds would have had to be moved into `scales` to reach it at all. So this
 * direction is written out; it reads the same `CARDINALS` object the parser
 * does, which is the property that mattered, and the shared helper stays the
 * shape it was written for instead of growing a Spanish branch.
 *
 * Declines the same three cases `cardinalSpeller` declines, for the same
 * reasons: a non-integer (the tables have no fractional grammar), a negative
 * (the AST models a negative quantity as a `UnaryNode` over a non-negative
 * magnitude, so `Printer` never asks), and anything at or above a thousand times
 * the largest declared scale (10¹⁵ here — "mil billones" is the last magnitude
 * with a word, and above it Spanish needs a scale this table does not declare).
 *
 * **What it cannot do, and who does it instead: gender.** The numerals that
 * agree with their noun are written in the masculine here — "un", "veintiún",
 * "doscientos" — because `NumeralSpeller` is handed a magnitude and nothing
 * else, and the noun it will stand in front of is chosen by `Printer` after this
 * returns. That is a fact about this seam and not a limit of the language:
 * `es.ts`'s `renderQuantity` is called with the spelled number and the noun
 * together, and rewrites "un pulgada" to "una pulgada" and "doscientos millas"
 * to "doscientas millas" there. So the masculine this file emits is the
 * *citation* form rather than a default that survives to output, and the
 * agreement costs no change to `NumeralSpeller`'s signature — which is the
 * property that let Spanish add an axis without touching a shared type. Every
 * feminine spelling that rewrite can produce is a declared key of `CARDINALS`
 * below, so the round trip holds in both genders; `es.test.ts` asserts it.
 */
export const spellSpanish: NumeralSpeller = (value) => {
  if (value.isNegative()) return null;
  if (!value.isInteger()) return null;
  if (value.gte(CEILING)) return null;
  return spellInteger(value);
};
