import { Decimal } from "@smartput/core";
import {
  AmbiguousQueryError,
  QueryParseError,
  UnknownColumnError,
  UnsupportedQueryError,
} from "./errors";
import type {
  Aggregate,
  ColumnRef,
  CompareOp,
  JoinStep,
  Literal,
  OrderTerm,
  Phrase,
  Predicate,
  Projection,
  QueryIr,
} from "./ir";
import { geoOf, isMidnight, type OperandReader, type Reading, rangeOf } from "./link";
import type { LexEntry, Schema } from "./schema";
import { MAX_PHRASE_WORDS, type QueryVocabulary, queryEn } from "./vocabulary";

/** Nanoseconds in a day, for the one case that has to widen a date into a span. */
const NS_PER_DAY = 86_400_000_000_000;

interface Tok {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Characters that are their own token however they are written, so `(a,b)` and
 * `total>500` lex the same as their spaced forms. Comparison characters are
 * consumed as a run, which is what makes `>=`, `<=`, `<>` and `!=` single
 * tokens without a table of two-character sequences.
 */
const SOLO = new Set(["(", ")", ","]);
const CMP_CHARS = new Set(["<", ">", "=", "!", "≤", "≥", "≠"]);

export function lex(input: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (SOLO.has(ch)) {
      i++;
    } else if (CMP_CHARS.has(ch)) {
      while (i < input.length && CMP_CHARS.has(input[i] as string)) i++;
    } else {
      while (i < input.length) {
        const c = input[i] as string;
        if (/\s/.test(c) || SOLO.has(c) || CMP_CHARS.has(c)) break;
        i++;
      }
    }
    out.push({ text: input.slice(start, i), start, end: i });
  }
  return out;
}

export interface QueryParserOptions {
  readonly schema: Schema;
  readonly reader: OperandReader;
  readonly vocabulary?: QueryVocabulary;
}

/**
 * The clause grammar, and everything ruling R1 says core cannot host.
 *
 * It is a hand-written descent rather than a table-driven parser because the
 * two decisions that matter are not grammatical: whether a word names a column
 * or a value, and whether a comparison's left side was written at all. Both are
 * settled by asking the schema and the engine mid-parse, which is exactly what
 * a generated parser makes awkward and what a descent makes ordinary.
 *
 * It produces a finished `QueryIr`. There is no unlinked intermediate tree,
 * deliberately: an intermediate would have to represent "a phrase that might be
 * a column", and every consumer of it would have to re-ask the question this
 * class already answered.
 */
export class QueryParser {
  private readonly schema: Schema;
  private readonly reader: OperandReader;
  private readonly v: QueryVocabulary;

  private input = "";
  private toks: Tok[] = [];
  private i = 0;
  private source = "";
  private readonly joins: JoinStep[] = [];

  constructor(opts: QueryParserOptions) {
    this.schema = opts.schema;
    this.reader = opts.reader;
    this.v = opts.vocabulary ?? queryEn;
  }

