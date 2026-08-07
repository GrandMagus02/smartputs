/**
 * `@smartput/locale-en` — the English `Language`.
 *
 * Named and default both, so `import { english }` and `import english` are the
 * same object: the repo's call sites arrived from `@smartput/core/locale/en`,
 * which was a default export, and the named form is what new code should reach
 * for.
 */
export { english, english as default } from "./english";
// Numbers as they are said, in both directions — English grammar, so it lives
// with the language and not with the kind whose ratio happens to be one. It
// arrived here from `@smartput/number`, which re-exports none of it any more.
export type { NumberWords } from "./words";
export { NUMBER_WORDS, numberFromWords, spellNumber } from "./words";
