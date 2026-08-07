/**
 * `@smartput/locale-en` — the English `Language`.
 *
 * Named and default both, so `import { english }` and `import english` are the
 * same object: the repo's call sites arrived from `@smartput/core/locale/en`,
 * which was a default export, and the named form is what new code should reach
 * for.
 */
export { english, english as default } from "./english";
