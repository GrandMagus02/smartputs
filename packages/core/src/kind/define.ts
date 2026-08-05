import { Decimal } from "../decimal";
import { deepFreeze } from "../freeze";
import type {
  Completer,
  EvalCtx,
  FormatCtx,
  Kind,
  KindId,
  Lexicon,
  LiteralMatcher,
  OpaqueSpec,
  OpSignature,
  RatioSpec,
  UnitDef,
  UnitLexeme,
  Value,
} from "../types";

export interface NormalizedUnit {
  unit: string;
  ratio: (ctx: EvalCtx) => Decimal;
  offset: (ctx: EvalCtx) => Decimal;
  lexeme: UnitLexeme;
}

export interface NormalizedKind {
  id: KindId;
  spec: RatioSpec | OpaqueSpec;
  prior: number;
  units: Map<string, NormalizedUnit>;
  literals: LiteralMatcher[];
  ops: OpSignature[];
  completions?: Completer;
  format?: (v: Value, ctx: FormatCtx) => string;
}

export function defineKind(k: Kind): Kind {
  return deepFreeze(k);
}

function toDecimalFn(
  x: Decimal | number | ((ctx: EvalCtx) => Decimal) | undefined,
  fallback: number,
): (ctx: EvalCtx) => Decimal {
  if (x === undefined) {
    const d = new Decimal(fallback);
    return () => d;
  }
  if (typeof x === "function") return x;
  const d = new Decimal(x as Decimal | number);
  return () => d;
}

function toLexeme(unit: string, entry: Lexicon[string] | undefined): UnitLexeme {
  if (entry === undefined) return { aliases: [unit], symbol: unit };
  if (Array.isArray(entry)) return { aliases: entry, symbol: entry[0] ?? unit };
  return { symbol: entry.symbol ?? entry.aliases[0] ?? unit, ...entry };
}

export function normalizeKind(k: Kind): NormalizedKind {
  const units = new Map<string, NormalizedUnit>();

  if (k.value.mode === "ratio") {
    for (const [unit, raw] of Object.entries(k.value.units)) {
      const def: UnitDef =
        typeof raw === "number" || raw instanceof Decimal ? { ratio: raw } : raw;
      units.set(unit, {
        unit,
        ratio: toDecimalFn(def.ratio, 1),
        offset: toDecimalFn(def.offset, 0),
        lexeme: toLexeme(unit, k.lexicon?.[unit]),
      });
    }
  } else {
    // An opaque unit has no scale, but it is still a unit: it is indexed by
    // alias, chosen by the solver, named by `in`, and read by the formatter.
    // The identity ratio keeps toCanonical/fromCanonical total, so generic code
    // never has to branch on mode before touching a unit.
    for (const [unit, entry] of Object.entries(k.value.units ?? {})) {
      units.set(unit, {
        unit,
        ratio: toDecimalFn(1, 1),
        offset: toDecimalFn(0, 0),
        lexeme: toLexeme(unit, k.lexicon?.[unit] ?? entry),
      });
    }
  }

  return {
    id: k.id,
    spec: k.value,
    prior: k.prior ?? 0,
    units,
    literals: [...(k.literals ?? [])],
    // Copy, never alias: the descriptor's ops array is deep-frozen, and the
    // registry in Task 4 pushes generated signatures onto this one.
    ops: [...(k.ops ?? [])],
    // Carried, not merged: a patch kind adds units and signatures to its base,
    // but two completers over one kind would have to agree on ranking and on
    // de-duplication keys, and neither is a thing the registry can arbitrate.
    // The base's stands, which is also what `format` does one line below.
    ...(k.completions ? { completions: k.completions } : {}),
    ...(k.format ? { format: k.format } : {}),
  };
}
