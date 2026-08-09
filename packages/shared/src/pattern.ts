import type { UnitTable } from "./types";

/**
 * `/` is escaped alongside the metacharacters because the result is a regex
 * *source*, and a caller may drop it into a literal. `-` deliberately is not:
 * outside a character class `\-` is an invalid identity escape under the `u`
 * and `v` flags, and the `v` flag is what HTML compiles a `pattern` attribute
 * with.
 */
const quote = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * An alias with each cased letter widened to a two-member class:
 * `deg` -> `[dD][eE][gG]`.
 *
 * An HTML `pattern` attribute takes no flags, so there is nowhere to put `i`.
 * Listing `deg|DEG` instead would describe a parser nobody wrote: loose
 * `parse` lowercases, so it accepts `30Deg` too, and a pattern that rejected
 * it would fail the field in the browser and pass it in JavaScript.
 */
const anyCase = (alias: string): string =>
  Array.from(alias)
    .map((c) => {
      const lower = c.toLowerCase();
      const upper = c.toUpperCase();
      // Single code points only: 'ß'.toUpperCase() is 'SS', which is not a
      // class member. Such a character stays literal rather than lying.
      return lower !== upper && Array.from(upper).length === 1
        ? `[${lower}${upper}]`
        : quote(c);
    })
    .join("");

/** Longest first: alternation is ordered, so `deg` before `degrees` wins on the prefix. */
const aliasesOf = <U extends string>(table: UnitTable<U>): string[] =>
  Object.keys(table.alias).sort((a, b) => b.length - a.length || a.localeCompare(b));

const NUMBER = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?";

/**
 * A `pattern` attribute value covering the same grammar `parse` accepts, so a
 * form gets native validation with no JS and an `inputmode` hint for free.
 *
 * Strict mirrors `format`'s output exactly: one casing, no padding. Loose
 * mirrors the trim and the case fold.
 *
 * One deliberate narrowing in both modes: the unit is required. Loose `parse`
 * accepts a bare number when `defaultUnit` is set, and a table cannot know
 * whether it was — a pattern that guessed yes would pass `30` through native
 * validation on a field whose parser then rejects it.
 *
 * The count is the other way round. Loose `parse` reads a bare unit as one of
 * it whatever the table holds, so the number is optional here — a field that
 * rejected `kg` in the browser and accepted it in JavaScript would be the same
 * disagreement as the narrowing above, pointing the other way.
 */
export function patternFor<U extends string>(
  table: UnitTable<U>,
  opts?: { mode?: "strict" | "loose" },
): string {
  const aliases = aliasesOf(table);
  if (opts?.mode === "strict") {
    return `${NUMBER} ?(?:${aliases.map(quote).join("|")})`;
  }
  return `\\s*(?:${NUMBER} ?)?(?:${aliases.map(anyCase).join("|")})\\s*`;
}
