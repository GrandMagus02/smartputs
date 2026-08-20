import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/kind/errors";
import { TranslateProviderError } from "./errors";

test("carries the provider id and a message naming it", () => {
  const err = new TranslateProviderError("libretranslate", "request failed: 503");
  expect(err.provider).toBe("libretranslate");
  expect(err.message).toBe(
    'Translate provider "libretranslate" failed: request failed: 503',
  );
  expect(err.name).toBe("TranslateProviderError");
});

test("extends SmartputError", () => {
  const err = new TranslateProviderError("google", "boom");
  expect(err).toBeInstanceOf(SmartputError);
});
