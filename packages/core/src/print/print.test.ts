import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { formatValue } from "../format/format";
import { buildRegistry, NUMBER_KIND } from "../kind/registry";
import en from "../locale/en";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser, type Program } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import type { RateLookup, Value } from "../types";
import { Printer } from "./print";

const registry = buildRegistry(BUILTIN_KINDS, [], en.id);
const resolver = createResolver({
  registry,
  locale: en,
  packs: [],
  layers: [en.weights],
});
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale: en, registry });
const parser = new Parser({ resolver });

function programFor(input: string): Program {
  return parser.run(tokenizer.run(normalizer.run(input)));
}

const printer = new Printer({ registry, locale: en });

// --- canonical: the golden table ---------------------------------------

test("canonical: a plain quantity, alias normalized to its registered form", () => {
  expect(printer.print(programFor("10 km"))).toBe("10 km");
});

test("canonical: normalizes a word form to the unit's own first alias", () => {
  // "kilograms" is reached only through the locale's suffix-stripping
  // analyzer (mass/units.ts's own doc comment), never a direct alias — a
  // single, unambiguous candidate that canonical is free to respell.
  expect(printer.print(programFor("1.5 kilograms"))).toBe("1.5 kg");
});

test("canonical: a binary expression", () => {
  expect(printer.print(programFor("1 kg + 500 g"))).toBe("1 kg + 500 g");
});

test("canonical: re-emits the parentheses an expression still needs", () => {
  // Without the source parens, "1 + 2 * 3" would parse as 1 + (2 * 3) — the
  // parens here are load-bearing, and dropping them on print would silently
  // change what the printed text means.
  expect(printer.print(programFor("(1 + 2) * 3"))).toBe("(1 + 2) * 3");
});

test("canonical: adds no parentheses an expression never needed", () => {
  // The precedence-climbing parser already reads "1 + 2 * 3" as 1 + (2 * 3);
  // a printer that always parenthesizes the right operand would emit
  // "1 + (2 * 3)" here, which still round-trips but fails this test — the
  // point of this case, per the brief, is exactly "and no others".
  expect(printer.print(programFor("1 + 2 * 3"))).toBe("1 + 2 * 3");
});

test("canonical: keeps parentheses that force right-nesting", () => {
  // Left-associativity means "10 - 2 - 3" always parses as (10 - 2) - 3, so
  // the only way to reach 10 - (2 - 3) at all is with the source parens —
  // dropping them on print would reproduce (10 - 2) - 3 instead: 5, not 11.
  expect(printer.print(programFor("10 - (2 - 3)"))).toBe("10 - (2 - 3)");
});

test("canonical: a unary minus", () => {
  expect(printer.print(programFor("-5 km"))).toBe("-5 km");
});

test("canonical: a convert", () => {
  expect(printer.print(programFor("2 km in m"))).toBe("2 km in m");
});

test("canonical: a convert's operand keeps no parentheses it doesn't need", () => {
  // "1 kg + 2 kg in g" parses as (1 kg + 2 kg) in g: "+" binds at 10, well
  // above CONVERT_BINDING (5), so the whole sum is `left` by the time the
  // parser reaches "in". Printing must not add parens around the operand
  // here — this is the "and no others" half of the convert fix; the "needs
  // them" half (an operand whose own binding is *below* CONVERT_BINDING)
  // has no operator in today's committed grammar low enough to exercise —
  // see print.ts's `case "convert"` comment and the fix report.
  expect(printer.print(programFor("1 kg + 2 kg in g"))).toBe("1 kg + 2 kg in g");
});

test("canonical: a speed quantity prints its first alias, not its display symbol", () => {
  // speed's `mps` unit has `symbol: "m/s"` (for formatValue) but its first
  // registered alias is the plain, parser-legal "mps" — canonical must never
  // reach for the symbol, which `in`/`to`/`as` targets and bare quantities
  // would silently fail to re-lex.
  expect(printer.print(programFor("10 mps"))).toBe("10 mps");
});

