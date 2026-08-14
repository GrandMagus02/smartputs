import { Decimal } from "../decimal";
import type { NumeralSpeller } from "../types";
import type { CardinalTables } from "./helpers";

/**
 * Arabic cardinals: one table, two directions — the arrangement `uk-cardinals.ts`
 * and `de-cardinals.ts` both use, and for the same reason. The difference here is
 * which half is shared and which half is Arabic's own.
 *
 * **Reading is the shared `cardinalNumerals`, unchanged.** That helper models a
 * numeral as a run of words that either *add* (`units`, `tens`) or *multiply*
 * (`scales`), and Arabic — unlike German, which fuses everything below a million
 * into one token — genuinely writes its numerals as separate words. So
 * `["خمسة", "وعشرون"]` is two addends and reads as 25 with no new machinery, the
 * same way `["двадцять", "два"]` does.
 *
 * **Writing is Arabic's own**, and there are two independent reasons the shared
 * `cardinalSpeller` cannot do it:
 *
 * - **Units come before tens.** Arabic says خمسة وعشرون — "five and twenty" —
 *   where `cardinalSpeller` composes `${tens} ${units}` and would write
 *   عشرون خمسة, which is not a number in this language. German has the same
 *   inversion and reached the same conclusion.
 * - **The conjunction is a prefix, not a word.** Arabic never writes و detached:
 *   the و that joins 5 to 20 is glued to عشرون, producing the single token
 *   وعشرون. There is no slot in `CardinalTables` for "a connector that is part
 *   of the next word", and the shared speller joins with spaces alone.
 *
 * That second point is also why `connectors` is deliberately **not** declared
 * below. `cardinalNumerals` accepts a connector anywhere a claim is already
 * open, so declaring "و" would teach the parser a spelling Arabic does not have
 * — and it would cost something real: "خمسة و ثلاثة" (five and three, two
 * quantities in a list) would silently claim all three words and answer 8. The
 * glued form needs no connector at all, because it is a table entry. This is
 * exactly the decision `de-cardinals.ts` documents about "und".
 *
 * **The و-prefixed forms are generated, not typed** — see `withWaw`. Every
 * addend the speller can emit in non-initial position must also be an alias the
 * parser reads (otherwise the round trip in `ar.test.ts` fails on the first
 * two-part number), and generating them is what makes that true by construction
 * instead of by vigilance over three hundred hand-typed keys.
 *
 * **Hamza spellings are declared in pairs.** أربعة and اربعة are the same word;
 * the hamza over the alif is written by anyone typing carefully and dropped by
 * everyone else, exactly as Ukrainian's apostrophe is typed three ways. The
 * spelling *with* the hamza is always declared first, because the speller keeps
 * the first word it sees for a value and should write the careful form. Note
 * that `ar.ts`'s orthographic analyzer does not help here: it folds the surfaces
 * that reach the *alias index*, and a numeral never gets that far — `numerals`
 * is offered the raw word run.
 */

/** First word for a value wins, so a value with several spellings spells one way. */
const byValue = (table: Record<string, number>): Map<number, string> => {
  const out = new Map<number, string>();
  for (const [word, value] of Object.entries(table)) {
    if (!out.has(value)) out.set(value, word);
  }
  return out;
};

/**
 * Every entry, plus the same entry with the conjunction و glued to its front.
 *
 * Arabic joins the parts of a number with و and writes it as a prefix, so 25 is
 * خمسة وعشرون and 105 is مئة وخمسة: the *second* part of every pair carries the
 * conjunction inside the word. The parser sees one token, so وعشرون has to be a
 * key in its own right — and since the speller builds that token by prefixing,
 * generating the keys here is what keeps the two halves from disagreeing about
 * which forms exist.
 *
 * An existing key is never overwritten. واحد (1) is already an entry and is also
 * what و + احد generates; both mean 1, and the guard keeps the declared order —
 * and therefore the speller's choice — untouched.
 */
const withWaw = (table: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = { ...table };
  for (const [word, value] of Object.entries(table)) {
    const joined = `و${word}`;
    if (out[joined] === undefined) out[joined] = value;
  }
  return out;
};

/**
 * 0–10, and the two irregular forms 1 and 2 take inside a teen.
 *
 * Arabic numerals 3–10 show **polarity**: the numeral carries the feminine ـة
 * when the counted noun is masculine, and drops it when the noun is feminine.
 * ثلاثة كيلوغرامات (masculine كيلوغرام) against ثلاث ثوانٍ (feminine ثانية) is
 * one number with two written forms, so both are declared. The ـة form is
 * declared first because most unit nouns in this repo's kinds are masculine
 * (كيلوغرام، متر، لتر، غرام), which fixes what the speller writes; see
 * `arabicSpeller`'s own note on the limitation that leaves behind.
 *
 * عشر and عشرة are both 10: عشرة stands alone, عشر is the form inside a teen
 * (أحد عشر). Declaring both costs nothing on the way in, and the speller reaches
 * for the right one through `TEEN_TEN` rather than through this table's order.
 */
