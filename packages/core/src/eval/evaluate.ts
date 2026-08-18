import type { KindContext } from "@smartput/kind/contracts";
import { Decimal } from "../decimal";
import { CountQueryError, DimensionMismatchError, DivideByZeroError } from "../errors";
import { deepFreeze } from "../freeze";
import { derivedUnitOf, NUMBER_KIND, opKey, type Registry } from "../kind/registry";
import type { Node } from "../parse/ast";
import type { Program } from "../parse/program";
import type { Resolution } from "../solve/solver";
import type { Assumption, EvalCtx, OpSignature, RateLookup, Value } from "../types";
import { fromCanonical, toCanonical } from "./convert";
import { countQueryOf } from "./count";

export interface EvalResult {
  value: Value;
  assumptions: Assumption[];
}

export interface EvaluateOptions {
  program: Program;
  resolution: Resolution;
  registry: Registry;
  locale: string;
  input: string;
  kindMeta?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  rates?: RateLookup;
  /**
   * Per-kind configuration, keyed by kind id and opaque to core (§G). Rides on
   * both the `EvalCtx` a signature's `apply` gets and the `ConversionCtx` a
   * unit ratio gets, because a plugin whose table decides an arithmetic result
   * decides a conversion by the same table — money's rate is read from both.
   */
  context?: KindContext;
  /** Significant digits a comparison rounds to. See `COMPARE_PRECISION`. */
  comparePrecision?: number | "exact";
}

/** The count a bare unit word stands for, and the one a count query asks about. */
const ONE = new Decimal(1);