test("canonical: an area quantity prints its first alias, not its display symbol", () => {
  // area's `m2` unit has `symbol: "m²"`; its first alias is "m2".
  expect(printer.print(programFor("3 m2"))).toBe("3 m2");
});

test("canonical: an ambiguous unit is echoed, not resolved to one meaning", () => {
  // "m" is registered under both length (metre) and duration (minute); the
  // node alone carries both candidates with no way to know which the solver
  // will pick once "km" supplies context. Canonicalizing it to either
  // meaning here would be resolving an ambiguity `canonical` has no
  // `Resolution` to resolve with — see `unitText`'s doc comment.
  expect(printer.print(programFor("10 m + 5 km"))).toBe("10 m + 5 km");
});

test("canonical: word math normalizes numerals and operator words to symbols", () => {
  expect(printer.print(programFor("ten plus two times three"))).toBe("10 + 2 * 3");
});

test("canonical: a bare number prints with no unit at all", () => {
  // `NumberNode`'s own case in `printNode` never calls `unitText` — a bare
  // number is never a quantity of `NUMBER_KIND`'s "one" unit, it is a
  // `NumberNode`, and those two cases print differently on purpose. This is
  // the golden case that pins the bypass the invariant test below excludes
  // `NUMBER_KIND` on the strength of: if a later change ever made a bare
  // number print with a trailing unit, this is what would catch it, since
  // the invariant test's exclusion would otherwise stay silent about
  // exactly the case it exists to guard.
  expect(printer.print(programFor("42"))).toBe("42");
});

// --- the invariant unitText's single-candidate path rests on ------------

test("invariant: every unit the printer can emit a unit for lexes back to that (kind, unit)", () => {
  // `unitText` canonicalizes an unambiguous quantity to `lexeme.aliases[0]`
  // rather than `lexeme.symbol` specifically because the first alias is
  // supposed to be parser-legal (see `unitText`'s doc comment) — but nothing
  // enforces that ordering. It holds today only because every kind package
  // happens to declare the lexable spelling first; reversing two lines in a
  // kind package's `units.ts` would make the printer emit an unparseable
  // alias with no failing test.
  //
  // This is that test, and it has to go through `Normalizer` + `Tokenizer`,
  // not just `resolver.resolve`: `buildRegistry`'s alias-index pass builds
  // `aliasIndex` by iterating this exact `aliases` list, keyed by the
  // lowercased alias, so `resolver.resolve(alias)` names `(kind, unit)` for
  // *any* registered alias by construction, whatever its lexability — that
  // is not the property the printer depends on and would not catch a kind
  // package declaring an unlexable spelling first. Lexability is a question
  // for the lexer, not the alias index: an alias containing an operator
  // character (`"m/s"`), a space, or a symbol outside `lex.ts`'s
  // `UNIT_SYMBOLS` allowlist does not lex as a single word token at all, so
  // there is nothing for the alias index to even be asked about.
  //
  // `NUMBER_KIND` is excluded, and deliberately not by weakening the check
  // above but by narrowing which units the property even claims to cover:
  // the property is "every unit the printer can *emit* a unit suffix for",
  // and `NUMBER_KIND` is outside that set on both printing paths —
  // `formatValue` special-cases it to return the bare number with no unit,
  // and `print.ts`'s `case "number"` never calls `unitText` either, so
  // `unitText`'s promise about `aliases[0]` is simply never exercised for
  // this kind. That the exclusion tracks a real code path rather than an
  // assumption is what "canonical: a bare number prints with no unit at
  // all" above pins: if a later change ever made either printing path start
  // emitting `NUMBER_KIND`'s unit, that golden case fails first, which is
  // what keeps this exclusion from silently going stale.
  //
  // Worth stating why `NUMBER_KIND` would fail here if it weren't excluded,
  // so the exclusion reads as a real asymmetry and not an oversight: its one
  // unit's alias, `"one"`, cannot lex back as a word at all —
  // `foldNumerals` claims the bare word `"one"` as the cardinal numeral `1`
  // before the parser ever asks the alias index about it (the same fold
  // that turns "one thousand thirty two" into `1032`), so it is
  // unreachable as a `QuantityNode`'s resolved unit through this engine's
  // ordinary parsing regardless of what the printer does.
  let checked = 0;
  const failures: string[] = [];
  for (const [kindId, kind] of registry.kinds) {
    if (kindId === NUMBER_KIND) continue;
    for (const [unitId, unit] of kind.units) {
      const alias = unit.lexeme.aliases[0];
      if (alias === undefined) {
        failures.push(`${kindId}:${unitId} — no first alias`);
        continue;
      }
      checked += 1;
      const stream = tokenizer.run(normalizer.run(alias));
      const [token, second] = stream.tokens;
      if (token === undefined || second !== undefined || token.type !== "word") {
        failures.push(
          `${kindId}:${unitId} — alias ${JSON.stringify(alias)} does not lex to a single word token (got ${stream.tokens.length})`,
        );
        continue;
      }
      const named = resolver
        .resolve(token.text)
        .some((c) => c.kind === kindId && c.unit === unitId);
      if (!named) {
        failures.push(
          `${kindId}:${unitId} — alias ${JSON.stringify(alias)} lexes to ${JSON.stringify(token.text)} but does not resolve to that (kind, unit)`,
        );
      }
    }
  }
  expect(failures).toEqual([]);
  // Guards against an empty registry making every iteration above vacuous.
  expect(checked).toBeGreaterThan(20);
});