  run(input: string): QueryIr {
    this.input = input;
    this.toks = lex(input);
    this.i = 0;
    this.source = "";
    this.joins.length = 0;

    if (this.toks.length === 0) throw new QueryParseError(input, "the input is empty");

    let distinct = false;
    let limit: number | undefined;
    const projection: Projection[] = [];
    const order: OrderTerm[] = [];
    const group: ColumnRef[] = [];
    const where: Predicate[] = [];
    const having: Predicate[] = [];

    if (this.take(this.v.distinct) !== null) distinct = true;

    // `top N` may lead the input or arrive as a clause; both set the same two
    // fields, so it is parsed in one place and consulted in both.
    let topPending = false;
    if (this.take(this.v.top) !== null) {
      limit = this.number("top");
      topPending = true;
    }

    for (const p of this.projections()) projection.push(p);
    this.readSource(projection);

    while (this.i < this.toks.length) {
      if (this.take(this.v.where) !== null) {
        this.predicate(this.segment(), where, having);
        continue;
      }
      if (this.take(this.v.orderBy) !== null) {
        order.push(this.orderTerm());
        continue;
      }
      if (this.take(this.v.limit) !== null) {
        limit = this.number("limit");
        continue;
      }
      if (this.take(this.v.top) !== null) {
        limit = this.number("top");
        topPending = true;
        continue;
      }
      // `by` is the ranking expression after `top N` and the grouping column
      // everywhere else. One word, two jobs, and the pending flag is the only
      // thing that distinguishes them — which is why it is a flag and not a
      // second vocabulary entry nobody would know when to type.
      if (this.take(this.v.groupBy) !== null) {
        if (topPending) {
          topPending = false;
          order.push({ term: this.projectionTerm(), direction: "desc" });
        } else {
          group.push(this.groupColumn());
        }
        continue;
      }
      this.predicate(this.segment(), where, having);
    }

    // An aggregate anywhere in the query forces a group, and the identity of
    // the source is what it groups by unless the query named something else.
    // Without this, `top 10 customers by revenue` is one row: the revenue of
    // every customer at once.
    const aggregated =
      projection.some(isAggregate) ||
      order.some((o) => isAggregate(o.term)) ||
      having.length > 0;
    const plainColumns = projection.filter((p) => !isAggregate(p));
    if (aggregated && group.length === 0) {
      if (plainColumns.length > 0) {
        for (const p of plainColumns) if (p.type === "column") group.push(p.column);
      } else if (order.some((o) => isAggregate(o.term)) || having.length > 0) {
        // A bare `count orders` groups by nothing and is a single number. A
        // ranking by an aggregate is the opposite — one row per thing ranked —
        // and so is a filter on one: `customers with more than 10 orders` is
        // about each customer, and without a group it is about all of them at
        // once, which is a `HAVING` over a single row and always either every
        // customer or none.
        group.push(...this.schema.identity(this.source));
      }
    }
    // A ranking nobody can see is not much of a ranking: an aggregate the query
    // sorted by is projected alongside the columns, so the number that decided
    // the order comes back with the rows.
    for (const o of order) {
      if (!isAggregate(o.term)) continue;
      if (!projection.some((p) => sameProjection(p, o.term))) projection.push(o.term);
    }

    // Grouping columns have to be selectable, or the result is a list of
    // aggregates with nothing to attach them to.
    if (group.length > 0) {
      const missing = group
        .filter(
          (g) => !projection.some((p) => p.type === "column" && sameRef(p.column, g)),
        )
        .map((column): Projection => ({ type: "column", column }));
      // Spliced at the front in the order the group declares, not unshifted one
      // at a time: unshifting reverses, and `GROUP BY id, name` selecting `name,
      // id` is the kind of difference nobody notices until a UI renders columns
      // positionally.
      projection.splice(0, 0, ...missing);
    }

    return {
      source: this.source,
      joins: [...this.joins],
      projection,
      ...(where.length > 0 ? { predicate: all(where) } : {}),
      ...(having.length > 0 ? { having: all(having) } : {}),
      group,
      order,
      ...(limit === undefined ? {} : { limit }),
      distinct,
    };
  }

  // ---------------------------------------------------------------- tokens

  private peek(offset = 0): Tok | undefined {
    return this.toks[this.i + offset];
  }

  /** The folded text of `n` tokens from the cursor, joined by single spaces. */
  private words(n: number, from = this.i): string | null {
    if (from + n > this.toks.length) return null;
    const parts: string[] = [];
    for (let k = 0; k < n; k++)
      parts.push((this.toks[from + k] as Tok).text.toLowerCase());
    return parts.join(" ");
  }

  private phrase(from: number, to: number): Phrase {
    const first = this.toks[from] as Tok;
    const last = this.toks[to - 1] as Tok;
    return {
      text: this.input.slice(first.start, last.end),
      start: first.start,
      end: last.end,
    };
  }