const UNITS: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  واحدة: 1,
  // The form 1 takes inside a teen — أحد عشر, never واحد عشر — with its
  // hamza-less spelling and its feminine إحدى beside it.
  أحد: 1,
  احد: 1,
  إحدى: 1,
  احدى: 1,
  اثنان: 2,
  // Arabic's dual declines: اثنان is nominative, اثنين accusative/genitive, and
  // both are written constantly. اثنتان/اثنتين are their feminine counterparts,
  // and اثنا/اثني is the form inside a teen (اثنا عشر).
  اثنين: 2,
  اثنتان: 2,
  اثنتين: 2,
  اثنا: 2,
  اثني: 2,
  ثلاثة: 3,
  ثلاث: 3,
  أربعة: 4,
  اربعة: 4,
  أربع: 4,
  اربع: 4,
  خمسة: 5,
  خمس: 5,
  ستة: 6,
  ست: 6,
  سبعة: 7,
  سبع: 7,
  ثمانية: 8,
  ثماني: 8,
  ثمان: 8,
  تسعة: 9,
  تسع: 9,
  عشرة: 10,
  عشر: 10,
};

/**
 * The addends above 10: the tens 20–90, the hundreds 200–900, and the duals of
 * the scale nouns.
 *
 * **The hundreds are addends and not multiplications**, for the same reason
 * Ukrainian's двісті and п'ятсот are: ثلاثمئة is one fused word, not the two
 * words ثلاث and مئة standing in a multiplier relationship. Both spellings of
 * every one of them are declared, because مئة and مائة are the same word with
 * two orthographies in equally current use (the second writes an alif that is
 * not pronounced) and a reader has no way to know which one a keyboard produced.
 * Only مئة itself stays in `SCALES`, where it belongs: it genuinely multiplies,
 * in مئة ألف.
 *
 * **Every tens word is declared twice**, and this is grammar rather than
 * orthography: عشرون is nominative and عشرين is the accusative/genitive, and the
 * oblique form is what appears after a preposition — which is most of the time.
 *
 * **The duals of the scale nouns live here** — ألفان is 2000, مليونان is two
 * million — because they are single fused words with no multiplier to extract,
 * the same argument the hundreds make. `ar.test.ts` asserts each one against the
 * `ARABIC_SCALES` row it doubles, so the two structures cannot drift.
 */
const TENS: Record<string, number> = {
  عشرون: 20,
  عشرين: 20,
  ثلاثون: 30,
  ثلاثين: 30,
  أربعون: 40,
  أربعين: 40,
  اربعون: 40,
  اربعين: 40,
  خمسون: 50,
  خمسين: 50,
  ستون: 60,
  ستين: 60,
  سبعون: 70,
  سبعين: 70,
  ثمانون: 80,
  ثمانين: 80,
  تسعون: 90,
  تسعين: 90,
  مئتان: 200,
  مئتين: 200,
  مائتان: 200,
  مائتين: 200,
  ثلاثمئة: 300,
  ثلاثمائة: 300,
  أربعمئة: 400,
  أربعمائة: 400,
  اربعمئة: 400,
  اربعمائة: 400,
  خمسمئة: 500,
  خمسمائة: 500,
  ستمئة: 600,
  ستمائة: 600,
  سبعمئة: 700,
  سبعمائة: 700,
  ثمانمئة: 800,
  ثمانمائة: 800,
  ثمانيمئة: 800,
  تسعمئة: 900,
  تسعمائة: 900,
  ألفان: 2_000,
  ألفين: 2_000,
  الفان: 2_000,
  الفين: 2_000,
  مليونان: 2_000_000,
  مليونين: 2_000_000,
  ملياران: 2_000_000_000,
  مليارين: 2_000_000_000,
  تريليونان: 2_000_000_000_000,
  تريليونين: 2_000_000_000_000,
};

/**
 * The multiplying words. مئة multiplies only upwards (مئة ألف); the rest
 * multiply whatever numeral precedes them.
 *
 * Each scale noun is declared in its singular *and* its plural, because Arabic
 * counts them differently at different magnitudes: ألف after a multiplier of one
 * or of eleven and up, آلاف after three to ten. Both are the same value, and the
 * speller picks between them through `ARABIC_SCALES` rather than through this
 * table's order.
 *
 * **بليون is deliberately absent.** It is used for 10⁹ by most writers and for
 * 10¹² by some, so reading it either way is a guess about the author rather than
 * about the language — and مليار says 10⁹ with no ambiguity at all. This is the
 * same hazard `de-cardinals.ts` names around the long scale, answered by
 * declining the ambiguous word instead of by picking a side.
 */
