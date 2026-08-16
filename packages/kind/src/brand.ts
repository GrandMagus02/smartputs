/**
 * The mark that says "this is a Decimal", carried by the class rather than
 * asked of it.
 *
 * This module imports nothing, and that is its entire reason to exist. It sits
 * between `decimal.ts`, which stamps the brand onto `Decimal.prototype`, and
 * `freeze.ts`, which reads it — so a module that only needs to *recognise* a
 * Decimal can do so without naming `decimal.js` and dragging 33 KB of
 * arithmetic behind it. `deepFreeze` used to spell that recognition as
 * `value instanceof Decimal`, which meant every consumer of `defineVocabulary`
 * — a table of nouns — shipped the whole engine. Anything added here that has
 * an import is that bug coming back.
 *
 * `Symbol.for` rather than `Symbol()` because the registry it looks in is
 * realm-global, and this repo's build guarantees more than one copy of this
 * file: `scripts/build.ts` runs with `packages: "external"` and no splitting,
 * so a relative import is inlined into every entry that reaches it. Two inlined
 * copies of `Symbol()` are two different symbols and the brand never matches;
 * two inlined copies of `Symbol.for("smartput.decimal")` are the same symbol,
 * every time, in every realm that shares the registry.
 */
export const DECIMAL_BRAND: unique symbol = Symbol.for("smartput.decimal");
