import { Decimal } from "../decimal";

/** An alias the user has finished typing. */
export const EXACT_BONUS = 10;
/** Charged once per character the user has not typed yet. */
export const LENGTH_PENALTY = 1;
/** The typed count falls inside the unit's declared `typical` band. */
export const SCALE_BONUS = 3;
/**
 * Charged once per edit between the fragment and the alias it was read as.
 *
 * Priced against the span the three constants above cover rather than against
 * a contest, because there is no contest to win: a corrected offer only exists
 * when the prefix pass came back empty, so it never meets a prefix offer in one
 * list. What the number has to hold is the comparison the user makes across two
 * keystrokes: "1 kilogr" is a prefix two characters short of its alias, "1
 * klogram" is that alias misspelled, and the second has to read as visibly
 * worse rather than as the same offer arriving by another route. The range a
 * prefix offer can occupy runs from 13 — an exact alias inside its band — down
 * to about -11, the longest alias in the index barely begun, so 25 puts a
 * single edit below the whole of it. Per edit rather than flat: two edits is
 * usually a different word, and the offer should sink accordingly rather than
 * sit level with a genuine slip.
 */
export const TYPO_PENALTY = 25;

export function prefixQuality(alias: string, fragment: string): number {
  if (alias === fragment) return EXACT_BONUS;
  return -(alias.length - fragment.length) * LENGTH_PENALTY;
}

/**
 * Never negative. A unit that declares a band is not punished for being out of
 * it relative to a unit that declares nothing — otherwise supplying data would
 * be a liability, and nobody would supply it.
 */
export function scaleFit(
  count: Decimal | undefined,
  typical: [number, number] | undefined,
): number {
  if (count === undefined || typical === undefined) return 0;
  const [lo, hi] = typical;
  // Magnitude, so "-30 min" is scored like "30 min".
  const n = count.abs();
  return n.gte(new Decimal(lo)) && n.lte(new Decimal(hi)) ? SCALE_BONUS : 0;
}