const SCALES: Record<string, number> = {
  مئة: 100,
  مائة: 100,
  ألف: 1_000,
  الف: 1_000,
  // The plural, used after multipliers 3–10: ثلاثة آلاف. آ is a single
  // codepoint (U+0622 alif with madda); the two-letter spellings beside it are
  // what a keyboard without it produces.
  آلاف: 1_000,
  الاف: 1_000,
  ألاف: 1_000,
  مليون: 1_000_000,
  ملايين: 1_000_000,
  مليار: 1_000_000_000,
  مليارات: 1_000_000_000,
  تريليون: 1_000_000_000_000,
  تريليونات: 1_000_000_000_000,
  ترليون: 1_000_000_000_000,
};

/**
 * The scale nouns as the speller needs them: which word to write for a
 * multiplier of one, of two, of three to ten, and of eleven and up.
 *
 * Arabic changes the *noun* rather than the numeral as the count rises — one is
 * the bare ألف with no multiplier written at all, two is the fused dual ألفان
 * with no multiplier either, three to ten take the plural آلاف, and eleven and
 * up return to the singular. Four forms of one word, chosen by the magnitude of
 * the thing counting it, which is the same phenomenon `Language.selectForm`
 * describes for unit nouns and the reason Arabic needs six plural categories
 * where English needs two.
 *
 * Every word here is also a key in `SCALES` or `TENS` above, so everything the
 * speller writes is something the parser reads. That is asserted in
 * `ar.test.ts`, not left to a reader's trust.
 */
export interface ArabicScale {
  /** After a multiplier of one, and after eleven and up: ألف. */
  readonly singular: string;
  /** The fused dual, which *is* two thousand and takes no multiplier: ألفان. */
  readonly dual: string;
  /** After multipliers three to ten: ثلاثة آلاف. */
  readonly plural: string;
  readonly value: number;
}

export const ARABIC_SCALES: readonly ArabicScale[] = [
  { singular: "ألف", dual: "ألفان", plural: "آلاف", value: 1_000 },
  { singular: "مليون", dual: "مليونان", plural: "ملايين", value: 1_000_000 },
  { singular: "مليار", dual: "ملياران", plural: "مليارات", value: 1_000_000_000 },
  {
    singular: "تريليون",
    dual: "تريليونان",
    plural: "تريليونات",
    value: 1_000_000_000_000,
  },
];

/**
 * What `cardinalNumerals` reads. The و-prefixed forms are generated onto every
 * addend and every scale word, because the conjunction can land in front of any
 * of them: خمسة وعشرون joins two addends, ألف ومئة joins an addend to a scale,
 * and مليون وألف joins two scales.
 */
export const CARDINALS: CardinalTables = {
  units: withWaw(UNITS),
  tens: withWaw(TENS),
  scales: withWaw(SCALES),
};

const UNITS_BY_VALUE = byValue(UNITS);
const TENS_BY_VALUE = byValue(TENS);
const HUNDRED = byValue(SCALES).get(100) as string;

/**
 * The form 10 takes as the second half of a teen: أحد عشر, ثلاثة عشر — not
 * عشرة, which is 10 standing on its own. Declared in `UNITS` so it reads back;
 * named here so the speller can reach it past عشرة, which `byValue` picks for 10.
 */
const TEEN_TEN = "عشر";

/**
 * The forms 1 and 2 take as the *first* half of a teen. Both are irregular —
 * أحد عشر is not واحد عشر and اثنا عشر is not اثنان عشر — and both are declared
 * in `UNITS`, so this map only chooses between spellings the parser already
 * accepts.
 */
const TEEN_ONES = new Map<number, string>([
  [1, "أحد"],
  [2, "اثنا"],
]);

/** Units before tens, joined by a prefixed و: 25 is خمسة وعشرون. */
function spellUnder100(n: number): string | null {
  const direct = UNITS_BY_VALUE.get(n) ?? TENS_BY_VALUE.get(n);
  if (direct !== undefined) return direct;

  if (n < 20) {
    const ones = TEEN_ONES.get(n - 10) ?? UNITS_BY_VALUE.get(n - 10);
    return ones === undefined ? null : `${ones} ${TEEN_TEN}`;
  }

  const tensWord = TENS_BY_VALUE.get(Math.floor(n / 10) * 10);
  const onesWord = UNITS_BY_VALUE.get(n % 10);
  if (tensWord === undefined || onesWord === undefined) return null;
  return `${onesWord} و${tensWord}`;
}

