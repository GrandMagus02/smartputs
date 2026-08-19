/**
 * The operator cut, shared by the two grammars in front of chrono: the bridge,
 * which never offers chrono anything past the first operator, and the
 * ordinal-weekday recognizer, which applies the same cut to the month scope it
 * hands chrono.
 */

/**
 * Where the expression stops being a date and starts being an operator.
 *
 * chrono reads "today + 5 h" as one relative date-and-time and reports the whole
 * string as its match — which would fold the operator and its right operand into
 * the literal, destroying the `datetime + duration` reading the plugin exists to
 * provide. So the bridge never offers chrono anything past the first operator.
 *
 * `-` and `/` only count when whitespace-delimited, because both appear inside
 * dates chrono reads: the hyphens of "2026-03-01" and the slashes of "1/15/2026".
 * `*` appears in no date syntax, so it cuts wherever it stands. `+` cuts the
 * same way — which is what makes "today+3d" work — everywhere except inside a
 * written UTC offset, the one date syntax that contains one. Unspaced
 * "today-1d" is the residue of that asymmetry and is recorded in
 * m4-followups.md. Parentheses cut anywhere.
 *
 * `to`, `as` and `in` are here for exactly the same reason, and they matter for
 * exactly the same reason the ranges design (§5.1) needs them to: core's
 * `keywordFor` maps all three onto the `in` keyword, so they are operators in
 * this grammar even though they are spelled with letters. chrono does not know
 * that. It reads "10:00 to 20:00" and "today to friday" as *its own* notion of
 * a range — one result, `end` populated, the whole run claimed — and this
 * bridge only ever returns the start, so without the cut the literal swallowed
 * the keyword and the right endpoint and reported "10:00". `in | time | time`
 * and `in | date | date` never saw two operands because there was only ever
 * one token.
 *
 * They are whitespace-delimited on both sides, which is what keeps "in 3 days"
 * — where chrono's match *starts* with the word — intact, and what stops the
 * "in" of "into" from cutting. Spelling them in English here mirrors what
 * `PLURAL_SUFFIXES` above already does: `MatchCtx` carries a locale name and a
 * unit-alias predicate, not the locale's keyword table, so a bridge that wants
 * to know where an operator is has to know the words. Widening `MatchCtx` is
 * the real fix and is bigger than this milestone.
 */
const OPERATOR_TAIL = /[()+*]|\s[-/]\s|\s(?:to|as|in)\s/g;

/**
 * Runs where a `+` is part of a zone, not an operator: "3pm gmt+3", "3pm
 * utc+0530", "3pm +03:00". Without this the cut above would hand chrono "3pm
 * gmt" and leave "+3" to the solver, which reads it as adding a bare number to
 * a datetime — a dimension mismatch on input that names an ordinary zone.
 *
 * The bare `±HH:MM` form is protected only with its colon. `±HHMM` is left out
 * on purpose: "1000 +2000" is arithmetic a user might really type, and a colon
 * is not something any number in this grammar contains.
 */
const OFFSET_SPAN =
  /(?:gmt|utc)\s*[+-]\s*\d{1,2}(?:\s*:\s*\d{2}|\d{2})?|[+-]\d{2}:\d{2}/giu;

export function beforeOperator(rest: string): string {
  const zones = [...rest.matchAll(OFFSET_SPAN)].map(
    (m) => [m.index, m.index + m[0].length] as const,
  );

  for (const cut of rest.matchAll(OPERATOR_TAIL)) {
    if (zones.some(([start, end]) => cut.index >= start && cut.index < end)) continue;
    return rest.slice(0, cut.index);
  }
  return rest;
}
