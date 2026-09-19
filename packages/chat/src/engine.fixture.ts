import type { Engine } from "@smartput/core";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

/** One engine, every built-in kind, English in and English out. */
export function testEngine(): Engine {
  return createEngine({
    locales: [composeLocale(english, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
}
