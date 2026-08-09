import {
  KeywordConflictError,
  LocaleMismatchError,
  VocabularyConflictError,
} from "../errors";
import type { Keyword, Language, Locale, Vocabulary } from "../types";

/**
 * A language plus its vocabularies, validated once at compose time.
 *
 * What is *not* checked here: that every key a vocabulary's `forms` table
 * declares is one `selectForm` could produce. It cannot be — `selectForm` is a
 * function, not a table — so `assertLocaleContract` covers it in tests
 * instead (spec §9), sampling counts and slots and asserting the key comes
 * back with a word behind it.
 */
export function composeLocale(
  language: Language,
  vocabularies: readonly Vocabulary[] = [],
): Locale {
  const byKind = new Set<string>();
  for (const v of vocabularies) {
    if (v.locale !== language.id) {
      throw new LocaleMismatchError(language.id, v.locale, v.kind);
    }
    if (byKind.has(v.kind)) throw new VocabularyConflictError(language.id, v.kind);
    byKind.add(v.kind);
  }
  return Object.freeze({
    id: language.id,
    language,
    vocabularies: Object.freeze([...vocabularies]),
  });
}

/**
 * Every installed language's connectives, folded into the one table the lexer
 * consults. Keywords are the half of lexing that is many-locale: an engine
 * that reads two languages has to read "5 кг in grams" and "5 кг в грамах"
 * alike, because recognition is many-to-one while generation stays one (I6).
 * Generation deliberately does *not* come here — `Printer` keeps reading
 * `locale.language.keywords` off the single format locale, so a bilingual
 * engine never writes one language's connective beside another's units.
 *
 * Keys arrive folded, each under the id of the language that listed it, which
 * is exactly how `buildRegistry` writes its alias index — the lexer then
 * folds the incoming word once and looks up, instead of re-lowercasing every
 * alias of every language on every word token the way the linear scan this
 * replaces did. The asymmetry (keys folded per language, the query folded
 * once under the format locale) is the same one `createResolver` documents
 * and rests on the same measurement: over both built-in keyword tables and
 * all 780 alias keys, `en` and `uk` fold identically, and Ukrainian has no
 * case tailoring to introduce one. Installing a language that *does* tailor
 * case — Turkish and Azeri dotted-I, Lithuanian dot-above, Greek final sigma
 * — is the trigger to fold the query once per installed id instead.
 *
 * Later languages do not silently win a surface an earlier one claimed: two
 * languages agreeing on the meaning is the ordinary case and collapses to one
 * entry, and two disagreeing is a wiring error that fails here, on boot (I9).
 */
export function buildKeywords(locales: readonly Locale[]): ReadonlyMap<string, Keyword> {
  const folded = new Map<string, { keyword: Keyword; locale: string }>();
  for (const locale of locales) {
    for (const [keyword, aliases] of Object.entries(locale.language.keywords)) {
      for (const alias of aliases ?? []) {
        const surface = alias.toLocaleLowerCase(locale.id);
        const seen = folded.get(surface);
        if (seen === undefined) {
          folded.set(surface, { keyword: keyword as Keyword, locale: locale.id });
        } else if (seen.keyword !== keyword) {
          throw new KeywordConflictError(
            surface,
            [seen.keyword, keyword as Keyword],
            [seen.locale, locale.id],
          );
        }
      }
    }
  }
  return new Map([...folded].map(([surface, { keyword }]) => [surface, keyword]));
}
