import { deepFreeze } from "../freeze";
import type { Locale, LocalePack } from "../types";

export function defineLocale(l: Locale): Locale {
  return deepFreeze(l);
}

export function defineLocalePack(p: LocalePack): LocalePack {
  return deepFreeze(p);
}
