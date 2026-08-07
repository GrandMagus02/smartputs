import { LocaleMismatchError, VocabularyConflictError } from "../errors";
import type { Language, Locale, Vocabulary } from "../types";

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