// --- not yet implemented: throws, never a silent fallback ---------------

test("print: verbatim mode throws rather than falling back to canonical", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { mode: "verbatim" })).toThrow();
});

test("print: resolved mode throws rather than falling back to canonical", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { mode: "resolved" })).toThrow();
});

test("print: { unit } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { unit: "m" })).toThrow();
});

test("print: { symbols: true } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { symbols: true })).toThrow();
});

test("print: { precision } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { precision: 2 })).toThrow();
});

test("print: { spacing } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { spacing: "tight" })).toThrow();
});

test("print: { spelled: true } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { spelled: true })).toThrow();
});

test("node(): not implemented, throws", () => {
  const program = programFor("10 km");
  expect(() => printer.node(program, program.root.id)).toThrow();
});

// --- value(): today's formatValue, byte-identical -----------------------

const massValue: Value = Object.freeze({
  kind: "mass",
  canonical: new Decimal("1500"),
  unit: "kg",
});

test("value(): matches formatValue with no options", () => {
  expect(printer.value(massValue)).toBe(formatValue(massValue, registry, en));
});

test("value(): matches formatValue with an explicit precision", () => {
  const opts = { precision: 4 };
  expect(printer.value(massValue, opts)).toBe(formatValue(massValue, registry, en, opts));
});

test("value(): folds the printer's own rounding into the call", () => {
  const withRounding = new Printer({ registry, locale: en, rounding: Decimal.ROUND_UP });
  expect(withRounding.value(massValue)).toBe(
    formatValue(massValue, registry, en, { rounding: Decimal.ROUND_UP }),
  );
});

test("value(): a caller's own rounding overrides the printer's configured one", () => {
  const withRounding = new Printer({ registry, locale: en, rounding: Decimal.ROUND_UP });
  const opts = { rounding: Decimal.ROUND_DOWN };
  expect(withRounding.value(massValue, opts)).toBe(
    formatValue(massValue, registry, en, opts),
  );
});

test("value(): folds the printer's own rates into the call", () => {
  const rates: RateLookup = { base: "usd", asOf: "2026-01-01", get: () => null };
  const withRates = new Printer({ registry, locale: en, rates });
  expect(withRates.value(massValue)).toBe(
    formatValue(massValue, registry, en, { rates }),
  );
});

// --- instance behaviour ---------------------------------------------------

test("Printer is frozen and stateless: two calls with the same input agree", () => {
  expect(Object.isFrozen(printer)).toBe(true);
  const program = programFor("1 kg + 500 g");
  expect(printer.print(program)).toBe(printer.print(program));
});
