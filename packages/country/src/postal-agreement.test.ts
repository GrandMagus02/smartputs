import { expect, test } from "bun:test";
import { MIN_ALIAS_LENGTH, RANK_STEP as ZIP_RANK_STEP } from "@smartput/zip";
import { MIN_NAME_LENGTH, RANK_STEP } from "./matcher";

/**
 * `@smartput/zip` respells two of this package's constants rather than importing
 * them, because the dependency runs the other way: `place.ts` names
 * `createPostalLiteral`, so the zip package cannot name this one back.
 *
 * Both headers say so and neither can enforce it, which is exactly the drift
 * `RANK_STEP`'s own comment refuses to accept — "two spellings of one constant
 * are two things to keep in step". This file is the third thing, and it lives
 * here because this is the side of the boundary that can see both.
 *
 * What breaks if they disagree is not obvious from either file. A smaller
 * `MIN_ALIAS_LENGTH` lets the postal qualifier branch accept a country alias the
 * name matcher refuses, so `us 90210` and `usa 90210` stop agreeing about which
 * codes are real; a different `RANK_STEP` puts a postal reading inside the
 * solver's `ambiguityEpsilon` of a name reading, and `SW1A 1AA` becomes an
 * `AmbiguityError` naming Jersey.
 */
test("zip's respelled constants still equal the matcher's", () => {
  expect(MIN_ALIAS_LENGTH).toBe(MIN_NAME_LENGTH);
  expect(ZIP_RANK_STEP).toBe(RANK_STEP);
});