export function evaluateNode(opts: EvaluateOptions): EvalResult {
  const {
    program,
    resolution,
    registry,
    locale,
    input,
    rates,
    context,
    comparePrecision,
  } = opts;
  const kindMeta = opts.kindMeta ?? {};
  const assumptions: Assumption[] = [];
  const seen = new Set<string>();
  const note = (a: Assumption): void => {
    const key = JSON.stringify([a.code, a.message, a.detail ?? null]);
    if (seen.has(key)) return;
    seen.add(key);
    assumptions.push(a);
  };
  const noteSignature = (sig: OpSignature): void => {
    if (sig.assumption !== undefined) note(sig.assumption);
  };
  const ctxFor = (self: Value): EvalCtx => ({
    self,
    locale,
    input,
    note,
    ...(rates ? { rates } : {}),
    ...(context ? { context } : {}),
    ...(comparePrecision === undefined ? {} : { comparePrecision }),
  });

  /**
   * `out` with the unit the operands name between them, when the signature
   * declined to choose one.
   *
   * "100 km / 2 h" came back as 13.888… m/s where a person means 50 km/h, and
   * "100 mi / 2 h" as 22.352 m/s where they mean mph. The magnitude was never
   * wrong — a Value's `canonical` is in its kind's canonical unit either way —
   * so what moves here is only the unit the result is read back in, and no
   * `canonical` in any corpus row changes because of it.
   *
   * Only when the returned unit IS the result kind's canonical. A signature
   * that named a non-canonical unit made a decision, and the evaluator does not
   * second-guess a plugin that spoke (ruling §D.3): `datasize / duration`
   * returns `mbps` outright, and the ratio table would have answered `mbps` for
   * (mb, /, s) by a factor of eight it cannot see, since the bit/byte
   * conversion lives in that signature's `apply` rather than in a ratio.
   *
   * `speed`'s `make(l, "speed", "mps", …)` therefore becomes a *default* rather
   * than a decision, without that package changing a line — which is what makes
   * this a seam and not a special case.
   */
  const derivedUnit = (op: "*" | "/", left: Value, right: Value, out: Value): Value => {
    const spec = registry.kinds.get(out.kind)?.spec;
    if (spec?.mode !== "ratio" || out.unit !== spec.canonical) return out;
    const unit = derivedUnitOf(registry, out.kind, left.unit, op, right.unit);
    return unit === undefined ? out : deepFreeze({ ...out, unit });
  };

  const evalNode = (n: Node): Value => {
    switch (n.type) {
      case "number":
        return deepFreeze({ kind: NUMBER_KIND, canonical: n.value, unit: "one" });

      case "literal": {
        // A matcher already built every one of these; the assignment says which
        // one this reading of the input meant. Nothing is recomputed here — and
        // nothing is picked here either, which is why "90210" can be a number
        // under `evaluate` and a postal code under `suggest` without the two
        // disagreeing about what the parser saw.
        const choice = resolution.choices[n.id];
        const value = choice === undefined ? undefined : n.values.get(choice);
        if (value === undefined) {
          const kind = choice?.kind ?? n.candidates[0]?.kind ?? "?";
          throw new DimensionMismatchError(input, "literal", kind, "?");
        }
        return deepFreeze({ ...value });
      }

      case "quantity": {
        const choice = resolution.choices[n.id];
        if (choice === undefined)
          throw new DimensionMismatchError(input, "quantity", "?", "?");
        const kind = registry.kinds.get(choice.kind);
        if (kind === undefined)
          throw new DimensionMismatchError(input, "quantity", choice.kind, "?");
        // Per-kind default meta is how a px measure learns its dpi without the
        // evaluator knowing what dpi is.
        const meta = kindMeta[choice.kind];
        return deepFreeze({
          kind: choice.kind,
          canonical: toCanonical(n.value, kind, choice.unit, {
            locale,
            ...(meta ? { meta } : {}),
            ...(rates ? { rates } : {}),
            ...(context ? { context } : {}),
          }),
          unit: choice.unit,
          ...(meta ? { meta } : {}),
        });
      }

      case "unary": {
        const operand = evalNode(n.operand);
        return deepFreeze({ ...operand, canonical: operand.canonical.negated() });
      }

      case "convert": {
        const operand = evalNode(n.operand);
        const target = resolution.choices[n.id];
        if (target === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, "?");
        const sig = registry.ops.get(opKey("in", operand.kind, target.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, "in", operand.kind, target.kind);
        noteSignature(sig);
        // The stand-in exists because an ordinary conversion target is a unit
        // label with no value behind it, and `in` signatures read `r.unit`
        // alone. A claimed target does have a value — and its own meta, which
        // the stand-in would replace with the *left* operand's. Which of the two
        // applies is settled by whether the assigned candidate came from a
        // claim, so the kinds cannot disagree the way they could when one value
        // stood for a whole list of targets.
        const claimed = n.targetValues?.get(target);
        const rhs: Value =
          claimed ??
          deepFreeze({
            kind: target.kind,
            canonical: new Decimal(0),
            unit: target.unit,
            ...(operand.meta ? { meta: operand.meta } : {}),
          });

        // "minutes in hour" is not the conversion its shape says it is — see
        // `count.ts`. The two operands trade places: the implied 1 belongs to
        // the singular word on the right, and the answer comes back in the
        // plural word on the left. Nothing else about the conversion changes,
        // and in particular it is the *same* signature that applies it, so a
        // kind with a custom `in` (a rate lookup, a zone shift) counts through
        // its own rule rather than through a ratio this file invented.
        const count = countQueryOf(n, resolution, registry, program.input.text, locale);
        if (count !== undefined) {
          const kind = registry.kinds.get(count.kind);
          if (kind !== undefined) {
            const meta = kindMeta[count.kind];
            const conv = {
              locale,
              ...(meta ? { meta } : {}),
              ...(rates ? { rates } : {}),
              ...(context ? { context } : {}),
            };
            const one: Value = deepFreeze({
              kind: count.kind,
              canonical: toCanonical(ONE, kind, count.per, conv),
              unit: count.per,
              ...(meta ? { meta } : {}),
            });
            const counted = deepFreeze(
              sig.apply(one, { ...rhs, unit: count.unit }, ctxFor(one)),
            );
            // The question is how many fit, and "none, but here is a fraction"
            // is not an answer to it. A reading that comes back below one is
            // the units written the wrong way round — "hours in minute" — and
            // the mirrored spelling that does have a whole answer is one word
            // away, so refusing says more than 0.017 would.
            if (fromCanonical(counted.canonical, kind, count.unit, conv).lt(1)) {
              throw new CountQueryError(
                input,
                count.kind,
                count.unit,
                count.per,
                count.unitWord,
                count.perWord,
              );
            }
            return counted;
          }
        }
        return deepFreeze(sig.apply(operand, rhs, ctxFor(operand)));
      }

      case "binary": {
        const left = evalNode(n.left);
        const right = evalNode(n.right);
        if (n.op === "/" && right.canonical.isZero()) throw new DivideByZeroError(input);
        const sig = registry.ops.get(opKey(n.op, left.kind, right.kind));
        if (sig === undefined)
          throw new DimensionMismatchError(input, n.op, left.kind, right.kind);
        noteSignature(sig);
        const out = deepFreeze(sig.apply(left, right, ctxFor(left)));
        return n.op === "*" || n.op === "/" ? derivedUnit(n.op, left, right, out) : out;
      }
    }
  };

  return { value: evalNode(program.root), assumptions };
}
