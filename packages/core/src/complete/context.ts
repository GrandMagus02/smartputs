import { opKey, type Registry } from "../kind/registry";
import { buildKeywords } from "../locale/compose";
import { parseNumber } from "../locale/number";
import type { Keyword, KindId, Locale } from "../types";

/**
 * What the text around a fragment says about which kinds the fragment may be.
 *
 * One method, and injected rather than built here, because answering it means
 * parsing — the head of a conversion is an expression ("10 kg + 5 lb in g"),
 * and only the engine holds a parser and a solver. `complete()` importing them
 * would put the whole front half of the pipeline behind the completer, and the
 * completer runs on a raw string precisely because it is handed text that does
 * not parse yet.
 */
export interface CompletionContext {
  /**
   * Every kind `head` — the text left of a conversion keyword — can read as,
   * best first. Empty when the head parses as nothing, which is the normal
   * answer half-way through a word and means "do not narrow anything".
   */
  sourceKinds(head: string): readonly KindId[];
}

/**
 * Built once per `Locale` object rather than once per keystroke. The map is
 * derived purely from `locale.language.keywords`, and a `Locale` is a frozen
 * composition — `composeLocale` builds a new object rather than mutating one —
 * so the entry can never go stale for the identity it is keyed by. Weak, so an
 * engine torn down takes its table with it.
 */
const KEYWORDS = new WeakMap<Locale, ReadonlyMap<string, Keyword>>();

function keywordsOf(locale: Locale): ReadonlyMap<string, Keyword> {
  const seen = KEYWORDS.get(locale);
  if (seen !== undefined) return seen;
  const built = buildKeywords([locale]);
  KEYWORDS.set(locale, built);
  return built;
}

/**
 * The expression a fragment is a conversion target of, or null when it is not
 * one — "30 hours in s" answers "30 hours", "30 hours" answers null.
 *
 * Walks backwards over the words before the fragment and stops at the first
 * one that decides the question: an `in` keyword ("in", "to", "as" in English)
 * means the fragment names a target, anything else means it does not. Numbers
 * are stepped over because a target may carry one — "2 km in 3 m" is still a
 * conversion, and the number is `leadingCount`'s business, not this function's.
 *
 * One language, the format locale's, for the same reason the rest of the
 * completer is single-locale (decision I6): it reads and writes in the one
 * language it was built for. So a bilingual engine formatting English narrows
 * "5 кг in g" and leaves "5 кг в г" unnarrowed — which costs a wider list, and
 * never a wrong one.
 *
 * Note "in" is also inches. That resolves itself: the word being typed is the
 * fragment, so the trailing "in" of "3 in" is never what this walk sees, and
 * the leading one of "3 in in cm" is a keyword by position — exactly the
 * reading `lex` gives the same two words.
 */
export function conversionHead(
  input: string,
  upto: number,
  locale: Locale,
): string | null {
  const head = input.slice(0, upto);
  const keywords = keywordsOf(locale);
  const words = [...head.matchAll(/\S+/g)];

  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i];
    if (word === undefined) continue;
    const fold = word[0].normalize("NFKC").toLocaleLowerCase(locale.id);

    if (keywords.get(fold) === "in") {
      const before = head.slice(0, word.index).trim();
      // "in s" converts nothing: there is no left operand to take a kind from,
      // and narrowing to the kinds of nothing would empty the list.
      return before === "" ? null : before;
    }
    if (parseNumber(word[0], locale.language) !== null) continue;
    return null;
  }

  return null;
}

/**
 * Every kind reachable from `sources` by `in`, which is the registry's own
 * answer and not a rule restated here: `evaluate` resolves a conversion by
 * looking up exactly this signature, so a target this set excludes is one that
 * would have thrown `DimensionMismatchError` had the user accepted the offer.
 *
 * Kept as a set over kinds rather than a filter over ops so the completer pays
 * one lookup per row instead of one scan.
 */
export function convertibleKinds(
  registry: Registry,
  sources: readonly KindId[],
): Set<KindId> {
  const allowed = new Set<KindId>();
  for (const source of sources) {
    for (const kind of registry.kinds.keys()) {
      if (registry.ops.has(opKey("in", source, kind))) allowed.add(kind);
    }
  }
  return allowed;
}
