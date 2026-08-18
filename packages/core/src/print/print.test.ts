import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { defineKind } from "../kind/define";
import { buildRegistry, NUMBER_KIND } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import type { Node } from "../parse/ast";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser, type Program } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Solver } from "../solve/solver-class";
import type { ExpressionParts, Language, Locale, RateLookup, Value } from "../types";
import { Printer } from "./print";
import { unitWord } from "./unit-word";

const en = composeLocale(english, BUILTIN_EN);

const registry = buildRegistry(BUILTIN_KINDS, [en]);
const resolver = createResolver({
  registry,
  locales: [en],
  format: en,
  layers: [english.weights],
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
  // `unitWord` canonicalizes an unambiguous quantity to the unit's first
  // alias rather than its `symbol` specifically because the first alias is
  // supposed to be parser-legal (see `unitWord`'s doc comment) — but nothing
  // enforces that ordering. It holds today only because every kind package
  // happens to declare the lexable spelling first; reversing two lines in a
  // kind package's `units.ts` would make the printer emit an unparseable
  // alias with no failing test.
  //
  // The word checked is `unitWord`'s own answer, not `aliases[0]` read out of
  // the registry beside it. Those coincide for every unit an English
  // vocabulary ships words for, which is nearly all of them — but not all,
  // and the difference is the whole point of asking the function instead of
  // reproducing its first branch. `boolean`'s single unit is a sentinel with
  // no words in any language (its kind formats itself), so `aliases[0]` is
  // `undefined` there while `unitWord` degrades to the unit's own registry
  // key, `"bool"` — which is exactly what `buildRegistry` indexes for a kind
  // no language has spoken for (ruling R2), so it round-trips like every
  // other unit here and belongs in the invariant rather than outside it. A
  // proxy that reads the table directly has to carve out an exception for
  // that; the function has no exception to carve.
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
    for (const unitId of kind.units.keys()) {
      const alias = unitWord(
        {
          kindId,
          unitId,
          // An unambiguous node: nothing to avoid, no surface to fall back to,
          // and `symbols: false` because `print`'s default options are the
          // only ones the round-trip contract covers.
          avoid: new Set(),
          ambiguousSurface: undefined,
          symbols: false,
        },
        registry,
        en,
      );
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

// --- spelled: numbers via locale.spell, operators via keywords, units via
// UnitLexeme.display ------------------------------------------------------

test("print: { spelled: true } throws when the locale declares no spell", () => {
  // Destructuring off `spell` (not `{ ...en, spell: undefined }`) so the key
  // is genuinely absent — `exactOptionalPropertyTypes` treats "present with
  // `undefined`" and "absent" as different things for an optional field.
  const { spell: _spell, ...rest } = english;
  const noSpellLocale: Locale = composeLocale(rest, BUILTIN_EN);
  const noSpellPrinter = new Printer({ registry, locale: noSpellLocale });
  const program = programFor("10 km");
  // Pinned to the message, not a bare `.toThrow()` — an unrelated cause
  // (a typo in `programFor`, say) would also throw and still pass a bare
  // assertion here.
  expect(() => noSpellPrinter.print(program, { spelled: true })).toThrow(/spell/);
});

test("node(): { spelled: true } throws when the locale declares no spell", () => {
  const { spell: _spell, ...rest } = english;
  const noSpellLocale: Locale = composeLocale(rest, BUILTIN_EN);
  const noSpellPrinter = new Printer({ registry, locale: noSpellLocale });
  const program = programFor("10 km");
  expect(() => noSpellPrinter.node(program, program.root.id, { spelled: true })).toThrow(
    /spell/,
  );
});

test("spelled: the design doc's done-when", () => {
  expect(printer.print(programFor("30 deg + 15 deg"), { spelled: true })).toBe(
    "thirty degrees plus fifteen degrees",
  );
});

test('spelled + tight: spelled words never glue together, even under spacing: "tight"', () => {
  // `isWordOp` exists to stop "of"/"off" gluing into a third word under
  // `tight` ("20%of100"); `spelled` turns `+` into the locale word "plus",
  // which carries the identical risk and was not covered — this used to
  // print "thirtydegreesplusfifteendegrees".
  expect(
    printer.print(programFor("30 deg + 15 deg"), { spelled: true, spacing: "tight" }),
  ).toBe("thirty degrees plus fifteen degrees");
});

test("spelled: a bare number with no unit spells the same as a quantity's magnitude", () => {
  expect(printer.print(programFor("42"), { spelled: true })).toBe("forty two");
});

test("spelled: word math — canonicalizing to digits and spelling back out agree with the original", () => {
  // "ten plus two times three" canonicalizes to "10 + 2 * 3" (the golden case
  // above); spelled re-derives the same words from those digits, exercising
  // both the number and the symbolic-operator halves of `spelled` at once.
  expect(printer.print(programFor("ten plus two times three"), { spelled: true })).toBe(
    "ten plus two times three",
  );
});

test("spelled: binary minus spells to its locale word", () => {
  // Positive coverage for `OP_KEYWORDS["-"]`, distinct from the unary-minus
  // test below: that one exercises `UnaryNode`, which never consults
  // `OP_KEYWORDS` at all — only a `BinaryNode`'s "-" does.
  expect(printer.print(programFor("10 km - 2 km"), { spelled: true })).toBe(
    "ten kilometres minus two kilometres",
  );
});

test("spelled: binary division spells to its locale word", () => {
  // Positive coverage for `OP_KEYWORDS["/"]` against the *unmodified* `en`
  // locale — the "no word form" test below deletes `keywords.over` and only
  // proves the symbol survives that absence, which a mistyped or misdirected
  // `OP_KEYWORDS["/"]` entry would still pass.
  expect(printer.print(programFor("10 km / 2 km"), { spelled: true })).toBe(
    "ten kilometres over two kilometres",
  );
});

test("spelled: an operator with no word form in the locale keeps its symbol, not an invented word", () => {
  const { over: _over, ...restKeywords } = english.keywords;
  const noOverLocale: Locale = composeLocale(
    { ...english, keywords: restKeywords },
    BUILTIN_EN,
  );
  const noOverPrinter = new Printer({ registry, locale: noOverLocale });
  expect(noOverPrinter.print(programFor("10 km / 2 km"), { spelled: true })).toBe(
    "ten kilometres / two kilometres",
  );
});

test("spelled: a unary minus keeps its symbol; the operand's magnitude and unit still spell", () => {
  // There is no `Keyword` for negation at all — `Locale.keywords` has no slot
  // for one — so this is the same "no word form, keep the symbol" rule as
  // above, just for an operator the type system never gave a word to.
  expect(printer.print(programFor("-5 km"), { spelled: true })).toBe("-five kilometres");
});

test("spelled: a non-integer number falls back to digits for that value; its unit still spells", () => {
  // `cardinalSpeller` declines a non-integer (no fractional grammar in the
  // numeral tables) — a documented, tested fallback for this one number, not
  // a sign the whole feature is unimplemented (see `PrintOptions.spelled`).
  expect(printer.print(programFor("1.5 kilograms"), { spelled: true })).toBe(
    "1.5 kilograms",
  );
});

test("spelled: canonical still echoes an ambiguous quantity exactly, numbers included", () => {
  // "10 m" is ambiguous (length/duration); with no `Resolution`, `canonical`
  // has no chosen candidate to derive a unit — or a plural category — from,
  // so the whole quantity is echoed as typed, untouched by `spelled`, the
  // same carve-out `PrintOptions.unit` documents for rebasing. "5 km" is not
  // ambiguous and spells normally.
  expect(printer.print(programFor("10 m + 5 km"), { spelled: true })).toBe(
    "10 m plus five kilometres",
  );
});

test("spelled + resolved: spells the resolved candidate's unit and magnitude", () => {
  const program = programFor("10 m + 5 h");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution, spelled: true })).toBe(
    "ten minutes plus five hours",
  );
});

