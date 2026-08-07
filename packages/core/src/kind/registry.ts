import { KindConflictError, UnknownKindError } from "../errors";
import type {
  Kind,
  KindId,
  Lexicon,
  LiteralMatcher,
  Locale,
  LocalePack,
  OpSignature,
  OpSymbol,
  UnitLexeme,
  UnitWords,
  Vocabulary,
} from "../types";
import { legacyVocabulary, type NormalizedKind, normalizeKind } from "./define";
import { generateComparisonOps, generateRatioOps } from "./ratio-ops";

export { BOOLEAN_KIND, BOOLEAN_UNIT, NUMBER_KIND, PERCENT_KIND } from "./ratio-ops";

export interface AliasEntry {
  kind: KindId;
  unit: string;
  /**
   * Which installed language contributed this alias — ruling R6, landing here
   * rather than in P4 because the index is built in one loop and tagging it
   * twice would mean writing the loop twice. `"*"` is the unit's own registry
   * key (R2): language-neutral, and never matched by a `locale:` selector.
   *
   * One entry per (kind, unit) per alias, and the tag is the *first* language
   * that reached it — an alias that is also the unit's own key is tagged `"*"`
   * and not listed twice. Every consumer of this index reads an entry list as
   * the distinct readings of one surface (`Printer`'s rebase target refuses a
   * list longer than one), so a second entry naming the same unit would be a
   * second reading that does not exist.
   */
  locale: string;
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
  /** `${locale}|${kind}|${unit}` -> the words that (locale, kind, unit) has. */
  words: Map<string, UnitWords>;
}

export function opKey(op: OpSymbol, left: KindId, right: KindId): string {
  return `${op}|${left}|${right}`;
}

const wordsKey = (locale: string, kind: KindId, unit: string): string =>
  `${locale}|${kind}|${unit}`;

/**
 * The words for one unit in one language, or `undefined` when that language
 * ships none for it — which is I10's degradation path, not an error: a
 * half-translated language renders `5 kg` awkwardly rather than throwing at a
 * user, and `assertLocaleContract` is what fails it in tests.
 */
export function wordsFor(
  registry: Registry,
  locale: string,
  kind: KindId,
  unit: string,
): UnitWords | undefined {
  return registry.words.get(wordsKey(locale, kind, unit));
}

/** Unions aliases the way `mergeLexeme` did, keeping the patch's own symbol. */
function mergeWords(base: UnitWords, patch: UnitWords): UnitWords {
  const symbol = patch.symbol ?? base.symbol;
  return {
    aliases: [...new Set([...base.aliases, ...patch.aliases])],
    ...(symbol !== undefined ? { symbol } : {}),
    ...(patch.forms || base.forms ? { forms: { ...base.forms, ...patch.forms } } : {}),
  };
}

/**
 * The other half of the P1 bridge — ruling R7. A `LocalePack` contributes a
 * lexicon per kind; that is a vocabulary in all but name, so it becomes one
 * and takes the same install path. Deleted in Task 7 with `LocalePack` itself.
 */
function legacyPackVocabulary(
  locale: string,
  kind: KindId,
  lexicon: Lexicon,
): Vocabulary {
  const units: Record<string, UnitWords> = {};
  for (const [unit, entry] of Object.entries(lexicon)) {
    const lexeme: UnitLexeme = Array.isArray(entry) ? { aliases: entry } : entry;
    units[unit] = {
      aliases: [...lexeme.aliases],
      ...(lexeme.symbol !== undefined ? { symbol: lexeme.symbol } : {}),
      ...(lexeme.display ? { forms: { ...lexeme.display } } : {}),
    };
  }
  return { locale, kind, units };
}

