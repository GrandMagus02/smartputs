import { KindConflictError, UnknownKindError } from "../errors";
import type {
  Kind,
  KindId,
  LiteralMatcher,
  LocalePack,
  OpSignature,
  OpSymbol,
  UnitLexeme,
} from "../types";
import { type NormalizedKind, normalizeKind } from "./define";
import { generateRatioOps } from "./ratio-ops";

export { NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";

export interface AliasEntry {
  kind: KindId;
  unit: string;
}

export interface Registry {
  kinds: Map<KindId, NormalizedKind>;
  ops: Map<string, OpSignature>;
  aliasIndex: Map<string, AliasEntry[]>;
  /**
   * Every registered matcher, ordered by kind id then declaration order.
   * Ordered rather than a Map because the fold tries them all at each token
   * boundary and ties break on this order — spec §8's determinism clause.
   */
  literals: Array<{ kind: KindId; matcher: LiteralMatcher }>;
}

export function opKey(op: OpSymbol, left: KindId, right: KindId): string {
  return `${op}|${left}|${right}`;
}

function mergeLexeme(base: UnitLexeme, patch: UnitLexeme): UnitLexeme {
  const aliases = [...new Set([...base.aliases, ...patch.aliases])];
  const symbol = patch.symbol ?? base.symbol;
  return {
    aliases,
    ...(symbol !== undefined ? { symbol } : {}),
    ...(patch.display || base.display
      ? { display: { ...base.display, ...patch.display } }
      : {}),
  };
}

export function buildRegistry(
  kinds: Kind[],
  packs: LocalePack[] = [],
  locale = "en",
): Registry {
  const normalized = new Map<KindId, NormalizedKind>();

  // Pass 1: base kinds.
  for (const k of kinds) {
    if (k.extendsKind !== undefined) continue;
    if (normalized.has(k.id)) throw new KindConflictError(k.id, "registered twice");
    normalized.set(k.id, normalizeKind(k));
  }

  // Pass 2: patches.
  for (const k of kinds) {
    if (k.extendsKind === undefined) continue;
    const base = normalized.get(k.extendsKind);
    if (base === undefined)
      throw new KindConflictError(k.id, `extends unknown kind ${k.extendsKind}`);
    if (base.spec.mode !== k.value.mode) {
      throw new KindConflictError(
        k.id,
        `value.mode ${k.value.mode} does not match base ${base.spec.mode}`,
      );
    }
    const patch = normalizeKind({ ...k, id: base.id });
    for (const [unit, def] of patch.units) {
      const existing = base.units.get(unit);
      base.units.set(
        unit,
        existing ? { ...def, lexeme: mergeLexeme(existing.lexeme, def.lexeme) } : def,
      );
    }
    base.ops.push(...patch.ops);
    base.literals.push(...patch.literals);
  }

  // Pass 3: locale packs.
  for (const pack of packs) {
    if (pack.locale !== locale) continue;
    for (const [kindId, lexicon] of Object.entries(pack.contributes)) {
      const kind = normalized.get(kindId);
      if (kind === undefined) throw new UnknownKindError(pack.locale, kindId);
      for (const [unit, entry] of Object.entries(lexicon)) {
        const existing = kind.units.get(unit);
        if (existing === undefined) throw new UnknownKindError(pack.locale, kindId, unit);
        const patch: UnitLexeme = Array.isArray(entry) ? { aliases: entry } : entry;
        existing.lexeme = mergeLexeme(existing.lexeme, patch);
      }
    }
  }

  // Pass 4: op table. Spec §7 makes a duplicate *signature* as much of a
  // conflict as a duplicate id, so track which kind contributed each key and
  // refuse a second claimant. Bookkeeping stays local: it is a build-time
  // concern, not part of the Registry contract.
  const ops = new Map<string, OpSignature>();
  const opOwners = new Map<string, KindId>();
  for (const kind of normalized.values()) {
    // Generated first, then kind.ops — so an author can replace a signature
    // their own kind generated, which stays legal.
    for (const sig of [...generateRatioOps(kind), ...kind.ops]) {
      const key = opKey(sig.op, sig.left, sig.right);
      const owner = opOwners.get(key);
      if (owner !== undefined && owner !== kind.id) {
        throw new KindConflictError(
          kind.id,
          `signature ${key} is already defined by kind ${JSON.stringify(owner)}`,
        );
      }
      opOwners.set(key, kind.id);
      ops.set(key, sig);
    }
  }

  // Pass 5: alias index, deterministically ordered.
  const aliasIndex = new Map<string, AliasEntry[]>();
  const kindIds = [...normalized.keys()].sort();
  for (const kindId of kindIds) {
    const kind = normalized.get(kindId);
    if (kind === undefined) continue;
    const unitNames = [...kind.units.keys()].sort();
    for (const unitName of unitNames) {
      const unit = kind.units.get(unitName);
      if (unit === undefined) continue;
      for (const alias of unit.lexeme.aliases) {
        const key = alias.toLocaleLowerCase(locale);
        const list = aliasIndex.get(key) ?? [];
        if (!list.some((e) => e.kind === kindId && e.unit === unitName)) {
          list.push({ kind: kindId, unit: unitName });
        }
        aliasIndex.set(key, list);
      }
    }
  }

  // Pass 6: literal matchers, deterministically ordered.
  const literals: Array<{ kind: KindId; matcher: LiteralMatcher }> = [];
  for (const kindId of kindIds) {
    for (const matcher of normalized.get(kindId)?.literals ?? []) {
      literals.push({ kind: kindId, matcher });
    }
  }

  return { kinds: normalized, ops, aliasIndex, literals };
}
