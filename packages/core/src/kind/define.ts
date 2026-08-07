import { Decimal } from "../decimal";
import { deepFreeze } from "../freeze";
import type {
  Completer,
  EvalCtx,
  FormatCtx,
  Kind,
  KindId,
  LiteralMatcher,
  OpaqueSpec,
  OpSignature,
  RatioSpec,
  UnitDef,
  UnitLexeme,
  UnitWords,
  Value,
  Vocabulary,
} from "../types";

export interface NormalizedUnit {
  unit: string;
  ratio: (ctx: EvalCtx) => Decimal;
  offset: (ctx: EvalCtx) => Decimal;
  /**
   * Read only by completion's `scaleFit`. Kind-level in the descriptor
   * (ruling R3) — a magnitude band is physics, not language, so it is the one
   * thing that stayed on the kind when the words left for a `Vocabulary`.
   */
  typical?: [number, number];
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

/**
 * The unit ids of an opaque kind, whichever of R1's two shapes it declared
 * them in. The array is the shape R1 settles on; the record is the lexicon the
 * P1 bridge still accepts (ruling R7), and Task 7 deletes this branch with it.
 */
export function opaqueUnitNames(spec: OpaqueSpec): string[] {
  const raw = spec.units;
  if (raw === undefined) return [];
  return Array.isArray(raw) ? [...raw] : Object.keys(raw);
}

/**
 * The lexicon entry a legacy descriptor carries for one unit: the kind's own
 * `lexicon`, or — for an opaque kind that still declares its units as a table
 * — the table entry. P1 bridge, ruling R7.
 */
function legacyEntry(k: Kind, unit: string): UnitLexeme | string[] | undefined {
  const fromLexicon = k.lexicon?.[unit];
  if (fromLexicon !== undefined) return fromLexicon;
  if (k.value.mode === "opaque") {
    const raw: readonly string[] | Record<string, UnitLexeme | string[]> | undefined =
      k.value.units;
    if (raw !== undefined && !Array.isArray(raw)) {
      return (raw as Record<string, UnitLexeme | string[]>)[unit];
    }
  }
  return undefined;
}

export function normalizeKind(k: Kind): NormalizedKind {
  const units = new Map<string, NormalizedUnit>();

  /**
   * `Kind.typical` first (ruling R3), then the band the legacy lexeme carried
   * — the second half is the P1 bridge again, and it is what keeps
   * completion's `scaleFit` scoring identically while the kind packages move
   * their bands up onto the descriptor. Task 7 deletes it.
   */
  const typical = (unit: string): { typical?: [number, number] } => {
    const entry = legacyEntry(k, unit);
    const band = k.typical?.[unit] ?? (Array.isArray(entry) ? undefined : entry?.typical);
    return band === undefined ? {} : { typical: band };
  };

  if (k.value.mode === "ratio") {
    for (const [unit, raw] of Object.entries(k.value.units)) {
      const def: UnitDef =
        typeof raw === "number" || raw instanceof Decimal ? { ratio: raw } : raw;
      units.set(unit, {
        unit,
        ratio: toDecimalFn(def.ratio, 1),
        offset: toDecimalFn(def.offset, 0),
        ...typical(unit),
      });
    }
  } else {
    // An opaque unit has no scale, but it is still a unit: it is indexed by
    // alias, chosen by the solver, named by `in`, and read by the formatter.
    // The identity ratio keeps toCanonical/fromCanonical total, so generic code
    // never has to branch on mode before touching a unit.
    for (const unit of opaqueUnitNames(k.value)) {
      units.set(unit, {
        unit,
        ratio: toDecimalFn(1, 1),
        offset: toDecimalFn(0, 0),
        ...typical(unit),
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

/**
 * The P1 bridge — ruling R7, deleted in Task 7.
 *
 * A kind that still declares `lexicon` (or an `OpaqueSpec.units` table, the
 * shape R1 replaces) is served an `en` vocabulary built from it, so the
 * registry can read vocabularies from this task onward while the eighteen kind
 * packages migrate one commit at a time. The table it produces is byte-for-byte
 * what `toLexeme` used to produce — same alias list, same `symbol` fallback
 * chain (explicit, else first alias, else the unit key), same display table —
 * which is why parity holds across the whole fan-out.
 *
 * A patch kind's words belong to the kind it extends: `extendsKind` merges
 * units into the base, so its vocabulary must name the base, or installing it
 * would look for a kind the registry deliberately never registered.
 */
export function legacyVocabulary(k: Kind): Vocabulary | null {
  const entries: Record<string, UnitWords> = {};
  const add = (unit: string): void => {
    const entry = legacyEntry(k, unit);
    if (entry === undefined) {
      entries[unit] = { aliases: [unit], symbol: unit };
      return;
    }
    const lexeme: UnitLexeme = Array.isArray(entry) ? { aliases: entry } : entry;
    entries[unit] = {
      aliases: [...lexeme.aliases],
      symbol: lexeme.symbol ?? lexeme.aliases[0] ?? unit,
      ...(lexeme.display ? { forms: { ...lexeme.display } } : {}),
    };
  };

  // A kind carrying no legacy words at all has nothing to bridge, and saying
  // so is not the same as saying it has none: the registry's R2 pass indexes
  // an unvocabularied kind under its unit keys, which is the degradation path
  // this bridge would otherwise hide by inventing a word per unit.
  const opaqueTable =
    k.value.mode === "opaque" &&
    k.value.units !== undefined &&
    !Array.isArray(k.value.units);
  if (k.lexicon === undefined && !opaqueTable) return null;

  const names =
    k.value.mode === "ratio" ? Object.keys(k.value.units) : opaqueUnitNames(k.value);
  for (const unit of names) add(unit);

  if (names.length === 0) return null;
  return { locale: "en", kind: k.extendsKind ?? k.id, units: entries };
}
