# Query Implementation Plan

**Goal:** Ship `@smartput/query`, so that `top 10 customers by spend last month` becomes a database query — in SQL, in MongoDB, or in a dialect a consumer wrote themselves — without a language model and without a string ever being concatenated into a statement.

**Architecture:** A clause grammar this package owns, sitting on top of a core `Engine` the consumer injects. The clause layer resolves tables, columns, comparisons and joins against a declared schema; the operand layer hands every value fragment to `engine.suggest()` and gets back kind-typed readings, which is how `500 eur`, `2 kg`, `last month` and `kyiv` are read without this package knowing what any of them are. The result is a dialect-free IR, and a `Compiler<T>` turns it into whatever the database speaks.

**Tech Stack:** TypeScript, Bun, Biome. One runtime dependency: `@smartput/core`.

---

## Rulings

**R1 — A query is not a kind, and core does not move.** `OpSymbol` is seven arithmetic and conversion operators with no comparison among them; `Keyword` is a closed set with no clause word in it; `Value.canonical` is a `Decimal`, and a relation is not a number. Registering a `query` kind would mean three new unions in core's types and a `format` hook that renders SQL. So the clause grammar lives here, and core is a dependency rather than a host. Precedent: `@smartput/shared` is already a second entry point into the same tables that is not the engine.

**R2 — Two layers, and the seam between them is a string.** The clause parser never looks inside an operand; it finds the operand's boundaries and passes that substring to `engine.suggest()`. Everything hard about reading `from monday until friday` is already solved on the other side of that call, and re-solving it here would be a second answer to a question that has one.

**R3 — The IR names no dialect.** `SqlCompiler` and `MongoCompiler` ship; `Compiler<T>` is the extension seam and takes the IR plus the schema. A dialect word appearing anywhere outside `sql.ts` and `mongo.ts` is the bug this ruling exists to make visible.

**R4 — Unit conversion happens at link time, never at compile time.** A column declares what it stores — `weight_g` is `{ kind: "mass", unit: "g" }` — and `2 kg` is converted into grams before it becomes a parameter. A compiler that converted would have to know what a kilogram is, and then every future compiler would have to know it too.

**R5 — Joins run along declared edges only, and only when the path is unique.** Two paths of equal length is an `AmbiguousJoinError`, not a tiebreak. A shortest-path heuristic here silently returns the wrong rows, and wrong rows are worse than no answer.

**R6 — Parameters always.** `SqlCompiler` has no code path that puts a value into text. Identifiers come from the schema and never from input, and are quoted per dialect. This is the one property a rules-only parser can offer that a language model cannot, so it is enforced by a test that greps the emitted SQL for every parameter's rendering.

**R7 — Refusal is a feature.** Correlated subqueries, set difference, nested aggregation and cross-sentence anaphora throw `UnsupportedQueryError` naming the construct. `AmbiguousQueryError` carries the readings, exactly as core's `AmbiguityError` does, and `QueryEngine.suggest()` returns them instead of throwing.

**R8 — An unattached operand finds its own column.** `orders over 500 usd` names no column. The operand resolves to a money value, exactly one column in scope is money, so that is the column. More than one is an `AmbiguousQueryError` listing them; none is an `UnknownColumnError`. This is the whole reason the kind system is underneath: the type of the value the user typed is the schema-linking signal.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `packages/query/src/errors.ts` | the five errors, all `SmartputError` |
| `packages/query/src/schema.ts` | `QuerySchema`, `TableDef`, `ColumnDef`, `MetricDef`, `JoinEdge`, and the `Schema` class that indexes and walks them |
| `packages/query/src/ir.ts` | `QueryIr` and everything under it |
| `packages/query/src/vocabulary.ts` | clause words, comparison words, the English default |
| `packages/query/src/parse.ts` | `QueryParser` — lex, recursive descent, and the schema linking that goes with it, straight to `QueryIr` |
| `packages/query/src/link.ts` | `OperandReader` — values through the engine, R4 conversion, R8 column-finding, the structural `rangeOf`/`geoOf`/`isMidnight` readers |
| `packages/query/src/compile.ts` | `Compiler<T>` and `CompilerOptions` |
| `packages/query/src/sql.ts` | `SqlCompiler` |
| `packages/query/src/mongo.ts` | `MongoCompiler` |
| `packages/query/src/query.ts` | `QueryEngine` — the public door |
| `packages/query/src/index.ts` | barrel |
| `packages/query/src/shop.fixture.ts` | the worked engine and schema every test runs against |

