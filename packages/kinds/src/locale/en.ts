import type { Vocabulary } from "@smartput/core";
import massEn from "@smartput/mass/locale/en";

/**
 * Every built-in `en` vocabulary, as one array — the words half of what
 * `BUILTIN_KINDS` is the mechanics half of, and the thing you hand
 * `composeLocale` beside `english`:
 *
 * ```ts
 * createEngine({ locales: [composeLocale(english, BUILTIN_EN)], kinds: BUILTIN_KINDS });
 * ```
 *
 * A convenience, not the byte-safe default. Importing it links every built-in
 * kind's words, which is exactly what a bundle-conscious consumer avoids by
 * importing `@smartput/mass/locale/en` one subpath at a time — the same caveat
 * the `./validate` and `./class` barrels next door carry.
 *
 * The array is ordered by kind id, and order is not load-bearing:
 * `composeLocale` refuses two vocabularies for one kind outright, so there is
 * no last-one-wins for the ordering to decide.
 */
const BUILTIN_EN: readonly Vocabulary[] = [massEn];
export default BUILTIN_EN;
