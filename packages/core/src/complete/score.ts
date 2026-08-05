import { Decimal } from "../decimal";

/** An alias the user has finished typing. */
export const EXACT_BONUS = 10;
/** Charged once per character the user has not typed yet. */
export const LENGTH_PENALTY = 1;
/** The typed count falls inside the unit's declared `typical` band. */
export const SCALE_BONUS = 3;

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
