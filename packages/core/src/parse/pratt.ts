import { NoCandidateError, UnitParseError } from "../errors";
import { NUMBER_KIND } from "../kind/ratio-ops";
import type { Candidate, LiteralReading, OpSymbol, Span, Value } from "../types";
import type { Node } from "./ast";
import type { Resolver } from "./candidates";
import type { Token, WordToken } from "./lex";

/**
 * What the ordinary number under a claimed span scores, and the only weight in
 * this file that is not a matcher's or an analyzer's.
 *
 * A number is in nobody's alias index, so unlike the word fallback it has no
 * weight of its own to be scored by — and a claim that names no weight has to
 * keep beating it, or every matcher that starts claiming a bare number would
 * turn a formerly decided input into an `AmbiguityError` for saying nothing.
 * So the ordinary reading sits just below "claimed, unweighted", and a matcher
 * that means to *lose* to it says so: spec §6.2's `90210` is a number because
 * the postal claim weighs less than this, not because the fold hid it.
 *
 * The magnitude only has to clear `ambiguityEpsilon`, which compares softmax
 * confidences: 0.5 apart is 0.62 against 0.38, well outside the 0.05 default.
 */
export const NUMBER_FALLBACK_WEIGHT = -0.5;

const BINDING: Record<Exclude<OpSymbol, "in">, number> = {
  "+": 10,
  "-": 10,
  // Between + and *: "50 + 20% of 100" is 50 + (20% of 100). "of" arrives as
  // a *keyword* token, not an op token, so parseExpr reads this binding from
  // its own branch below rather than from the `token.op` lookup.
  of: 15,
  // The same binding, because "off" is "of" with different arithmetic and the
  // two have to group identically or "10 + 20% off 50" and "10 + 20% of 50"
  // would disagree about which addition happens first. Equal bindings are
  // fine here: the branches below recurse at `binding + 1`, so a chain stays
  // left-associative.
  off: 15,
  "*": 20,
  "/": 20,
};
const CONVERT_BINDING = 5;

