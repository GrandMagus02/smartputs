import { Decimal } from "../decimal";
import type { NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * Portuguese cardinals: one table, two directions, exactly as `uk-cardinals.ts`
 * is. `cardinalNumerals` reads it to parse "vinte e dois" back to `22`, and
 * `spellPortuguese` — declared at the bottom of this same file — reads the same
 * object to spell `22` as "vinte e dois". Neither half owns a word the other
 * cannot see.
 *
 * Brazilian by default, per this project's ruling on the bare `pt` tag: where
 * the two standards spell a numeral differently the Brazilian form is declared
 * **first** (so `spellPortuguese`, which keeps the first word it finds for a
 * value, writes it) and the European form is declared beside it as a second key
 * on the same value, because a reader in Lisbon must still be understood.
 *
 * Three things English never had to deal with, and this table does:
 *
 * **Diacritics.** "três", "milhão" and "milhões" are how the words are written
 * and "tres", "milhao" and "milhoes" are how they arrive from a keyboard with
 * no dead keys — an ASCII spelling is not a misspelling in Portuguese input, it
 * is the ordinary state of a search box. Both are declared, mapping to the same
 * value, on the same reasoning `uk-cardinals.ts` gives for its two apostrophes.
 * The accented form is declared first, so the speller writes the one a
 * typographer would.
 *
 * **Gender.** "um"/"uma", "dois"/"duas" and every hundred from 200 up
 * ("duzentos"/"duzentas") agree with the noun they count: "dois quilogramas",
 * "duas toneladas". Both genders parse; the masculine is declared first and is
 * therefore the only one *this file* spells, because `spellPortuguese` composes
 * words and is never shown the noun — it is handed a magnitude and nothing else,
 * exactly as Ukrainian records.
 *
 * That is a limitation of the speller, not of the language, and it is repaired
 * one layer up: `pt.ts`'s `renderQuantity` is the only call that sees the spelled
 * numeral and the unit's noun at the same time, and it rewrites "dois" to "duas"
 * there. Which is precisely why the feminine keys below have to exist — a
 * numeral the renderer can write must be one this table can read back, the same
 * rule that governs a unit's printed forms.
 *
 * **The hundreds are not compositional.** 200 is "duzentos", not "dois cem";
 * 500 is "quinhentos", whose first half is no longer a free numeral. So they
 * live in `tens` — the table `cardinalNumerals` merges into its flat map of
 * *addends* — rather than in `scales`, which is for words that multiply. This
 * is the arrangement `uk-cardinals.ts` arrived at for двісті/триста and it is
 * the honest shape for the same reason: there is no multiplication to express.
 *
 * 100 itself is two words with one value and they are not interchangeable:
 * "cem" stands alone, "cento" is the form that carries a remainder ("cento e
 * cinco"). Both are declared here for reading; which of the two is *written* is
 * a fact the flat value→word map cannot express, so `COMBINING_HUNDRED` names
 * it below.
 */
export const CARDINALS: CardinalTables = {
  units: {
    zero: 0,
    um: 1,
    // Feminine agreement — "uma tonelada". An extra key on 1, never the
    // spelling, so `spellPortuguese` keeps the masculine "um".
    uma: 1,
    dois: 2,
    duas: 2,
    três: 3,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    // Brazil writes "quatorze" and Portugal "catorze"; both are in the
    // Brazilian dictionaries too, so this is a preference and not a border.
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    // The 16/17/19 trio is the one place the two standards differ by a vowel:
    // Brazil doubles the s and writes "dezesseis", Portugal writes
    // "dezasseis". Brazilian first, per the `pt` ruling.
    dezesseis: 16,
    dezasseis: 16,
    dezessete: 17,
    dezassete: 17,
    dezoito: 18,
    dezenove: 19,
    dezanove: 19,
  },
  tens: {
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    // 100–900. Addends, not multipliers — see the doc comment above.
    cem: 100,
    // The combining form: "cento e um", never "cem e um". Declared second so
    // the speller writes "cem" for a bare 100 and reaches for this one only
    // through `COMBINING_HUNDRED`.
    cento: 100,
    duzentos: 200,
    duzentas: 200,
    trezentos: 300,
    trezentas: 300,
    quatrocentos: 400,
    quatrocentas: 400,
    quinhentos: 500,
    quinhentas: 500,
    seiscentos: 600,
    seiscentas: 600,
    setecentos: 700,
    setecentas: 700,
    oitocentos: 800,
    oitocentas: 800,
    novecentos: 900,
    novecentas: 900,
  },
  scales: {
    mil: 1_000,
    // Portuguese is short-scale in Brazil: "bilhão" is 10^9, not the 10^12 of
    // the long scale European Portuguese also uses in some registers. The
    // Brazilian reading is the one this file takes, and it is the reading every
    // Brazilian financial page prints.
    //
    // The plural of each is a second key on the same value, because "dois
    // milhões" is how the number is actually written; `SCALE_PLURALS` below is
    // what lets the speller reach it, since a value→word map can only hold one.
    milhão: 1_000_000,
    milhao: 1_000_000,
    milhões: 1_000_000,
    milhoes: 1_000_000,
    bilhão: 1_000_000_000,
    bilhao: 1_000_000_000,
    bilhões: 1_000_000_000,
    bilhoes: 1_000_000_000,
    trilhão: 1_000_000_000_000,
    trilhao: 1_000_000_000_000,
    trilhões: 1_000_000_000_000,
    trilhoes: 1_000_000_000_000,
  },
  // "e" is a numeral connector in Portuguese and nothing else here claims it:
  // `pt.ts` spells addition "mais", so there is no ambiguity to resolve. Unlike
  // English's "and", which is optional decoration, this one is grammatically
  // required between the parts of a number — "cento e cinco", never "cento
  // cinco" — which is why `spellPortuguese` emits it rather than only tolerating
  // it on the way in.
  connectors: ["e"],
};

/**
 * The form of 100 that carries a remainder. "cem" is the whole hundred and
 * refuses to be followed: 100 is "cem", 105 is "cento e cinco", 155 is "cento e
 * cinquenta e cinco". Both words are keys of `CARDINALS.tens` above, so this
 * spelling reads back; `pt.test.ts` asserts that rather than trusting it.
 */
export const COMBINING_HUNDRED = "cento";

/**
 * The scale words that agree in number, keyed by the singular this table
 * declares first. "mil" is absent on purpose: it is invariable, so two thousand
 * is "dois mil" and never "dois mis" — the -l → -is plural class Portuguese
 * applies to ordinary nouns does not reach the numeral.
 *
 * Every value here is also a key of `CARDINALS.scales`, which is what makes a
 * spelled million readable again.
 */
export const SCALE_PLURALS: Readonly<Record<string, string>> = {
  milhão: "milhões",
  bilhão: "bilhões",
  trilhão: "trilhões",
};

/**
 * The scale words that stand alone at one. Portuguese says "mil", never "um
 * mil", while "milhão" is a noun and takes its numeral: "um milhão". Nothing
 * about a scale's value predicts which of the two it is, so the distinction is
 * declared rather than derived.
 */
export const BARE_AT_ONE: readonly string[] = ["mil"];

// --- Portuguese's own speller, over the table above ---------------------
//
// Everything from here to the end of the file exists to build
// `spellPortuguese`, which is declared last.
//
// `cardinalSpeller` is not used, and this is the first language in the repo
// that had to say so. That helper composes with spaces and inserts its
// connector at exactly one place — between a `hundred` *scale* word and a
// sub-100 remainder — which is a description of English and of nothing else.
// Portuguese needs three things it cannot do:
//
//   1. "e" everywhere inside a group. "duzentos e vinte e cinco" carries the
//      conjunction twice; the shared speller writes "duzentos vinte cinco".
//   2. A combining hundred. With "cem" in `scales` the shared speller writes
//      155 as "um cem e cinquenta" — it spells the multiplier of every scale —
//      and with "cem" as an addend it writes "cem cinquenta". Portuguese writes
//      "cento e cinquenta e cinco", and no arrangement of the four tables
//      produces it.
//   3. Agreement on the scale word. "dois milhões", not "dois milhão".
//
// What is *not* forked is the vocabulary: every word written below is read out
// of `CARDINALS`, plus the two exception tables above, both of whose values are
// keys of `CARDINALS` and are asserted to be. So the property `CardinalTables`
// exists to protect — one table, two directions, unable to drift — survives
// intact. It is the composition rule that is Portuguese's own, not the words.
//
// The three refusals are `cardinalSpeller`'s, for the reasons it gives: a
// non-integer (the tables have no fractional grammar), a negative magnitude
// (this engine models a negative quantity as a unary node over a non-negative
// one, so nothing ever asks), and a value at or above 1000 times the largest
// declared scale (there is no word left to compose from).

const CONNECTOR = CARDINALS.connectors?.[0] ?? "e";

/** First word declared for a value wins, exactly as `cardinalSpeller` does. */
const wordFor = (source: Record<string, number>): Map<number, string> => {
  const table = new Map<number, string>();
  for (const [word, value] of Object.entries(source)) {
    if (!table.has(value)) table.set(value, word);
  }
  return table;
};

const unitsByValue = wordFor(CARDINALS.units);
/** 20–90 and 100–900 together: both are addends, and both index by value. */
const tensByValue = wordFor(CARDINALS.tens);

/** Largest first, so the biggest scale at or below a magnitude matches first. */
const scaleSteps = [...wordFor(CARDINALS.scales)]
  .sort(([a], [b]) => b - a)
  .map(([value, word]) => ({
    value,
    word,
    plural: SCALE_PLURALS[word] ?? word,
    bareAtOne: BARE_AT_ONE.includes(word),
  }));

const THOUSAND = new Decimal(1000);
/** Exclusive: above this there is no scale word left to multiply. */
const CEILING = new Decimal(scaleSteps[0]?.value ?? 100).times(THOUSAND);

const spellUnderHundred = (n: number): string | null => {
  const direct = unitsByValue.get(n);
  if (direct !== undefined) return direct;
  const tens = Math.floor(n / 10) * 10;
  const tensWord = tensByValue.get(tens);
  if (tensWord === undefined) return null;
  const rest = n - tens;
  if (rest === 0) return tensWord;
  const unitWord = unitsByValue.get(rest);
  return unitWord === undefined ? null : `${tensWord} ${CONNECTOR} ${unitWord}`;
};

const spellUnderThousand = (n: number): string | null => {
  if (n < 100) return spellUnderHundred(n);
  const hundreds = Math.floor(n / 100) * 100;
  const rest = n - hundreds;
  // A whole hundred is one word, and for 100 that word is "cem".
  if (rest === 0) return tensByValue.get(hundreds) ?? null;
  const head = hundreds === 100 ? COMBINING_HUNDRED : tensByValue.get(hundreds);
  if (head === undefined) return null;
  const tail = spellUnderHundred(rest);
  return tail === null ? null : `${head} ${CONNECTOR} ${tail}`;
};

/** The three-digit groups of a magnitude, least significant first. */
const classesOf = (n: Decimal): number[] => {
  const digits = n.toFixed(0);
  const out: number[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    out.push(Number(digits.slice(Math.max(0, end - 3), end)));
  }
  return out;
};

/**
 * What joins a scale word to what follows it.
 *
 * Portuguese puts "e" between two classes only when the tail is a *single*
 * remaining class that is itself either below one hundred or a whole number of
 * hundreds: "mil e quinhentos", "mil e cinco", "um milhão e duzentos mil" —
 * against "dois mil trezentos e quarenta e cinco" and "um milhão duzentos e
 * trinta e quatro mil quinhentos e sessenta e sete", where the tail is a number
 * in its own right and the conjunction would be wrong.
 *
 * Stated as "the last class decides" rather than "the remainder decides",
 * because 1.234.000 has a remainder that is a multiple of 100 and still takes
 * no conjunction: its tail is two classes wide.
 */
const joiner = (rest: Decimal): string => {
  const nonZero = classesOf(rest).filter((c) => c !== 0);
  if (nonZero.length !== 1) return " ";
  const only = nonZero[0] as number;
  return only < 100 || only % 100 === 0 ? ` ${CONNECTOR} ` : " ";
};

const spellGroups = (n: Decimal): string | null => {
  for (const scale of scaleSteps) {
    const value = new Decimal(scale.value);
    if (n.lt(value)) continue;
    const multiple = n.dividedToIntegerBy(value);
    const rest = n.minus(multiple.times(value));
    // Below 1000 by construction: the loop takes the largest scale first, and
    // `CEILING` refuses anything that would overflow the largest one.
    const count = multiple.toNumber();
    let head: string;
    if (count === 1 && scale.bareAtOne) {
      head = scale.word;
    } else {
      const multiplier = spellUnderThousand(count);
      if (multiplier === null) return null;
      head = `${multiplier} ${count === 1 ? scale.word : scale.plural}`;
    }
    if (rest.isZero()) return head;
    const tail = spellGroups(rest);
    return tail === null ? null : `${head}${joiner(rest)}${tail}`;
  }
  return spellUnderThousand(n.toNumber());
};

/** 22 → "vinte e dois". The inverse of `cardinalNumerals(CARDINALS)`. */
export const spellPortuguese: NumeralSpeller = (value) => {
  if (value.isNegative()) return null;
  if (!value.isInteger()) return null;
  if (value.gte(CEILING)) return null;
  return spellGroups(value);
};
