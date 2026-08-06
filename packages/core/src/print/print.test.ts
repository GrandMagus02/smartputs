import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { formatValue } from "../format/format";
import { buildRegistry, NUMBER_KIND } from "../kind/registry";
import en from "../locale/en";
import type { Node } from "../parse/ast";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser, type Program } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
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

const solver = new Solver({ registry });
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
  // `Resolution` to resolve with — see `pickCandidate`'s doc comment.
  // `resolved` is the mode that does have one; see `modes.test.ts`.
  expect(printer.print(programFor("10 m + 5 km"))).toBe("10 m + 5 km");
});

test("canonical: word math normalizes numerals and operator words to symbols", () => {
  expect(printer.print(programFor("ten plus two times three"))).toBe("10 + 2 * 3");
});

test("canonical: a bare number prints with no unit at all", () => {
  // `NumberNode`'s own case in `printNode` never calls `unitWord` — a bare
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
  // `unitWord` canonicalizes an unambiguous quantity to `lexeme.aliases[0]`
  // rather than `lexeme.symbol` specifically because the first alias is
  // supposed to be parser-legal (see `unitWord`'s doc comment) — but nothing
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
  // and `NUMBER_KIND` is outside that set on this path — `print.ts`'s
  // `case "number"` never calls `unitWord`, so `unitWord`'s promise about
  // `aliases[0]` is simply never exercised for this kind here. (`formatValue`
  // has the same special case on its own, separate path — `Printer.value()`,
  // never exercised by this test — but that is a fact about a different
  // function, not evidence for this exclusion.) That the exclusion tracks a
  // real code path rather than an assumption is what "canonical: a bare
  // number prints with no unit at all" above pins: if a later change ever
  // made `print.ts`'s bypass start emitting `NUMBER_KIND`'s unit, that golden
  // case fails first, which is what keeps this exclusion from silently going
  // stale.
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

// --- spelled: not yet implemented, throws, never a silent fallback ------

test("print: { spelled: true } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { spelled: true })).toThrow();
});

test("node(): { spelled: true } throws", () => {
  const program = programFor("10 km");
  expect(() => printer.node(program, program.root.id, { spelled: true })).toThrow();
});

// --- verbatim: reproduces the source exactly -----------------------------
// The corpus-wide identity and the NFKC-shift case live in `modes.test.ts`;
// these are the non-corpus inputs the brief calls out by name — the corpus
// itself has no length-changing or padded row, so these are the only cases
// that exercise `mapSpan` doing real work rather than an identity mapping.

test("verbatim: leading and trailing padding the normalizer trims", () => {
  const input = "  10 km  ";
  expect(printer.print(programFor(input), { mode: "verbatim" })).toBe(input);
});

test("verbatim: a double space the normalizer collapses to one", () => {
  const input = "10   km";
  expect(printer.print(programFor(input), { mode: "verbatim" })).toBe(input);
});

test("verbatim: a degree sign the normalizer strips", () => {
  const input = "30°C";
  expect(printer.print(programFor(input), { mode: "verbatim" })).toBe(input);
});

test("verbatim: a non-ASCII dash the normalizer folds to '-'", () => {
  const input = "10 km − 5 km"; // U+2212 MINUS SIGN
  expect(printer.print(programFor(input), { mode: "verbatim" })).toBe(input);
});

// --- node(): one subexpression, same modes and options as print ---------

test('node(): throws for an id not in program.nodes, never returning ""', () => {
  const program = programFor("10 km");
  expect(() => printer.node(program, 999)).toThrow();
});

test("node(): canonical prints just the addressed subtree", () => {
  const program = programFor("1 kg + 500 g");
  const left = program.root.type === "binary" ? program.root.left : undefined;
  expect(left).toBeDefined();
  expect(printer.node(program, (left as NonNullable<typeof left>).id)).toBe("1 kg");
});

test("node(): verbatim slices the source at the addressed node's mapped span", () => {
  // Padded so the node's own span (which excludes the padding) differs from
  // the whole-program `source` — the case that would pass even if `node()`
  // wrongly bypassed `mapSpan` the way top-level `print()` correctly does.
  const program = programFor("  1 kg + 500 g  ");
  const left = program.root.type === "binary" ? program.root.left : undefined;
  expect(left).toBeDefined();
  expect(
    printer.node(program, (left as NonNullable<typeof left>).id, { mode: "verbatim" }),
  ).toBe("1 kg");
});

/** The right operand of a top-level binary program — the node whose span
 * sits *after* whatever the left operand's text did to the normalizer, so
 * addressing it exercises `mapSpan`'s offset bookkeeping rather than always
 * landing at position 0. */
function rightOperand(program: Program): Node {
  if (program.root.type !== "binary") {
    throw new Error(`expected a binary root, got ${program.root.type}`);
  }
  return program.root.right;
}

// The three cases above are also testable at `print()`'s level, but only the
// padded one actually distinguishes `print()`'s "always exact" contract from
// a hypothetical `mapSpan(root.span)`-based implementation — a double space,
// a degree sign, or a non-ASCII dash earlier in the string leaves the root's
// own span already covering "start of content" to "end of content" with
// nothing outside it to lose, so `print()`-level versions of them would pass
// under either implementation and mostly pin a `Normalizer` property, not a
// `Printer` one. `node()` addressing the *second* operand is where each edit's
// length change (or, for the dash, its position) actually has to be mapped
// correctly for the slice to land right — this is that regression cover.

test("node(): verbatim after a degree sign the normalizer strips earlier in the string", () => {
  const program = programFor("30°C + 5 kg");
  expect(printer.node(program, rightOperand(program).id, { mode: "verbatim" })).toBe(
    "5 kg",
  );
});

test("node(): verbatim after a double space the normalizer collapses earlier in the string", () => {
  const program = programFor("10  kg + 5 g");
  expect(printer.node(program, rightOperand(program).id, { mode: "verbatim" })).toBe(
    "5 g",
  );
});

test("node(): verbatim after a non-ASCII dash the normalizer folds earlier in the string", () => {
  const program = programFor("10 km − 5 km + 3 g"); // U+2212 MINUS SIGN
  expect(printer.node(program, rightOperand(program).id, { mode: "verbatim" })).toBe(
    "3 g",
  );
});

test("node(): verbatim throws after an NFKC length change, rather than returning the whole source", () => {
  // U+339E "㎞" (SQUARE KM) NFKC-expands to the two characters "km": a
  // length change, which is the one case `NormalizedInput.mapSpan` cannot
  // answer for a specific node (see `verbatimSlice`'s doc comment).
  const program = programFor("10 ㎞");
  expect(() => printer.node(program, program.root.id, { mode: "verbatim" })).toThrow();
});

test("print(): verbatim is exact even after an NFKC length change — it never consults a node span", () => {
  const input = "10 ㎞";
  expect(printer.print(programFor(input), { mode: "verbatim" })).toBe(input);
});

// --- resolved: requires a Resolution, substitutes the solver's choice ---

test("print: resolved mode throws without { resolution } rather than falling back to canonical", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { mode: "resolved" })).toThrow();
});

