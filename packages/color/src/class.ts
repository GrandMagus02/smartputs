/**
 * The class door — and the class is `@urcolor/core`'s own.
 *
 * Every other kind package's `/class` exports a facade this repo wrote,
 * because for a ratio kind there is nothing else: `Mass` is `createValueClass`
 * over a unit table that exists nowhere but here. Colour is the opposite case.
 * `Color` is already an immutable, Temporal-shaped value class with `to()`,
 * `mix()`, `deltaE()`, `contrast()`, `lighten()`, `toGamut()` and thirty more
 * methods, all of which return a `Color`. Wrapping it would mean re-declaring
 * every one of those to unwrap, delegate and re-wrap — and the day one was
 * missed, a caller would get a `Color` back from a facade and two types for one
 * value. `@smartput/boolean` made the same call the other way for the same
 * reason: six lines by hand beat a generated facade whose every method throws.
 *
 * So this file is the seam and not a class: the class is upstream's, and what
 * this package adds is the two directions between it and a `Value`.
 *
 * ```ts
 * import { Color, colorOf, colorValue } from "@smartput/color/class";
 *
 * colorValue(Color.parse("#3b82f6")!.lighten(0.1));  // a Value for the engine
 * colorOf(engine.evaluate("#3b82f6 in oklch").value); // a Color back out
 * ```
 */

export type { ColorObject, ColorPatch, SpaceId } from "@urcolor/core";
export { Color } from "@urcolor/core";
export type { ColorUnit } from "./value";
/**
 * `colorValue` is `wrap` and `colorOf` is `unwrap`, renamed at the door.
 *
 * The short names belong here, where `Color` is in scope and the direction is
 * unambiguous; `wrap`/`unwrap` are what the kind's own modules call each other
 * and stay spelled that way at the root, beside the other internals.
 */
export { tryUnwrap as tryColorOf, unwrap as colorOf, wrap as colorValue } from "./value";