  /** Longest matching phrase from a list, consumed. Null when none matches. */
  private take(phrases: readonly string[]): string | null {
    for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
      const w = this.words(n);
      if (w !== null && phrases.includes(w)) {
        this.i += n;
        return w;
      }
    }
    return null;
  }

  /** Longest matching key of a table, consumed, with its value. */
  private takeMap<T>(table: Readonly<Record<string, T>>): T | null {
    for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
      const w = this.words(n);
      if (w !== null && Object.hasOwn(table, w)) {
        this.i += n;
        return table[w] as T;
      }
    }
    return null;
  }

  private at(phrases: readonly string[], from = this.i): number {
    for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
      const w = this.words(n, from);
      if (w !== null && phrases.includes(w)) return n;
    }
    return 0;
  }

  private number(what: string): number {
    const tok = this.peek();
    if (tok === undefined) throw new QueryParseError(this.input, `${what} needs a count`);
    // Spelled counts go through the engine, so "top ten" and "top 10" agree
    // without this package carrying a second table of cardinals.
    const direct = Number(tok.text);
    if (Number.isFinite(direct)) {
      this.i++;
      return Math.trunc(direct);
    }
    const readings = this.reader.read({ text: tok.text, start: tok.start, end: tok.end });
    const numeric = readings.find((r) => r.value.kind === "number");
    if (numeric === undefined) {
      throw new QueryParseError(this.input, `${what} needs a count, not "${tok.text}"`);
    }
    this.i++;
    return numeric.value.canonical.toNumber();
  }

  // ------------------------------------------------------------ vocabulary

  /** The longest schema phrase at `from`, with the tokens it spans. */
  private schemaAt(from: number): { entries: readonly LexEntry[]; words: number } | null {
    for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
      const w = this.words(n, from);
      if (w === null) continue;
      const entries = this.schema.lookup(w);
      if (entries.length > 0) return { entries, words: n };
    }
    return null;
  }

  // ----------------------------------------------------------- projections

  private projections(): Projection[] {
    const out: Projection[] = [];
    for (;;) {
      const before = this.i;
      const term = this.tryProjectionTerm();
      if (term === null) {
        this.i = before;
        return out;
      }
      // A leading term that is a plain column of a table the query has not
      // named yet is the *source*, not a projection: `orders where …` opens
      // with a table word. Only aggregates and metrics may lead.
      if (term.type === "column" && out.length === 0) {
        this.i = before;
        return out;
      }
      out.push(term);
      if (this.take(this.v.and) === null) return out;
    }
  }

  /** A projection term, or null if the cursor is not on one. */
  private tryProjectionTerm(): Projection | null {
    const start = this.i;
    const fn = this.takeMap(this.v.aggregates);
    if (fn !== null) {
      this.take(this.v.of);
      const hit = this.schemaAt(this.i);
      if (hit === null) {
        // "total" with nothing behind it is a column named total, not a sum of
        // nothing. Backing out here is what lets one word be both.
        this.i = start;
        return this.plainTerm();
      }
      const entry = this.pick(hit.entries, this.phrase(this.i, this.i + hit.words));
      this.i += hit.words;
      if (entry.type === "metric") {
        // A metric already carries its own function, so "total revenue" is
        // revenue. Letting the outer word win would make it sum(sum(x)).
        const aggregate = aggregateOf(entry.metric, this.schema);
        this.useAggregate(aggregate);
        return { type: "aggregate", aggregate };
      }
      if (entry.type === "table") {
        if (fn !== "count") {
          throw new UnsupportedQueryError(
            this.input,
            `${fn} of a table`,
            "only count applies to rows; name a column",
          );
        }
        this.use(entry.table);
        return { type: "aggregate", aggregate: { fn: "count", table: entry.table } };
      }
      this.use(entry.ref.table);
      return { type: "aggregate", aggregate: { fn, column: entry.ref } };
    }
    return this.plainTerm();
  }

  private plainTerm(): Projection | null {
    const hit = this.schemaAt(this.i);
    if (hit === null) return null;
    const entry = this.pick(hit.entries, this.phrase(this.i, this.i + hit.words));
    if (entry.type === "table") return null;
    this.i += hit.words;
    if (entry.type === "metric") {
      const aggregate = aggregateOf(entry.metric, this.schema);
      this.useAggregate(aggregate);
      return { type: "aggregate", aggregate };
    }
    this.use(entry.ref.table);
    return { type: "column", column: entry.ref };
  }

  /** A projection term that must be there. */
  private projectionTerm(): Projection {
    const term = this.tryProjectionTerm();
    if (term === null) {
      const tok = this.peek();
      const word = tok?.text ?? "";
      throw new UnknownColumnError(this.input, word, this.schema.nearest(word));
    }
    return term;
  }

  private orderTerm(): OrderTerm {
    const term = this.projectionTerm();
    if (this.take(this.v.descending) !== null) return { term, direction: "desc" };
    this.take(this.v.ascending);
    return { term, direction: "asc" };
  }

  private groupColumn(): ColumnRef {
    const term = this.projectionTerm();
    if (term.type !== "column") {
      throw new UnsupportedQueryError(
        this.input,
        "grouping by an aggregate",
        "name a column",
      );
    }
    return term.column;
  }

  // ---------------------------------------------------------------- source

  /**
   * The table everything else is relative to.
   *
   * Named explicitly when the input has a table word, and otherwise inferred
   * from the first projection — `sum of total by country` never says "orders",
   * and the column it sums is the only thing that could have told it.
   */
  private readSource(projection: readonly Projection[]): void {
    const hit = this.schemaAt(this.i);
    if (hit !== null) {
      const entry = hit.entries.find((e) => e.type === "table");
      if (entry !== undefined && entry.type === "table") {
        this.i += hit.words;
        this.source = entry.table;
        return;
      }
    }
    for (const p of projection) {
      const table =
        p.type === "column"
          ? p.column.table
          : (p.aggregate.column?.table ?? p.aggregate.table);
      if (table !== undefined) {
        this.source = table;
        // The joins recorded while parsing projections were recorded against no
        // source at all; now that there is one, they are re-derived from it.
        this.joins.length = 0;
        this.use(table);
        return;
      }
    }
    const tok = this.peek();
    const word = tok?.text ?? "";
    throw new UnknownColumnError(this.input, word, this.schema.nearest(word));
  }

  /** The table an aggregate reads, brought into scope. */
  private useAggregate(a: Aggregate): void {
    const table = a.column?.table ?? a.table;
    if (table !== undefined) this.use(table);
  }

  /** Bring a table into scope, joining it to the source if it is not there yet. */
  private use(table: string): void {
    if (this.source === "" || table === this.source) return;
    if (this.joins.some((j) => j.table === table)) return;
    for (const step of this.schema.path(this.input, this.source, table)) {
      if (!this.joins.some((j) => j.table === step.table)) this.joins.push(step);
    }
  }

  // ------------------------------------------------------------- predicate

  /** Tokens up to the next top-level clause word, consumed. */
  private segment(): { from: number; to: number } {
    const from = this.i;
    let depth = 0;
    while (this.i < this.toks.length) {
      const text = (this.peek() as Tok).text;
      if (text === "(") depth++;
      else if (text === ")") depth--;
      if (depth === 0) {
        // `between X and Y` owns the `and` inside it, so a segment must not end
        // on a clause word that a `between` is still waiting for. Only the
        // top-level scan needs this; the conjunct splitter below repeats it.
        const stop =
          this.at(this.v.where) ||
          this.at(this.v.orderBy) ||
          this.at(this.v.limit) ||
          this.at(this.v.top) ||
          this.at(this.v.groupBy);
        if (stop > 0 && this.i > from) break;
      }
      this.i++;
    }
    if (this.i === from) throw new QueryParseError(this.input, "an empty clause");
    return { from, to: this.i };
  }

  /** Parse one segment and file each conjunct under `where` or `having`. */
  private predicate(
    range: { from: number; to: number },
    where: Predicate[],
    having: Predicate[],
  ): void {
    for (const p of this.conjuncts(range)) {
      (mentionsAggregate(p) ? having : where).push(p);
    }
  }

  /**
   * Split a segment on `and`/`or` at depth zero and read each piece.
   *
   * `or` is folded into a single disjunction over the whole segment rather than
   * given a precedence of its own, and mixed `and`/`or` without parentheses is
   * refused. English does not agree with itself about which binds tighter —
   * "customers in kyiv or lviv with orders" has two readings and native
   * speakers split on them — so guessing here would be guessing about the user's
   * intent, which ruling R7 says to refuse rather than do.
   */
  private conjuncts(range: { from: number; to: number }): Predicate[] {
    const pieces: Array<{ from: number; to: number }> = [];
    const joiners: string[] = [];
    let depth = 0;
    let start = range.from;
    let betweenOpen = false;
    for (let k = range.from; k < range.to; ) {
      const text = (this.toks[k] as Tok).text;
      if (text === "(") depth++;
      else if (text === ")") depth--;
      if (depth === 0) {
        if (this.at(this.v.between, k) > 0) betweenOpen = true;
        const andN = this.at(this.v.and, k);
        const orN = this.at(this.v.or, k);
        if (betweenOpen && andN > 0) {
          betweenOpen = false;
          k += andN;
          continue;
        }
        if ((andN > 0 || orN > 0) && k > start) {
          pieces.push({ from: start, to: k });
          joiners.push(andN > 0 ? "and" : "or");
          k += andN > 0 ? andN : orN;
          start = k;
          continue;
        }
      }
      k++;
    }
    if (start < range.to) pieces.push({ from: start, to: range.to });

    const parts = pieces.map((p) => this.comparison(p));
    if (joiners.length === 0 || joiners.every((j) => j === "and")) return parts;
    if (joiners.every((j) => j === "or")) return [{ type: "or", terms: parts }];
    throw new UnsupportedQueryError(
      this.input,
      "mixing and/or without parentheses",
      "parenthesise the group you mean",
    );
  }

  /** One comparison: the piece of grammar every other rule funnels into. */
  private comparison(range: { from: number; to: number }): Predicate {
    let from = range.from;
    const to = range.to;

    // Parentheses around a whole piece are a nested predicate, and the only
    // recursion in the grammar.
    if (
      (this.toks[from] as Tok).text === "(" &&
      (this.toks[to - 1] as Tok).text === ")"
    ) {
      const inner = this.conjuncts({ from: from + 1, to: to - 1 });
      return inner.length === 1 ? (inner[0] as Predicate) : { type: "and", terms: inner };
    }

    let negated = false;
    const notN = this.at(this.v.not, from);
    if (notN > 0 && to - from > notN) {
      negated = true;
      from += notN;
    }

    // The left side, when there is one. A piece may open with a comparison
    // word — "over €500" — and then the column is found from the value's kind.
    let target: Projection | null = null;
    const hit = this.schemaAt(from);
    if (hit !== null) {
      const save = this.i;
      this.i = from;
      const term = this.tryProjectionTerm();
      if (term !== null && this.i <= to) {
        target = term;
        from = this.i;
      }
      this.i = save;
    }

    const wrap = (p: Predicate): Predicate => (negated ? { type: "not", term: p } : p);

    // `is null` / `is not null`, which need a target and no operand.
    const isNotN = this.at(this.v.isNot, from);
    const isN = this.at(this.v.is, from);
    const nullAt = isNotN > 0 ? from + isNotN : isN > 0 ? from + isN : -1;
    if (nullAt >= 0 && this.at(this.v.empty, nullAt) > 0) {
      if (target === null)
        throw new QueryParseError(this.input, "`is null` needs a column");
      return wrap({ type: "null", target, negated: isNotN > 0 });
    }

    // `within <distance> of <place>`
    const withinN = this.at(this.v.within, from);
    if (withinN > 0) return wrap(this.near(from + withinN, to));

    // `between X and Y`. The `and` was left in place by the splitter above.
    const betweenN = this.at(this.v.between, from);
    if (betweenN > 0) {
      if (target === null)
        throw new QueryParseError(this.input, "`between` needs a column");
      return wrap(this.between(target, from + betweenN, to));
    }

    // A comparison word, written or symbolic.
    const save = this.i;
    this.i = from;
    const op = this.takeMap(this.v.comparisons);
    const afterOp = this.i;
    this.i = save;
    if (op !== null) {
      return wrap(this.compare(target, op, afterOp, to));
    }

    // `is` / `is not` with an operand behind them is equality.
    if (isNotN > 0 || isN > 0) {
      const eq: CompareOp = isNotN > 0 ? "!=" : "=";
      return wrap(this.compare(target, eq, from + (isNotN > 0 ? isNotN : isN), to));
    }

    // Containment, and the bare case. Both mean "this value belongs to this
    // column", and which predicate that becomes is decided by what the value
    // turns out to be — a range becomes an interval, everything else equality.
    let operandFrom = from;
    const containsN = this.at(this.v.contains, operandFrom);
    if (containsN > 0 && to - operandFrom > containsN) operandFrom += containsN;
    else {
      const prepN = this.at(this.v.prepositions, operandFrom);
      if (prepN > 0 && to - operandFrom > prepN) operandFrom += prepN;
    }
    if (operandFrom >= to)
      throw new QueryParseError(this.input, "a comparison with no value");
    return wrap(this.contain(target, operandFrom, to));
  }

  private near(from: number, to: number): Predicate {
    const ofN = this.findPhrase(this.v.of, from, to);
    if (ofN === null) {
      throw new QueryParseError(this.input, "`within` needs `of <place>`");
    }
    const radius = this.readOne(this.phrase(from, ofN.at));
    const centre = this.readOne(this.phrase(ofN.at + ofN.words, to));
    const point = geoOf(centre.value);
    if (point === null) {
      throw new UnknownColumnError(
        this.input,
        centre.phrase.text,
        this.schema.nearest(centre.phrase.text),
      );
    }
    const table = this.schema.table(this.source);
    if (table.geo === undefined) {
      throw new UnsupportedQueryError(
        this.input,
        "a distance filter",
        `table "${this.source}" declares no lat/lon columns`,
      );
    }
    return {
      type: "near",
      lat: { table: this.source, column: table.geo.lat },
      lon: { table: this.source, column: table.geo.lon },
      centreLat: point.lat,
      centreLon: point.lon,
      radiusMetres: this.reader.toUnit(radius.value, "m").toNumber(),
      source: this.input.slice(
        (this.toks[from] as Tok).start,
        (this.toks[to - 1] as Tok).end,
      ),
    };
  }

  private between(target: Projection, from: number, to: number): Predicate {
    const andAt = this.findPhrase(this.v.and, from, to);
    if (andAt === null) throw new QueryParseError(this.input, "`between` needs `and`");
    const ref = columnOf(target, this.input);
    const low = this.reader.literal(this.input, this.phrase(from, andAt.at), ref);
    const high = this.reader.literal(
      this.input,
      this.phrase(andAt.at + andAt.words, to),
      ref,
    );
    return {
      type: "between",
      target,
      low: { type: "literal", literal: low },
      high: { type: "literal", literal: high },
      // A written range is inclusive at both ends: "between 500 and 900" means
      // 900 is in. Only a range *value* carries an exclusive end, and that path
      // is `contain` below, not this one.
      upperExclusive: false,
    };
  }

  private compare(
    target: Projection | null,
    op: CompareOp,
    from: number,
    to: number,
  ): Predicate {
    if (from >= to) throw new QueryParseError(this.input, "a comparison with no value");

    if (target === null) {
      // "more than 10 orders" — the noun at the end of the operand names what
      // is being counted, and the number in front of it is the value. This is
      // the only place a *table* word appears inside an operand, and it is why
      // `customers with more than 10 orders` needs no explicit metric.
      const tail = this.schemaAt(to - 1);
      if (tail !== null && to - from > 1) {
        const entry = tail.entries.find((e) => e.type === "table" || e.type === "metric");
        if (entry !== undefined) {
          const counted: Projection =
            entry.type === "metric"
              ? { type: "aggregate", aggregate: aggregateOf(entry.metric, this.schema) }
              : { type: "aggregate", aggregate: { fn: "count", table: entry.table } };
          if (entry.type === "table") this.use(entry.table);
          else if (entry.metric.column !== undefined) {
            this.use(entry.metric.column.slice(0, entry.metric.column.indexOf(".")));
          }
          const n = this.plainNumber(this.phrase(from, to - 1));
          return { type: "compare", target: counted, op, operand: literalOf(n) };
        }
      }
      const attached = this.attach(from, to);
      return {
        type: "compare",
        target: { type: "column", column: attached.ref },
        op,
        operand: {
          type: "literal",
          literal: this.reader.fromValue(
            this.schema.column(attached.ref),
            attached.reading.value,
            attached.reading.phrase.text,
          ),
        },
      };
    }

    const ref = columnOf(target, this.input);
    return {
      type: "compare",
      target,
      op,
      operand: {
        type: "literal",
        literal: this.reader.literal(this.input, this.phrase(from, to), ref),
      },
    };
  }

  /**
   * Containment and the bare operand — ruling R8's main road.
   *
   * The predicate that comes out is decided by the *value*, not by the words:
   * a range becomes a half-open interval, a comma-separated list becomes `IN`,
   * a date against a timestamp column becomes the day it names, and everything
   * else becomes equality.
   */
  private contain(target: Projection | null, from: number, to: number): Predicate {
    const commas = this.splitCommas(from, to);
    if (commas.length > 1 && target !== null) {
      const ref = columnOf(target, this.input);
      return {
        type: "in",
        target,
        values: commas.map((c) => ({
          type: "literal" as const,
          literal: this.reader.literal(this.input, this.phrase(c.from, c.to), ref),
        })),
      };
    }

    if (target === null) {
      const attached = this.attach(from, to);
      return this.fromReading(
        { type: "column", column: attached.ref },
        attached.ref,
        attached.reading,
      );
    }

    const ref = columnOf(target, this.input);
    const col = this.schema.column(ref);
    if (col.kind === undefined) {
      return {
        type: "compare",
        target,
        op: "=",
        operand: {
          type: "literal",
          literal: this.reader.literal(this.input, this.phrase(from, to), ref),
        },
      };
    }
    const phrase = this.phrase(from, to);
    const readings = this.reader.read(phrase);
    const usable = readings.find((r) => this.acceptable(col.kind as string, r));
    if (usable === undefined) {
      return {
        type: "compare",
        target,
        op: "=",
        operand: {
          type: "literal",
          literal: this.reader.literal(this.input, phrase, ref),
        },
      };
    }
    return this.fromReading(target, ref, usable);
  }

  /** Turn one reading into the predicate its shape implies. */
  private fromReading(target: Projection, ref: ColumnRef, reading: Reading): Predicate {
    const col = this.schema.column(ref);
    const ends = rangeOf(reading.value);
    if (ends !== null) {
      return {
        type: "between",
        target,
        low: literalOf(instant(ends.start, reading.phrase.text)),
        high: literalOf(instant(ends.end, reading.phrase.text)),
        // The range packages store their end exclusive, and this is the one
        // place that fact leaves the value model and becomes a `<`.
        upperExclusive: true,
      };
    }
    // A calendar day against a timestamp column is the whole day, not the
    // instant of its midnight — and a `datetime` reading that lands exactly on
    // midnight named a day too, which is what `isMidnight` is for: `yesterday`
    // reads as an instant here and means the day, while `3pm` reads as an
    // instant and means the instant. The span is added in nanoseconds rather
    // through a calendar, so a query whose day contains a DST transition is
    // off by the hour that transition moved; a consumer who needs that exact
    // should phrase the filter as a range, which carries real calendar ends.
    if (
      col.kind === "datetime" &&
      (reading.value.kind === "date" ||
        (reading.value.kind === "datetime" && isMidnight(reading.value)))
    ) {
      const startNs = reading.value.canonical;
      return {
        type: "between",
        target,
        low: literalOf({
          value: new Date(startNs.div(1_000_000).toNumber()),
          decimal: startNs,
          kind: "date",
          source: reading.phrase.text,
        }),
        high: literalOf({
          value: new Date(startNs.plus(NS_PER_DAY).div(1_000_000).toNumber()),
          decimal: startNs.plus(NS_PER_DAY),
          kind: "date",
          source: reading.phrase.text,
        }),
        upperExclusive: true,
      };
    }
    return {
      type: "compare",
      target,
      op: "=",
      operand: literalOf(this.reader.fromValue(col, reading.value, reading.phrase.text)),
    };
  }

  /** Kinds a column of `kind` accepts from a reading. */
  private acceptable(kind: string, reading: Reading): boolean {
    const read = reading.value.kind;
    if (read === kind) return true;
    if (rangeOf(reading.value) !== null) {
      const base = read.replace(/-range$/, "");
      if (base === kind) return true;
      // A timestamp column filtered by a span of days is the ordinary case, and
      // the reverse — a date column filtered by a span of instants — is the
      // same fact read the other way.
      if (
        (base === "date" && kind === "datetime") ||
        (base === "datetime" && kind === "date")
      ) {
        return true;
      }
      return false;
    }
    return (
      (read === "date" && kind === "datetime") || (read === "datetime" && kind === "date")
    );
  }

  private attach(from: number, to: number): { ref: ColumnRef; reading: Reading } {
    const phrase = this.phrase(from, to);
    const readings = this.reader.read(phrase);
    if (readings.length === 0) {
      // The whole phrase read as nothing, so the useful thing to report is the
      // word that was supposed to open it — "custmer is bob" is a misspelled
      // column, and an error naming the whole clause has no hint to offer.
      const word = (this.toks[from] as Tok).text;
      throw new UnknownColumnError(this.input, word, this.schema.nearest(word));
    }
    // A range reading has to look for a column of its *endpoint* kind, so the
    // widened kinds are offered alongside the literal one.
    const widened: Reading[] = readings.map((r) => r);
    const found = this.attachWidened(phrase, widened);
    this.use(found.ref.table);
    return found;
  }

  private attachWidened(
    phrase: Phrase,
    readings: readonly Reading[],
  ): { ref: ColumnRef; reading: Reading } {
    const hits: Array<{ ref: ColumnRef; reading: Reading }> = [];
    for (const reading of readings) {
      const kinds = new Set<string>([reading.value.kind]);
      if (rangeOf(reading.value) !== null) {
        const base = reading.value.kind.replace(/-range$/, "");
        kinds.add(base);
        if (base === "date") kinds.add("datetime");
        if (base === "datetime") kinds.add("date");
      } else if (reading.value.kind === "date") kinds.add("datetime");
      else if (reading.value.kind === "datetime") kinds.add("date");
      for (const kind of kinds) {
        for (const ref of this.reader.columnsForKind(this.source, kind)) {
          if (!hits.some((h) => sameRef(h.ref, ref))) hits.push({ ref, reading });
        }
      }
    }
    const first = hits[0];
    if (first === undefined) {
      throw new UnknownColumnError(
        this.input,
        phrase.text,
        this.schema.nearest(phrase.text),
      );
    }
    const tied = hits.filter((h) => h.reading === first.reading);
    if (tied.length > 1) {
      throw new AmbiguousQueryError(
        this.input,
        `"${phrase.text}" could filter more than one column`,
        tied.map((h) => `${h.ref.table}.${h.ref.column}`),
      );
    }
    return first;
  }

  private readOne(phrase: Phrase): Reading {
    const readings = this.reader.read(phrase);
    const first = readings[0];
    if (first === undefined) {
      throw new UnknownColumnError(
        this.input,
        phrase.text,
        this.schema.nearest(phrase.text),
      );
    }
    return first;
  }

  private plainNumber(phrase: Phrase): Literal {
    const reading = this.reader
      .read(phrase)
      .find((r) => r.value.kind === "number" || r.value.kind === "index");
    if (reading === undefined) {
      throw new QueryParseError(this.input, `"${phrase.text}" is not a count`);
    }
    const d = reading.value.canonical;
    return { value: d.toNumber(), decimal: d, kind: "number", source: phrase.text };
  }

  private findPhrase(
    phrases: readonly string[],
    from: number,
    to: number,
  ): { at: number; words: number } | null {
    let depth = 0;
    for (let k = from; k < to; k++) {
      const text = (this.toks[k] as Tok).text;
      if (text === "(") depth++;
      else if (text === ")") depth--;
      if (depth !== 0) continue;
      const n = this.at(phrases, k);
      if (n > 0) return { at: k, words: n };
    }
    return null;
  }

  private splitCommas(from: number, to: number): Array<{ from: number; to: number }> {
    const out: Array<{ from: number; to: number }> = [];
    let depth = 0;
    let start = from;
    for (let k = from; k < to; k++) {
      const text = (this.toks[k] as Tok).text;
      if (text === "(") depth++;
      else if (text === ")") depth--;
      else if (text === "," && depth === 0) {
        if (k > start) out.push({ from: start, to: k });
        start = k + 1;
      }
    }
    if (start < to) out.push({ from: start, to });
    return out;
  }

  /**
   * Choose among the entries one alias resolves to.
   *
   * Preference runs source, then any table already joined, then anything else —
   * which is the same nearest-first rule `columnsForKind` applies, stated once
   * more because this path starts from a word rather than from a kind.
   */
  private pick(entries: readonly LexEntry[], phrase: Phrase): LexEntry {
    if (entries.length === 1) return entries[0] as LexEntry;
    const rank = (e: LexEntry): number => {
      if (e.type === "table") return e.table === this.source ? 0 : 3;
      if (e.type === "metric") return 2;
      if (e.ref.table === this.source) return 0;
      return this.joins.some((j) => j.table === e.ref.table) ? 1 : 3;
    };
    const sorted = [...entries].sort((a, b) => rank(a) - rank(b));
    const best = sorted[0] as LexEntry;
    const tied = sorted.filter((e) => rank(e) === rank(best));
    if (tied.length > 1) {
      throw new AmbiguousQueryError(
        this.input,
        `"${phrase.text}" names more than one thing`,
        tied.map(describe),
      );
    }
    return best;
  }
}

