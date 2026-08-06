import type { Err, Ok, Parsed, ParseOptions, UnitTable } from "./types";

/**
 * sign? digits ("." digits)? exponent?   then optional whitespace, then a unit.
 * No thousands separators and no locale decimal comma: those need `Intl` and
 * the locale's numberFormat, which is the engine's job.
 */
const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * What a unit word may be made of. Letters and `%` and `°` for `°c`, digits
 * for `m2`/`m3`, and `\p{N}` so the superscript aliases `m²`/`m³` are words
 * too. Anything else abutting the number means the number did not end where
 * it looked like it ended — `30,5deg` is a locale decimal, not a unit called
 * `,5deg`, and the spec's table calls it `nan`.
 */
const UNIT_WORD = /^[\p{L}\p{N}%°]+$/u;

const fail = (code: Err["code"], input: string): Err =>
  Object.freeze({ ok: false as const, code, input });

export function parse<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): Parsed<U> {
  const strict = opts?.mode === "strict";
  const text = input.trim();

  // Before the strict whitespace check, so `"   "` is `empty` in both modes
  // rather than `trailing` in one of them.
  if (text.length === 0) return fail("empty", input);

  // The first of the three strict/loose differences: loose trims, strict
  // treats what surrounds the value as input that continued past it. Checked
  // by comparing against the trimmed form rather than by parsing the padded
  // one, because leading space would otherwise fail the number match and be
  // reported as `nan`, naming the wrong problem.
  if (strict && text.length !== input.length) return fail("trailing", input);

  const matched = NUMBER.exec(text);
  if (matched === null) return fail("nan", input);

  const raw = matched[0];
  const value = Number(raw);
  if (!Number.isFinite(value)) return fail("nan", input);

  const rest = text.slice(raw.length);
  // A single inner space is always allowed, in both modes: "30 deg" is the
  // form people type and rejecting it would make strict useless.
  const word = rest.startsWith(" ") ? rest.slice(1) : rest;

  if (word.length === 0) {
    // The third difference: strict has no bare-number fallback, so `30` is
    // `missing-unit` there however `defaultUnit` is set.
    const fallback = strict ? undefined : opts?.defaultUnit;
    if (fallback === undefined) return fail("missing-unit", input);
    return finish(value, fallback, raw, input, opts);
  }

  // Anything that is not a unit word is trailing input, not an unknown unit:
  // "30 deg extra" has a space inside `word`, and reporting `unknown-unit` for
  // it would name the wrong problem.
  if (/\s/.test(word)) return fail("trailing", input);
  if (!UNIT_WORD.test(word)) return fail("nan", input);

  // The second difference: loose folds case, strict does not.
  const key = strict ? word : word.toLowerCase();
  const direct = table.alias[key];
  const unit = direct ?? opts?.resolve?.(key, table);
  if (unit === undefined) return fail("unknown-unit", input);

  return finish(value, unit, raw, input, opts);
}

function finish<U extends string>(
  value: number,
  unit: U,
  raw: string,
  input: string,
  opts: ParseOptions<U> | undefined,
): Parsed<U> {
  // Orthogonal to mode: `opts.unit` turns any *other* valid unit into
  // `wrong-unit`, and leaves a word nobody knows as `unknown-unit`.
  if (opts?.unit !== undefined && opts.unit !== unit) return fail("wrong-unit", input);
  return Object.freeze({ ok: true as const, value, unit, raw }) as Ok<U>;
}

export function is<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): boolean {
  return parse(table, input, opts).ok;
}
