import { buildRegistry } from "../kind/registry";
import type { Kind, KindId, Locale, RateLookup } from "../types";
import { createFacade, type QuantityClass } from "./quantity";

export type {
  Quantity,
  QuantityClass,
  QuantityInput,
  QuantitySnapshot,
} from "./quantity";
export { createFacade } from "./quantity";

/**
 * One facade class per registered kind, sharing a single registry so
 * cross-kind results (a Temperature's diff producing a TempDelta) resolve.
 *
 * A single pass suffices, regardless of registration order: an affine kind's
 * `add`/`diff` only look up its delta kind's class inside the closures
 * attached to the prototype, and those run when a caller invokes the method —
 * never while this loop is still building the Map. By then every kind's
 * class has been added, so the lookup always succeeds. The Map itself is
 * passed by reference into every `createFacade` call, so all closures share
 * the same, eventually-complete, `classes` Map.
 */
export function createFacades(args: {
  kinds: Kind[];
  locale: Locale;
  /** FX rates, threaded to every facade — see `createFacade`'s own doc. */
  rates?: RateLookup;
}): Record<KindId, QuantityClass> {
  const registry = buildRegistry(args.kinds, [], args.locale.id);
  const classes = new Map<KindId, QuantityClass>();

  for (const [id, kind] of registry.kinds) {
    // A facade is generated from a ratio table: `.to()`, `.scale()` and
    // `.equals()` all read unit ratios. An opaque kind has labels instead, so
    // there is nothing to generate — see plan ruling R8. Date facades are M5.
    if (kind.spec.mode !== "ratio") continue;
    classes.set(
      id,
      createFacade({
        kind,
        registry,
        locale: args.locale,
        deltaFacades: classes,
        ...(args.rates ? { rates: args.rates } : {}),
      }),
    );
  }

  return Object.fromEntries(classes);
}