/**
 * The hundreds are looked up whole rather than composed, because Arabic fuses
 * them: 300 is the single word ثلاثمئة, and only 100 itself is the free مئة.
 * The remainder is joined with a prefixed و, and since `spellUnder100` already
 * puts its own و in the right place, 125 comes out as مئة وخمسة وعشرون with the
 * conjunction on both joins — which is how Arabic writes it.
 */
function spellUnder1000(n: number): string | null {
  if (n < 100) return spellUnder100(n);
  const hundreds = Math.floor(n / 100) * 100;
  const head = hundreds === 100 ? HUNDRED : TENS_BY_VALUE.get(hundreds);
  if (head === undefined) return null;
  const rest = n % 100;
  if (rest === 0) return head;
  const tail = spellUnder100(rest);
  return tail === null ? null : `${head} و${tail}`;
}

const THOUSAND = new Decimal(1000);
const BIGGEST = ARABIC_SCALES[ARABIC_SCALES.length - 1];
/** Exclusive, and the same reasoning `cardinalSpeller` gives for its own. */
const CEILING = new Decimal(BIGGEST?.value ?? 1).times(THOUSAND);
// Descending, so the largest scale at or below a magnitude is the first match.
const DESCENDING = [...ARABIC_SCALES].sort((a, b) => b.value - a.value);

function spellScales(n: Decimal): string | null {
  for (const scale of DESCENDING) {
    if (n.lt(scale.value)) continue;
    const multiple = n.dividedToIntegerBy(scale.value);
    const remainder = n.minus(multiple.times(scale.value));
    const m = multiple.toNumber();

    // The four cases `ArabicScale` exists for. Note that one and two write no
    // multiplier at all: ألف *is* one thousand and ألفان *is* two thousand, so
    // "واحد ألف" and "اثنان ألف" are not Arabic, they are English with Arabic
    // words in it.
    let head: string | null;
    if (m === 1) head = scale.singular;
    else if (m === 2) head = scale.dual;
    else if (m <= 10) {
      const count = UNITS_BY_VALUE.get(m);
      head = count === undefined ? null : `${count} ${scale.plural}`;
    } else {
      const count = spellUnder1000(m);
      head = count === null ? null : `${count} ${scale.singular}`;
    }
    if (head === null) return null;

    if (remainder.isZero()) return head;
    const tail = spellScales(remainder);
    return tail === null ? null : `${head} و${tail}`;
  }
  return spellUnder1000(n.toNumber());
}

/**
 * The inverse of `cardinalNumerals(CARDINALS)`, over the same tables. Declines
 * on the same three cases `cardinalSpeller` declines on, for the reasons it
 * documents at length: a non-integer (these tables have no fractional grammar),
 * a negative magnitude (the AST models a sign as a `UnaryNode`, never as part of
 * the number), and anything at or above 1000 × the largest declared scale.
 *
 * **Two limitations, named rather than hidden**, both of which cost correct
 * *agreement* and never cost the round trip — every form below reads back as the
 * number it was spelled from, which is what `ar.test.ts` pins:
 *
 * - **Gender polarity is not applied.** The speller writes the ـة forms
 *   (ثلاثة، خمسة), which agree with a masculine counted noun — كيلوغرام، متر،
 *   لتر، غرام, which is most of what this engine counts. A feminine unit noun
 *   (ثانية، دقيقة، ساعة) wants the bare ثلاث، خمس, and gets the masculine form
 *   here. Fixing it means telling `NumeralSpeller` which noun it is spelling
 *   for, and its signature is `(value) => string | null`: the number is spelled
 *   before anything has decided what it counts.
 * - **The tamyīz accusative is not written.** After a multiplier of 11–99 the
 *   counted noun goes into the accusative singular with tanwīn — أحد عشر ألفًا,
 *   not أحد عشر ألف — and this writes the bare singular. It is the same
 *   distinction `selectForm`'s `many` category carries for unit nouns, one level
 *   up, and the reason it is dropped here rather than there is that the ending
 *   would have to survive the parser: ألفًا is a form the tables would then need
 *   to read back, and it is not one anybody types into a search box.
 */
export function arabicSpeller(): NumeralSpeller {
  return (value) => {
    if (value.isNegative()) return null;
    if (!value.isInteger()) return null;
    if (value.gte(CEILING)) return null;
    if (value.isZero()) return UNITS_BY_VALUE.get(0) ?? null;
    return spellScales(value);
  };
}
