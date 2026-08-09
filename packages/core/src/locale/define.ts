import { deepFreeze } from "../freeze";
import type { Language } from "../types";

export function defineLanguage(l: Language): Language {
  return deepFreeze(l);
}
