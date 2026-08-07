import { deepFreeze } from "../freeze";
import type { Language, LocalePack } from "../types";

export function defineLanguage(l: Language): Language {
  return deepFreeze(l);
}

/**
 * @deprecated The P1 bridge — ruling R7. Deleted in Task 7 along with
 * `LocalePack` itself; a pack's content becomes one `Vocabulary` per kind.
 */
export function defineLocalePack(p: LocalePack): LocalePack {
  return deepFreeze(p);
}
