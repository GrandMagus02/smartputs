# Comparison Implementation Plan

**Goal:** `1000 mb = 1 gb` evaluates to `true`. So do `5 > 3`, `1 kg > 500 g`, `10 usd < 20 eur` and `today > yesterday`. Equality is tolerant by default and exact on request.

**Architecture:** Six new `OpSymbol`s, a `boolean` kind in a leaf package, and comparison signatures generated per kind by the same loop that already generates `+`, `-` and the number-scaling trio. The solver does not move: a comparison unifies its operand kinds exactly as `+` does, which is what makes `1000 mb = 1 gb` resolve both sides to `datasize` and `1 kg > 500 g` resolve both to `mass`.

---

## Rulings

**C1 — A boolean is a kind, and it is opaque.** A ratio-mode boolean would have `+`, `-` and the number-scaling trio generated for it, and `true * 3` is not a thing. Opaque generates no arithmetic, which is exactly right; `canonical` is `1` or `0` so that ordering and equality still work without the engine knowing what truth is — the same trick `datetime` plays with epoch nanoseconds.

**C2 — Comparison binds looser than conversion.** `CONVERT_BINDING` is 5, so `COMPARE_BINDING` is 3: `1 kg in g > 500 g` is `(1 kg in g) > 500 g`, which is the only reading anyone means. Below every arithmetic binding for the same reason.

**C3 — Chained comparison is refused by construction, not by a check.** `1 < 2 < 3` parses left-associatively to `(1 < 2) < 3`, whose left operand is `boolean` and for which no signature exists, so it throws `DimensionMismatchError` like any other illegal pair. Adding a rule to detect chains would be a second mechanism saying what the op table already says.

**C4 — Equality is tolerant by default, at the precision the repo already displays.** Core computes at 28 significant digits and formats at 26 — "two guard digits", per `EngineOptions.formatPrecision`. Comparison uses the same 26, so two values that *print* identically *compare* identically. Without it `1 m / 3 * 3 = 1 m` is false, which is true of the arithmetic and useless to the person who typed it. `comparePrecision: "exact"` turns the guard off for a caller who wants the arithmetic.

**C5 — Ordering is generated for ratio kinds and opted into by opaque ones.** Every ratio kind's canonical is a magnitude on a line, so comparison is always meaningful. An opaque kind's canonical is whatever it chose — epoch nanoseconds for `datetime`, a GeoNames id for `place` — and only the kind knows which. `OpaqueSpec.ordered` is that opt-in; `place` must never acquire `>`, because comparing gazetteer ids is meaningless and would answer anyway.

**C6 — The same tolerance governs `>` and `<`, not just `=`.** Otherwise `a = b` and `a > b` could both be false for values one ulp apart, and a caller branching on the three outcomes would find a fourth.

---

## File Structure

**Modified — core:**

| File | Change |
| --- | --- |
| `src/types.ts` | `OpSymbol` gains six; `OpaqueSpec.ordered`; `EvalCtx.comparePrecision` |
| `src/parse/lex.ts` | two-character comparison operators |
| `src/parse/pratt.ts` | `COMPARE_BINDING`, and the six in `BINDING` |
| `src/kind/ratio-ops.ts` | `BOOLEAN_KIND`, `generateComparisonOps` |
| `src/kind/registry.ts` | call it beside `generateRatioOps` |
| `src/eval/evaluate.ts`, `evaluator.ts`, `engine.ts` | thread `comparePrecision` |

**Created:** `packages/boolean/*` — the kind, the `Bool` facade, `truthOf`.

**Modified — elsewhere:** `@smartput/kinds` (BUILTIN_KINDS), `datetime`/`date`/`time` (`ordered: true`), `check-deps`, `check-size`, docs.

---

## Tasks

- [x] **T1** — core types, lexer, Pratt binding. Tests: `1000 mb = 1 gb` tokenizes and parses to one comparison node.
- [x] **T2** — `BOOLEAN_KIND` and `generateComparisonOps`; registry wiring.
- [x] **T3** — `@smartput/boolean`: the kind, its format, `Bool`, `truthOf`. Register in `BUILTIN_KINDS`.
- [x] **T4** — `comparePrecision` threaded from `EngineOptions`/`EvalOptions` to `EvalCtx`; `"exact"` honoured.
- [x] **T5** — `ordered: true` on `datetime`, `date`, `time`.
- [x] **T6** — corpus, docs, `check-deps`, measured `check-size` rows.

---

## Outcome

Shipped. 18 tests in `@smartput/boolean`, 2739 across the repo, lint clean,
`check-deps` clean, budgets re-measured.

Core's cost was six `OpSymbol`s and two optional fields — `OpaqueSpec.ordered`
and `EvalCtx.comparePrecision`. The solver did not move, and neither did any
existing corpus row.

Four things the existing suite caught, each of which was the suite working:

- **The pinned op table grew by ninety-six keys.** Six per orderable kind,
  entirely generated, none refusing. Regenerated and re-pinned with the reason.
- **`boolean` is the first opaque kind in `BUILTIN_KINDS`.** Two invariants had
  assumed otherwise: `every built-in unit declares a typical band` (there is no
  magnitude to band) and the facade round-trip, which called `createFacade`
  directly where `createFacades` had always skipped opaque kinds. Both now state
  the rule instead of relying on the roster.
- **`meta` must not propagate through a comparison.** `deriveValue` carries the
  source operand's `meta` and every other signature is checked for it; a truth
  value has no unit for a dpi to qualify. The invariant now exempts the result
  kind and says why.
- **Eight size rows moved by 5-48 B.** Nothing in those packages changed — the
  generator, the lexer table and the binding entries are all in core, and core is
  in every bundle. Re-measured rather than silenced.

Two behaviours worth knowing, both correct and both surprising at first read:

- `1 kg = 500` is a `DimensionMismatchError`, exactly as `1 kg + 500` is. A bare
  number is a kind, and comparing a mass to 500 of nothing means no more than
  adding them.
- `10 m > 5 h` is `false`, not an error: `m` is minutes here, chosen by the
  operand beside it. Comparison inherits ambiguity resolution whole.

`2.54 cm = 1 in` does not parse, and that is pre-existing: `in` is the
conversion keyword as well as the inch alias.