const sameRef = (a: ColumnRef, b: ColumnRef): boolean =>
  a.table === b.table && a.column === b.column;

const isAggregate = (p: Projection): boolean => p.type === "aggregate";

/** Two projections naming the same thing. Aggregates compare by what they read,
 * so `revenue` and `sum of total` are one column in the output and not two. */
function sameProjection(a: Projection, b: Projection): boolean {
  if (a.type === "column" && b.type === "column") return sameRef(a.column, b.column);
  if (a.type === "aggregate" && b.type === "aggregate") {
    const x = a.aggregate;
    const y = b.aggregate;
    if (x.fn !== y.fn) return false;
    if (x.column === undefined || y.column === undefined) {
      return x.column === y.column && x.table === y.table;
    }
    return sameRef(x.column, y.column);
  }
  return false;
}

const literalOf = (literal: Literal) => ({ type: "literal" as const, literal });

const all = (parts: readonly Predicate[]): Predicate =>
  parts.length === 1 ? (parts[0] as Predicate) : { type: "and", terms: parts };

function mentionsAggregate(p: Predicate): boolean {
  switch (p.type) {
    case "compare":
    case "between":
    case "in":
    case "null":
      return p.target.type === "aggregate";
    case "and":
    case "or":
      return p.terms.some(mentionsAggregate);
    case "not":
      return mentionsAggregate(p.term);
    default:
      return false;
  }
}