**Modified:** `scripts/check-deps.ts` (ALLOWED entry, and a `.fixture.ts` skip beside the existing `.test.ts` one), `scripts/check-size.ts` (three budget rows), `docs/guide/roadmap.md`, `docs/.vitepress/locales/en.ts`.

**Revised during implementation.** There is no unlinked intermediate tree: an
intermediate would have to represent "a phrase that might be a column", and
every consumer of it would re-ask the question the parser already answered. So
`parse.ts` produces a finished `QueryIr` and the split between it and `link.ts`
is by *responsibility* — clause structure versus values and columns — rather
than by pass.

---

## Grammar

```
query      := projection* source clause*
projection := "count" | ("sum"|"total"|"average"|"avg"|"min"|"max") "of"? COLUMN | METRIC
source     := TABLE
clause     := "where" predicate
            | predicate                              -- bare, no "where"
            | ("group by" | "by" | "per") COLUMN
            | ("order by"|"sorted by"|"ordered by") EXPR DIRECTION?
            | "top" N ("by" EXPR)?
            | "limit" N
predicate  := or
or         := and ("or" and)*
and        := not (("and" | ",") not)*
not        := "not" not | primary
primary    := "(" predicate ")" | comparison
comparison := COLUMN CMP OPERAND
            | COLUMN "between" OPERAND "and" OPERAND
            | COLUMN ("is"|"is not") ("null"|"empty")
            | COLUMN "within" OPERAND "of" OPERAND   -- geo
            | CMP OPERAND                            -- unattached, see R8
            | OPERAND                                -- unattached equality/containment
```

`in` is containment and its meaning comes from the operand's kind: a range operand becomes `between`, a list becomes `IN`, anything else becomes equality. That is one word doing three jobs correctly rather than three words the user has to choose between.

---

## Tasks

- [x] **T0** — scaffold: `package.json`, `tsconfig.json`, `check-deps` entry.
- [x] **T1** — `errors.ts`, `ir.ts`, `schema.ts` with the `Schema` class: alias index over tables, columns and metrics; `join(from, to)` returning the unique path or throwing.
- [x] **T2** — `vocabulary.ts` and `parse.ts`: lexer, clause splitter, predicate descent. Tests assert tree shape only; nothing is linked yet.
- [x] **T3** — `link.ts`: column resolution, operand resolution through the engine, R4 conversion, R8 unattached columns, group inference for aggregates.
- [x] **T4** — `compile.ts` + `sql.ts`: parameterized emit, numbered and question placeholder styles, identifier quoting, join emission, the R6 grep test.
- [x] **T5** — `mongo.ts`: pipeline always, `find` shape when no join or group, `$lookup`/`$unwind`, `$geoWithin` for the geo predicate.
- [x] **T6** — `query.ts` + `index.ts`: `QueryEngine.compile/suggest/explain`, barrel.
- [x] **T7** — `corpus.test.ts` over the five tiers, both dialects; `check-size` rows measured, not guessed; roadmap row.

---

## Outcome

Shipped. 56 tests across four files, `bun run lint` clean, `check-deps` clean,
three measured `check-size` rows, and **no change to `@smartput/core`** — the
first milestone since M1 to take none.

Two defects found by the corpus and fixed rather than documented around:

- **Comma was a second spelling of `and`.** It cost the list form its separator:
  `status in pending, paid, shipped` split into three conjuncts and the last two
  read as columns that do not exist. One punctuation mark cannot be both, and
  the list is the one with no other spelling.
- **A midnight `datetime` reading compared as an instant.** `yesterday` reads as
  a `datetime` here, not a `date`, so it emitted `placed_at = <midnight>` and
  matched nothing. `isMidnight` distinguishes a phrase that named a day from one
  that named a time, and the first widens to its day.

One limit found and pinned by a test rather than fixed here, because the fix
belongs upstream: `last quarter` is not in the range packages' vocabulary, so it
reads as a single instant and narrows to that day. The predicate is legal and is
not what the phrase means.