test("resolved: matches canonical when every quantity is unambiguous", () => {
  const program = programFor("1 kg + 500 g");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution })).toBe(
    printer.print(program),
  );
});

test("resolved: substitutes the resolved reading for an ambiguous quantity", () => {
  // "m" is ambiguous (length's metre, duration's minute); "5 h" forces
  // duration, so the solver reads the first "m" as minutes. `canonical` has
  // no `Resolution` and echoes "m" either way — see the golden case above
  // this one's counterpart on "10 m + 5 km". `resolved` is the mode that
  // makes that choice visible instead: spec §4.6's own example.
  const program = programFor("10 m + 5 h");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution })).toBe("10 min + 5 h");
});

test("resolved: an ambiguous quantity whose resolved alias would coincide with canonical's echo picks a distinguishing one instead", () => {
  // Here the solver reads "m" as length's metre (context is "5 km"), and
  // length's first alias is itself "m" — printing it blindly would silently
  // reproduce canonical's echo, byte for byte, coinciding by accident rather
  // than being the distinct mode `resolved` is supposed to be. See
  // `unitWord`'s doc comment.
  const program = programFor("10 m + 5 km");
  const resolution = solver.best(program);
  const resolved = printer.print(program, { mode: "resolved", resolution });
  expect(resolved).toBe("10 metre + 5 km");
  expect(resolved).not.toBe(printer.print(program));
});

test("resolved: an ambiguous node with no distinguishing spelling at all coincides with canonical", () => {
  // "C" is ambiguous between temperature's and tempdelta's identically
  // spelled "c" (decorative "°c" alias included) — no reading's alias
  // differs from the other's, so there is nothing for `resolved` to reveal,
  // and it should print exactly what `canonical` does rather than an
  // artifact of alias-table casing (see `unitWord`'s `ambiguousSurface`
  // fallback).
  const program = programFor("30 C - 20 C");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution })).toBe(
    printer.print(program),
  );
});