function columnOf(target: Projection, input: string): ColumnRef {
  if (target.type === "column") return target.column;
  const ref = target.aggregate.column;
  if (ref === undefined) {
    throw new UnsupportedQueryError(
      input,
      "comparing a row count to a value",
      "name a column",
    );
  }
  return ref;
}

function aggregateOf(
  metric: { name: string; fn: Aggregate["fn"]; column?: string; table?: string },
  schema: Schema,
): Aggregate {
  if (metric.column === undefined) {
    return {
      fn: metric.fn,
      metric: metric.name,
      ...(metric.table === undefined ? {} : { table: metric.table }),
    };
  }
  const dot = metric.column.indexOf(".");
  const ref = {
    table: metric.column.slice(0, dot),
    column: metric.column.slice(dot + 1),
  };
  schema.column(ref);
  return { fn: metric.fn, column: ref, metric: metric.name };
}

const describe = (e: LexEntry): string =>
  e.type === "table"
    ? e.table
    : e.type === "metric"
      ? e.metric.name
      : `${e.ref.table}.${e.ref.column}`;

/** An ISO zoned string as a bindable instant. The `[Zone]` suffix is Temporal's
 * and `Date` cannot read it, so it is dropped — the offset in front of it
 * already carries the instant. */
function instant(iso: string, source: string): Literal {
  const plain = iso.replace(/\[[^\]]*\]$/, "");
  const date = new Date(plain);
  if (Number.isNaN(date.getTime())) {
    throw new QueryParseError(source, `"${iso}" is not an instant`);
  }
  return { value: date, decimal: new Decimal(date.getTime()), kind: "datetime", source };
}
