import {
  BOOLEAN_KIND,
  BOOLEAN_UNIT,
  Decimal,
  defineKind,
  type Kind,
  type Value,
} from "@smartput/kind";

export { BOOLEAN_KIND, BOOLEAN_UNIT };

/**
 * What every comparison in the engine returns.
 *
 * **Opaque, not ratio** — ruling C1. A ratio kind gets `+`, `-` and the whole
 * number-scaling trio generated for it by `generateRatioOps`, and `true * 3` is
 * not a thing anyone should be able to type. Opaque generates no arithmetic at
 * all, which is exactly the surface this kind wants.
 *
 * `canonical` is still `1` or `0`, because `Value.canonical` is a `Decimal` and
 * a kind does not get to opt out of that. It is not a workaround: it is the
 * same trick `datetime` plays with epoch nanoseconds and `place` with a
 * GeoNames id — the scalar exists so the machinery around the kind keeps
 * working, and what the scalar *means* is the kind's own business.
 *
 * `ordered` is deliberately absent, so no comparison signature is generated
 * over booleans. That is what makes `1 < 2 < 3` fail: it parses
 * left-associatively to `(1 < 2) < 3`, and there is no `< | boolean | number`
 * for it to match. Ruling C3 — the refusal is the op table's, not a chain rule
 * someone had to remember to write.
 *
 * The unit is named by **id alone** — ruling R1: an opaque kind's `units` is a
 * list of ids, and any words for them live in a `Vocabulary`. This kind ships
 * none, in any language, and that is the point rather than an omission: the
 * unit is a sentinel that exists so `Value.unit` has something to hold, and
 * "true"/"false" come out of the `format` hook below, never out of a unit word.
 *
 * So there is no alias to register. "true" and "false" are ordinary English
 * words and the alias index is global — one key, every kind — so claiming them
 * would make `true` a unit wherever it appeared, on the same argument that
 * keeps country codes and city names out of the index.
 *
 * What the unit *is* indexed under is its own id, `bool`, with the neutral
 * `"*"` tag every registry key gets when no language has spoken for the kind
 * (ruling R2). That is the engine's floor, not this kind's choice, and it is
 * harmless here: `bool` is not a word anybody types, and a quantity that
 * reaches this kind by any route prints through `format` below.
 */
export const boolean: Kind = defineKind({
  id: BOOLEAN_KIND,
  value: { mode: "opaque", units: [BOOLEAN_UNIT] },
  format: (v) => (v.canonical.isZero() ? "false" : "true"),
});

const TRUE = Object.freeze({
  kind: BOOLEAN_KIND,
  canonical: new Decimal(1),
  unit: BOOLEAN_UNIT,
});
const FALSE = Object.freeze({
  kind: BOOLEAN_KIND,
  canonical: new Decimal(0),
  unit: BOOLEAN_UNIT,
});

/** A boolean `Value`. Frozen module constants, since there are only two. */
export const booleanValue = (value: boolean): Value => (value ? TRUE : FALSE);

/**
 * A `Value` as a JavaScript boolean, or `null` when it is not one.
 *
 * `null` rather than a throw, and rather than a bare `false`: "this expression
 * was false" and "this expression was not a comparison" are different answers,
 * and a caller doing `if (truthOf(r.value))` must not have the second silently
 * read as the first. A caller who wants the throw uses `Bool.of`.
 */
export function truthOf(value: Value): boolean | null {
  if (value.kind !== BOOLEAN_KIND) return null;
  return !value.canonical.isZero();
}