export function parse(tokens: Token[], resolver: Resolver, input: string): Node {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const span = (a: Span, b: Span): Span => ({ start: a.start, end: b.end });

  const claimedValue = (r: LiteralReading): Value =>
    Object.freeze({
      kind: r.kind,
      canonical: r.canonical,
      unit: r.unit,
      ...(r.meta ? { meta: r.meta } : {}),
    });

  const candidateFor = (r: LiteralReading, surface: string): Candidate =>
    resolver.literal({ kind: r.kind, unit: r.unit, surface, weight: r.weight });

  /**
   * The word a claimed token can still be read as a *unit* by — which is only
   * ever the one underneath a single-token claim, since a claim is a value and a
   * value is not a unit. "3pm in tokyo" needs it: geo claims the city, datetime
   * registers the zone, and both readings have to reach the solver for §6.3's
   * "neither needs a tiebreak" to be true of anything.
   */
  const unitWordOf = (token: Token): WordToken | undefined => {
    if (token.type === "word") return token;
    if (token.type === "literal" && token.fallback?.type === "word")
      return token.fallback;
    return undefined;
  };

  function parseAtom(): Node {
    const token = peek();
    if (token === undefined) throw new UnitParseError(input);

    if (token.type === "lparen") {
      pos += 1;
      const inner = parseExpr(0);
      const close = peek();
      if (close === undefined || close.type !== "rparen") throw new UnitParseError(input);
      pos += 1;
      return inner;
    }

    if (token.type === "literal") {
      pos += 1;
      const candidates: Candidate[] = [];
      const values = new Map<Candidate, Value>();

      for (const reading of token.readings) {
        const candidate = candidateFor(reading, token.text);
        candidates.push(candidate);
        values.set(candidate, claimedValue(reading));
      }

      // The number under the claim, which is a value in its own right and so
      // belongs here beside them. A word is not: it is a unit label, and a unit
      // label alone has never been a legal atom — `unitWordOf` reaches it from
      // the two positions where one is.
      const under = token.fallback;
      if (under?.type === "number") {
        const candidate = resolver.literal({
          kind: NUMBER_KIND,
          unit: "one",
          surface: token.text,
          weight: NUMBER_FALLBACK_WEIGHT,
        });
        candidates.push(candidate);
        values.set(
          candidate,
          Object.freeze({ kind: NUMBER_KIND, canonical: under.value, unit: "one" }),
        );
      }

      return {
        type: "literal",
        candidates,
        values,
        span: { start: token.start, end: token.end },
      };
    }

    if (token.type === "op" && token.op === "-") {
      pos += 1;
      const operand = parseExpr(30);
      return { type: "unary", op: "-", operand, span: span(token, operand.span) };
    }

    if (token.type === "number") {
      pos += 1;
      const next = peek();
      const word = next === undefined ? undefined : unitWordOf(next);
      if (next !== undefined && word !== undefined) {
        const candidates = resolver.resolve(word.text);
        // A claimed token whose word resolves to no unit is left as the claim it
        // is, and the expression fails on the leftover exactly as it did before
        // the fallback existed. Reporting a missing unit here would name a token
        // nothing ever tried to read as one — "5 nice" is a number beside a
        // city, not a number beside a bad unit.
        if (candidates.length === 0 && next.type === "word") {
          throw new NoCandidateError(input, word.text, resolver.nearest(word.text), [
            next,
          ]);
        }
        if (candidates.length > 0) {
          pos += 1;
          return {
            type: "quantity",
            value: token.value,
            candidates,
            span: span(token, next),
          };
        }
      }
      return {
        type: "number",
        value: token.value,
        span: { start: token.start, end: token.end },
      };
    }

    throw new UnitParseError(input);
  }

  function parseExpr(minBinding: number): Node {
    let left = parseAtom();

    for (;;) {
      const token = peek();
      if (token === undefined) break;

      // "to" and "as" arrive here as `in` too: a locale lists them as aliases
      // under its `in` key, and keywordFor returns the key, never the alias.
      if (token.type === "keyword" && token.keyword === "in") {
        if (CONVERT_BINDING < minBinding) break;
        pos += 1;
        const unit = peek();
        if (unit === undefined) throw new UnitParseError(input);

        // A kind claimed the target and marked the claim targetable: "japan to
        // ukraine", "3pm in japan". The matcher already built the Value and
        // already named a registered unit, so there is nothing to resolve — and
        // the Value travels on the node, because the signature that receives it
        // reads its `meta`.
        //
        // `targetable` is checked per reading rather than on the token. Every
        // literal is a value, but only some values are conversion *targets*:
        // datetime claims "tomorrow", and accepting that here made
        // `today in tomorrow` a zone conversion returning today, where it had
        // always thrown. A reading that does not opt in contributes nothing,
        // and a token whose readings all decline still reaches the
        // UnitParseError below unless the word underneath it is a real unit.
        if (unit.type === "literal") {
          const target: Candidate[] = [];
          const targetValues = new Map<Candidate, Value>();
          for (const reading of unit.readings) {
            if (reading.targetable !== true) continue;
            const candidate = candidateFor(reading, unit.text);
            target.push(candidate);
            targetValues.set(candidate, claimedValue(reading));
          }
          // And the ordinary unit readings of the word underneath, which is the
          // one position where a claimed token is legitimately a label: geo
          // claims "tokyo" the city, datetime registers it as a zone, and
          // "3pm in tokyo" has to be able to mean either.
          //
          // Minus the ones a claim already named, which is not an optimisation.
          // A bare alias and a claim that agree on kind and unit are one target,
          // and only the claim carries the `meta` its signature reads — the
          // alias would take the stand-in below, whose meta is the *left*
          // operand's, which is the failure `targetValue` was added to prevent.
          // Every country name is a place alias, so "3pm in ukraine" would carry
          // a second reading with no zone on its right; `evaluate` never reached
          // it, and `suggest`, which evaluates every assignment, returned an
          // empty list for the whole input.
          const word = unitWordOf(unit);
          if (word !== undefined) {
            const claimed = new Set(target.map((c) => `${c.kind}\u0000${c.unit}`));
            for (const c of resolver.resolve(word.text))
              if (!claimed.has(`${c.kind}\u0000${c.unit}`)) target.push(c);
          }

          if (target.length === 0) throw new UnitParseError(input);
          pos += 1;
          left = {
            type: "convert",
            operand: left,
            target,
            ...(targetValues.size > 0 ? { targetValues } : {}),
            span: span(left.span, unit),
            targetSpan: { start: unit.start, end: unit.end },
          };
          continue;
        }

        if (unit.type !== "word") throw new UnitParseError(input);
        const target = resolver.resolve(unit.text);
        if (target.length === 0) {
          throw new NoCandidateError(input, unit.text, resolver.nearest(unit.text), [
            unit,
          ]);
        }
        pos += 1;
        left = {
          type: "convert",
          operand: left,
          target,
          span: span(left.span, unit),
          targetSpan: { start: unit.start, end: unit.end },
        };
        continue;
      }

      // "of" and "off" take the same shape — percentage on the left, base on
      // the right — and differ only in the signature the evaluator then looks
      // up, so one branch reads both. Neither is folded into an op token in
      // `wordops`: that fold rewrites a keyword into an *existing* arithmetic
      // operator, and these two have none to become.
      if (
        token.type === "keyword" &&
        (token.keyword === "of" || token.keyword === "off")
      ) {
        const op = token.keyword;
        const binding = BINDING[op];
        if (binding < minBinding) break;
        pos += 1;
        const right = parseExpr(binding + 1);
        left = {
          type: "binary",
          op,
          left,
          right,
          span: span(left.span, right.span),
        };
        continue;
      }

      if (token.type !== "op") break;
      const binding = BINDING[token.op as Exclude<OpSymbol, "in">];
      if (binding === undefined || binding < minBinding) break;

      pos += 1;
      const right = parseExpr(binding + 1);
      left = {
        type: "binary",
        op: token.op as Exclude<OpSymbol, "in">,
        left,
        right,
        span: span(left.span, right.span),
      };
    }

    return left;
  }

  const node = parseExpr(0);
  if (pos !== tokens.length) throw new UnitParseError(input);
  return node;
}