export function buildRegistry(
  kinds: Kind[],
  locales: readonly Locale[] = [],
  packs: LocalePack[] = [],
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
      // The patch's own definition wins outright: a unit is a ratio and an
      // offset, and there is nothing left on it to merge now that the words
      // have moved out to a vocabulary — which `install` unions below, exactly
      // as `mergeLexeme` used to.
      base.units.set(unit, def);
    }
    base.ops.push(...patch.ops);
    base.literals.push(...patch.literals);
  }

  // Pass 3: vocabularies. Every installed locale's own, plus the bridge's for
  // any kind that still declares `lexicon` and has no real vocabulary yet
  // (ruling R7 — the bridge half is deleted in Task 7 with the `packs`
  // parameter).
  const words = new Map<string, UnitWords>();
  /** `${locale}|${kind}` for every kind some language has spoken for at all. */
  const spokenKinds = new Set<string>();
  const install = (vocab: Vocabulary): void => {
    const kind = normalized.get(vocab.kind);
    if (kind === undefined) throw new UnknownKindError(vocab.locale, vocab.kind);
    spokenKinds.add(`${vocab.locale}|${vocab.kind}`);
    for (const [unit, entry] of Object.entries(vocab.units)) {
      if (!kind.units.has(unit)) {
        throw new UnknownKindError(vocab.locale, vocab.kind, unit);
      }
      const key = wordsKey(vocab.locale, vocab.kind, unit);
      const existing = words.get(key);
      // A real vocabulary always wins over the bridge; two real ones for the
      // same kind were already refused by composeLocale.
      words.set(key, existing === undefined ? entry : mergeWords(existing, entry));
    }
  };

  const installedKinds = new Set<string>();
  for (const l of locales) {
    for (const vocab of l.vocabularies) {
      install(vocab);
      installedKinds.add(`${l.id}|${vocab.kind}`);
    }
  }
  // Bases before patches, mirroring passes 1 and 2, so a patch's aliases union
  // onto the base's rather than the other way round.
  for (const k of [
    ...kinds.filter((k) => k.extendsKind === undefined),
    ...kinds.filter((k) => k.extendsKind !== undefined),
  ]) {
    if (installedKinds.has(`en|${k.extendsKind ?? k.id}`)) continue;
    const bridged = legacyVocabulary(k);
    if (bridged !== null) install(bridged);
  }
  for (const pack of packs) {
    for (const [kindId, lexicon] of Object.entries(pack.contributes)) {
      install(legacyPackVocabulary(pack.locale, kindId, lexicon));
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
    for (const sig of [
      ...generateRatioOps(kind),
      ...generateComparisonOps(kind),
      ...kind.ops,
    ]) {
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

  // Pass 5: alias index, deterministically ordered. Kind ids sorted, unit
  // names sorted, then locales sorted — so the entry list for one surface is
  // the same on every run and in every process.
  const aliasIndex = new Map<string, AliasEntry[]>();
  const push = (entry: AliasEntry, fold: string): void => {
    const list = aliasIndex.get(fold) ?? [];
    if (!list.some((e) => e.kind === entry.kind && e.unit === entry.unit)) {
      list.push(entry);
    }
    aliasIndex.set(fold, list);
  };
  const localeIds = [...new Set(locales.map((l) => l.id))].sort();
  // "en" when nothing was installed, so a registry built with no locale at all
  // — every `buildRegistry(kinds)` in the test suite, and `assertKindContract`
  // — still reads the bridge's tables.
  const readIds = localeIds.length > 0 ? localeIds : ["en"];
  const kindIds = [...normalized.keys()].sort();
  for (const kindId of kindIds) {
    const kind = normalized.get(kindId);
    if (kind === undefined) continue;
    // R2: a kind no installed language has spoken for is indexed under its own
    // unit keys, so an engine with no vocabulary at all can still read `5 kg`
    // and I10's "degrade to the unit key" has something to degrade to.
    //
    // Narrowed from R2's literal "always, regardless of which vocabularies are
    // installed" to "when nothing has been said about this kind". Indexing a
    // key unconditionally would overrule a vocabulary that leaves keys out on
    // purpose, and three do: `@smartput/length` spells `in` only as
    // `inch`/`inches` because `in` is the conversion keyword;
    // `@smartput/country` keys `place` by ISO alpha-2, so `10 km` would be
    // ambiguous between a distance and Comoros; and `boolean`, `time`, `date`
    // and the range kinds each carry one deliberately wordless sentinel unit
    // that is reached through a literal matcher and must never be a typeable
    // word. All are deliberate, all are documented where they are declared,
    // and none is what R2's reasoning ("cannot read `5 kg` at all", "nothing
    // to degrade to") is about — a kind with a vocabulary has an author who
    // said what its words are, including by omission.
    const spoken = readIds.some((id) => spokenKinds.has(`${id}|${kindId}`));
    const unitNames = [...kind.units.keys()].sort();
    for (const unitName of unitNames) {
      if (!spoken) {
        push({ kind: kindId, unit: unitName, locale: "*" }, unitName.toLowerCase());
      }
      for (const localeId of readIds) {
        const entry = words.get(wordsKey(localeId, kindId, unitName));
        for (const alias of entry?.aliases ?? []) {
          push(
            { kind: kindId, unit: unitName, locale: localeId },
            alias.toLocaleLowerCase(localeId),
          );
        }
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

  return { kinds: normalized, ops, aliasIndex, literals, words };
}