test("resolved: node() reads the same Resolution for a single subtree", () => {
  const program = programFor("10 m + 5 h");
  const resolution = solver.best(program);
  const left = program.root.type === "binary" ? program.root.left : undefined;
  expect(left).toBeDefined();
  expect(
    printer.node(program, (left as NonNullable<typeof left>).id, {
      mode: "resolved",
      resolution,
    }),
  ).toBe("10 min");
});

// --- unit + precision: rebasing is the first thing the printer computes -

test("unit: rebases every quantity of the matching kind, others untouched", () => {
  expect(printer.print(programFor("1 kg + 500 g"), { unit: "g" })).toBe(
    "1,000 g + 500 g",
  );
});

test("unit: a quantity of a different kind is left exactly as canonical prints it", () => {
  // "5 h" is duration, not length — { unit: "m" } (ambiguous on its own,
  // see below) still must not touch it were it to resolve to length.
  expect(printer.print(programFor("1 kg + 500 g"), { unit: "cm" })).toBe(
    printer.print(programFor("1 kg + 500 g")),
  );
});

test("unit: an unknown alias throws", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { unit: "zzz-not-a-unit" })).toThrow();
});

test("unit: an alias ambiguous across kinds throws rather than guessing", () => {
  const program = programFor("10 km");
  expect(() => printer.print(program, { unit: "m" })).toThrow();
});

test("unit: canonical never rebases an ambiguous quantity, even one whose reading would match — the printed line can look mixed-unit", () => {
  // "m" is ambiguous (length/duration); `canonical` has no `Resolution` to
  // pick a candidate with, so it cannot know this node is length at all —
  // the same reason it echoes the surface here instead of an alias (see
  // `renderQuantity`'s doc comment). Only the unambiguous "5 km" gets
  // rebased, producing a line with two different length units on it. This
  // is the documented carve-out on `PrintOptions.unit`, pinned so it reads
  // as a decision rather than a surprise.
  expect(printer.print(programFor("10 m + 5 km"), { unit: "cm" })).toBe(
    "10 m + 500,000 cm",
  );
  expect(printer.print(programFor("2 km in m"), { unit: "cm" })).toBe("200,000 cm in m");
});

test("unit: resolved rebases the same ambiguous quantity the carve-out above skips", () => {
  // Same input and target unit as the canonical carve-out test, but with a
  // `Resolution` in hand `pickCandidate` has a chosen candidate to check
  // `unit` against, so both quantities rebase.
  const program = programFor("10 m + 5 km");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution, unit: "cm" })).toBe(
    "1,000 cm + 500,000 cm",
  );
});

test("precision: rounds a quantity unit actually rebases", () => {
  // 1 h = 1/24 d exactly, a repeating decimal in base 10.
  const program = programFor("1 h");
  expect(printer.print(program, { unit: "d", precision: 4 })).toBe("0.04167 d");
});

test("precision: without unit, there is nothing computed to round — the literal prints unchanged", () => {
  const program = programFor("1 h");
  expect(printer.print(program, { precision: 4 })).toBe("1 h");
});

// --- symbols: UnitLexeme.symbol, falling back to the alias --------------

test("symbols: an area quantity prints its display symbol, not its alias", () => {
  expect(printer.print(programFor("3 m2"), { symbols: true })).toBe("3 m²");
});

test("symbols: a speed quantity's symbol differs entirely from its alias", () => {
  expect(printer.print(programFor("10 mps"), { symbols: true })).toBe("10 m/s");
});

test("symbols: inert on an ambiguous resolved node with no distinguishing spelling at all", () => {
  // temperature and tempdelta share not just one alias table but one
  // symbol ("°C" for both) — `resolved` still has nothing to reveal here
  // (see the "no distinguishing spelling" test above and `unitWord`'s doc
  // comment), so `{ symbols: true }` makes no difference: the printed unit
  // is "C" either way, never "°C".
  const program = programFor("30 C - 20 C");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution, symbols: true })).toBe(
    printer.print(program),
  );
});

// --- spacing: "tight" vs the default "normal" ----------------------------

test("spacing: tight removes the number-unit gap and symbolic-operator spaces", () => {
  expect(printer.print(programFor("1 kg + 500 g"), { spacing: "tight" })).toBe(
    "1kg+500g",
  );
});

test('spacing: tight keeps the spaces around a keyword operator ("of")', () => {
  // Gluing "%" against "of" would produce "20%of50" — a different, unreadable
  // word, not just a differently-spaced one — see `PrintOptions.spacing`'s
  // doc comment.
  expect(printer.print(programFor("20% of 50"), { spacing: "tight" })).toBe("20% of 50");
});

test('spacing: tight keeps the spaces around a convert\'s "in"', () => {
  expect(printer.print(programFor("2 km in m"), { spacing: "tight" })).toBe("2km in m");
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