test("spelled + unit: spells the rebased quantity's magnitude and the target unit", () => {
  expect(printer.print(programFor("1 kg + 500 g"), { unit: "g", spelled: true })).toBe(
    "one thousand grams plus five hundred grams",
  );
});

test("spelled: a convert target has no magnitude of its own — spelled with the generic plural category", () => {
  // "kg" and "g" are unambiguous (unlike "m"), so this isolates the target's
  // own rule from the ambiguous-echo carve-out tested above: the operand is
  // singular ("one kilogram"), but the target still spells as plural
  // ("grams") regardless — there is no count to agree with, only the
  // generic `"other"` category `spelledUnitWord` uses for exactly this case.
  expect(printer.print(programFor("1 kg in g"), { spelled: true })).toBe(
    "one kilogram in grams",
  );
});

test("spelled + symbols: a unit with no display falls back to its alias, not its symbol", () => {
  // area's "m2" has a symbol ("m²") but no `display` — spelled's own fallback
  // is specifically the alias (`unitWord` called with `{ symbols: false }`),
  // never `ctx.symbols`'s glyph: a spelled print's unit is a written word or
  // nothing, never a symbol, so `symbols: true` makes no difference here.
  expect(printer.print(programFor("3 m2"), { spelled: true, symbols: true })).toBe(
    "three m2",
  );
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

// The cases below are also testable at `print()`'s level, but only the
// padded one actually distinguishes `print()`'s "always exact" contract from
// a hypothetical `mapSpan(root.span)`-based implementation — a double space
// or a degree sign earlier in the string leaves the root's own span already
// covering "start of content" to "end of content" with nothing outside it to
// lose, so `print()`-level versions of them would pass under either
// implementation and mostly pin a `Normalizer` property, not a `Printer` one.
// `node()` addressing the *second* operand is where each edit's length
// change actually has to be mapped correctly for the slice to land right —
// this is that regression cover.
//
// A non-ASCII dash is deliberately not one of these on its own: `−` (U+2212)
// folds to `-` one-for-one (`{ length: 1 }` in `normalize.ts`'s edit), so it
// never shifts any later offset — `mapSpan` on a node after it returns the
// same span a naive pass-through would, and a test built only around it
// cannot fail against a broken `mapSpan`. It is kept below as a companion
// inside a case that *does* shift (a zero-width character, a true deletion),
// not as a case of its own.

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

test("node(): verbatim after a zero-width character and a non-ASCII dash earlier in the string", () => {
  // U+200B ZERO WIDTH SPACE between "10" and "km" is a true deletion
  // (`normalize.ts` records it as `{ length: 0 }`), so every offset from
  // there on is one less in the normalized text than in the source — unlike
  // the `−` (U+2212) MINUS SIGN a few characters later, which folds
  // one-for-one and shifts nothing (see the comment above). Verified
  // directly against `normalize()`'s own edits and `mapSpan` in the Task 10
  // review-fix report: `mapSpan` on the addressed node's span differs from
  // an identity mapping by exactly one character, and slicing at the
  // identity span instead returns `" 3 "` — proof this case fails against a
  // broken `mapSpan`, not just that it passes against the real one.
  const program = programFor("10​km − 5 km + 3 g");
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
  // Pinned to the literal string, not `printer.print(program)` — comparing
  // two live calls would let a bug that broke both `canonical` and
  // `resolved` identically slip through, the same standard the "no
  // distinguishing spelling" test below already applies.
  const program = programFor("1 kg + 500 g");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution })).toBe("1 kg + 500 g");
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
  // fallback). Pinned to the literal string — comparing two live `print()`
  // calls would let a bug that broke both sides identically slip through.
  const program = programFor("30 C - 20 C");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution })).toBe("30 C - 20 C");
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
  // Pinned to the literal string, not a second `printer.print()` call —
  // comparing two live calls would let a bug that broke both sides
  // identically slip through.
  expect(printer.print(programFor("1 kg + 500 g"), { unit: "cm" })).toBe("1 kg + 500 g");
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
  // is "C" either way, never "°C". Pinned to the literal string, not just
  // `printer.print(program)` — comparing two live calls would let a bug
  // that broke both sides identically slip through.
  const program = programFor("30 C - 20 C");
  const resolution = solver.best(program);
  expect(printer.print(program, { mode: "resolved", resolution, symbols: true })).toBe(
    "30 C - 20 C",
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

// --- the language assembles the quantity --------------------------------

/**
 * A spy `Language` over the real English one — every mechanic (`spell`,
 * `keywords`, the analyzers) kept, only the two writing hooks replaced, so a
 * failure here is about assembly and never about a fixture language that
 * cannot read "1 kg in g" in the first place.
 */
function spyLanguage(over: Partial<Language>): Locale {
  return composeLocale(defineLanguage({ ...english, ...over }), BUILTIN_EN);
}

function spyPrinterFor(locale: Locale): Printer {
  return new Printer({ registry: buildRegistry(BUILTIN_KINDS, [locale]), locale });
}

test("the printer renders every quantity through the language, with the real slot", () => {
  const seen: string[] = [];
  const locale = spyLanguage({
    selectForm: ({ slot, unit }) => {
      seen.push(`${slot}:${unit}`);
      return "other";
    },
    renderQuantity: (p) =>
      `[${p.slot}]${p.number}|${p.form ?? p.symbol ?? p.alias ?? p.unit}`,
  });
  // The operand is a quantity and goes through `renderQuantity`; the convert's
  // target is a bare word and does not — but it still asks the language for a
  // form key, with its own slot, which is what `seen` pins.
  expect(spyPrinterFor(locale).print(programFor("1 kg in g"), { spelled: true })).toBe(
    "[after-number]one|kilograms in grams",
  );
  expect(seen).toEqual(["after-number:kg", "conversion-target:g"]);
});

test("the printer tells the language which of form, symbol and alias it chose", () => {
  // The three come out of `unitLabel`'s three branches and mean different
  // things to a language: a word takes a space, a glyph sits tight, and an
  // alias is neither the unit's key nor a word anyone translated. Passing the
  // alias as `unit` would print length's registry key "m" here, not "metre".
  const locale = spyLanguage({
    renderQuantity: (p) =>
      p.form !== undefined
        ? `${p.number}F(${p.form})`
        : p.symbol !== undefined
          ? `${p.number}S(${p.symbol})`
          : p.alias !== undefined
            ? `${p.number}A(${p.alias})`
            : `${p.number}U(${p.unit})`,
  });
  const printerHere = spyPrinterFor(locale);
  const program = programFor("10 m + 5 km");
  const resolution = solver.best(program);
  expect(printerHere.print(program, { mode: "resolved", resolution })).toBe(
    "10A(metre) + 5A(km)",
  );
  expect(printerHere.print(programFor("3 m2"), { symbols: true })).toBe("3S(m²)");
  expect(printerHere.print(programFor("30 deg"), { spelled: true })).toBe(
    "thirtyF(degrees)",
  );
});

test("the printer hands the language the gap its spacing option resolved", () => {
  // `spacing` is the caller's override of the language's own convention, so
  // the language has to be told what it resolved to — a language that
  // assembles its own quantity would otherwise silently ignore `tight`.
  const gaps: string[] = [];
  const locale = spyLanguage({
    renderQuantity: (p) => {
      gaps.push(p.gap ?? "<absent>");
      return `${p.number}${p.gap ?? " "}${p.alias ?? p.unit}`;
    },
  });
  const printerHere = spyPrinterFor(locale);
  expect(printerHere.print(programFor("1 kg + 500 g"), { spacing: "tight" })).toBe(
    "1kg+500g",
  );
  expect(printerHere.print(programFor("1 kg + 500 g"))).toBe("1 kg + 500 g");
  expect(gaps).toEqual(["", "", " ", " "]);
});

test("the printer assembles a spelled expression through the language", () => {
  // Word order is grammar: a language that puts its operator elsewhere, or
  // inflects around it, has to see the two rendered operands and the word
  // rather than receive a finished string built to English's shape.
  const seen: ExpressionParts[] = [];
  const locale = spyLanguage({
    renderExpression: (p) => {
      seen.push(p);
      return `${p.op}(${p.left}, ${p.right})`;
    },
  });
  expect(
    spyPrinterFor(locale).print(programFor("30 deg + 15 deg"), { spelled: true }),
  ).toBe("+(thirty degrees, fifteen degrees)");
  expect(seen.map((p) => p.word)).toEqual(["plus"]);
  // Digits keep the printer's own assembly: `ExpressionParts` carries no
  // separator, so routing an unspelled expression through it would lose
  // `spacing: "tight"` — see `printNode`'s binary case.
  expect(spyPrinterFor(locale).print(programFor("30 deg + 15 deg"))).toBe(
    "30 deg + 15 deg",
  );
  expect(seen).toHaveLength(1);
});

test("a spelled operator with no word reaches the language without one", () => {
  // The other half of "no invented word": the printer does not substitute the
  // symbol *for* the word before calling, it says there is no word and lets
  // the language decide — `defaultRenderExpression`'s `?? op` is what puts the
  // symbol back, the same answer a comparison operator (which has no `Keyword`
  // at all) gets.
  const { over: _over, ...restKeywords } = english.keywords;
  const locale = spyLanguage({
    keywords: restKeywords,
    renderExpression: (p) => `${p.left} ${p.word ?? `<${p.op}>`} ${p.right}`,
  });
  expect(spyPrinterFor(locale).print(programFor("10 km / 2 km"), { spelled: true })).toBe(
    "ten kilometres </> two kilometres",
  );
});

// --- value(): today's formatValue, byte-identical -----------------------

const massValue: Value = Object.freeze({
  kind: "mass",
  canonical: new Decimal("1500"),
  unit: "kg",
});

test("value(): matches formatValue with no options", () => {
  // Pinned to the literal string, not a second `formatValue(massValue, ...)`
  // call — see the two "resolved" tests above for why a live-vs-live
  // comparison would let a bug that broke both sides identically slip
  // through.
  expect(printer.value(massValue)).toBe("1.5 kilograms");
});

// `massValue` above terminates at "1.5" under every precision from here on,
// so it cannot tell a caller's `precision`/`rounding` option apart from it
// being silently dropped — every one of the four tests below would still
// pass against a `Printer.value` that ignored the option entirely. A
// repeating decimal (10 / 3) is what makes the option's effect show up in
// the last printed digit.
const repeating: Value = Object.freeze({
  kind: "mass",
  canonical: new Decimal(10).dividedBy(3),
  unit: "g",
});

test("value(): matches formatValue with an explicit precision", () => {
  // Default precision (26 significant digits) would print
  // "3.3333333333333333333333333 grams" — visibly different from this, so a
  // regression that stopped forwarding `precision` fails this assertion.
  expect(printer.value(repeating, { precision: 4 })).toBe("3.333 grams");
});

// `formatValue`'s default rendering path (`format/format.ts`) deliberately
// strips `rounding` before it ever reaches `formatNumber` — it is a money-hook
// concern, not a generic-quantity one (see that file's own comment) — so no
// built-in kind's default path can make a `rounding` option observable at
// all. A kind with its own `format` hook that forwards `ctx.rounding`
// explicitly is what closes that gap for this test.
const roundable = defineKind({
  id: "roundable",
  value: { mode: "ratio", canonical: "u", units: { u: 1 } },
  format: (_v, ctx) =>
    `${ctx.formatNumber(ctx.authored, {
      ...(ctx.rounding === undefined ? {} : { rounding: ctx.rounding }),
      precision: ctx.precision ?? 5,
    })}u`,
});
const roundableRegistry = buildRegistry([...BUILTIN_KINDS, roundable], [en]);
const roundableValue: Value = Object.freeze({
  kind: "roundable",
  canonical: new Decimal(10).dividedBy(3),
  unit: "u",
});

test("value(): folds the printer's own rounding into the call", () => {
  const withRounding = new Printer({
    registry: roundableRegistry,
    locale: en,
    rounding: Decimal.ROUND_UP,
  });
  expect(withRounding.value(roundableValue)).toBe("3.3334u");
});

test("value(): a caller's own rounding overrides the printer's configured one", () => {
  const withRounding = new Printer({
    registry: roundableRegistry,
    locale: en,
    rounding: Decimal.ROUND_UP,
  });
  // ROUND_DOWN here, not ROUND_UP: if the caller's own option failed to
  // override the printer's configured one, this would still read "3.3334u".
  expect(withRounding.value(roundableValue, { rounding: Decimal.ROUND_DOWN })).toBe(
    "3.3333u",
  );
});

// Mirrors evaluator.test.ts's `coin` fixture: a unit ratio that reads
// `ctx.rates`, unlike `massValue`'s "mass", whose units never do — the reason
// the original version of this test passed with `rates.get` always
// returning `null`.
const coin = defineKind({
  id: "coin",
  value: {
    mode: "ratio",
    canonical: "tok",
    units: {
      tok: 1,
      usd: { ratio: (ctx) => ctx.rates?.get("usd", "tok") ?? new Decimal(1) },
    },
  },
});
const coinRegistry = buildRegistry([...BUILTIN_KINDS, coin], [en]);
const coinValue: Value = Object.freeze({
  kind: "coin",
  canonical: new Decimal("10"),
  unit: "usd",
});

test("value(): folds the printer's own rates into the call", () => {
  const rates: RateLookup = {
    base: "usd",
    asOf: "2026-01-01",
    get: () => new Decimal("2"),
  };
  const withRates = new Printer({ registry: coinRegistry, locale: en, rates });
  // 10 tok / 2 = "5 usd". Without `rates` reaching the call, the ratio falls
  // back to 1 and this would read "10 usd" instead — the next assertion pins
  // down that that fallback is real, not a second way to reach "5 usd".
  //
  // The space is `defaultRenderQuantity`'s third branch: `coin` is a fixture
  // kind with no vocabulary installed at all, so it has neither a word nor a
  // symbol and degrades to its registry key (I10). Every shipped `en`
  // vocabulary carries a symbol (ruling R8), which is why nothing in the
  // parity corpus reaches this branch.
  expect(withRates.value(coinValue)).toBe("5 usd");
  const noRates = new Printer({ registry: coinRegistry, locale: en });
  expect(noRates.value(coinValue)).toBe("10 usd");
});

// --- instance behaviour ---------------------------------------------------

test("Printer is frozen and stateless: two calls with the same input agree", () => {
  expect(Object.isFrozen(printer)).toBe(true);
  const program = programFor("1 kg + 500 g");
  expect(printer.print(program)).toBe(printer.print(program));
});

// --- tight symbols (ruling R-C1, spacing half) -----------------------------

test("a symbol takes a space unless its word declares itself tight", () => {
  // The default used to run the other way: a unit with no `forms` fell through
  // to its symbol and the renderer glued it to the number, so "100kph" and
  // "120bpm" were the NORMAL output and "1.5 kilograms" the exception. Reading
  // a flag instead of inferring one from the absence of a word is what makes
  // "50 km/h" and "5%" both right.
  const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
  expect(engine.evaluate("50 kph").formatted).toBe("50 km/h");
  expect(engine.evaluate("60 mph").formatted).toBe("60 mph");
  expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
  expect(engine.evaluate("5 percent").formatted).toBe("5%");
  expect(engine.evaluate("20 c").formatted).toBe("20°C");
});

test("print: `tight` glues the symbol the printer chose, and only the symbol", () => {
  // `symbols: true` is the one shipped path where `%` is labelled from its
  // `symbol` rather than from the alias the user typed; `tight` is read off
  // that label, so an alias-labelled print keeps the ordinary space.
  expect(printer.print(programFor("5 percent"), { symbols: true })).toBe("5%");
  expect(printer.print(programFor("5 percent"))).toBe("5 %");
  expect(printer.print(programFor("50 kph"), { symbols: true })).toBe("50 km/h");
});
