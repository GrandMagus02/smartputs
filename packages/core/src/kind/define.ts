import { Decimal } from "../decimal";
import { deepFreeze } from "../freeze";
import type {
  EvalCtx,
  FormatCtx,
  Kind,
  KindId,
  Lexicon,
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
  ops: OpSignature[];
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
  }

  return {
    id: k.id,
    spec: k.value,
    prior: k.prior ?? 0,
    units,
    // Copy, never alias: the descriptor's ops array is deep-frozen, and the
    // registry in Task 4 pushes generated signatures onto this one.
    ops: [...(k.ops ?? [])],
    ...(k.format ? { format: k.format } : {}),
  };
}
