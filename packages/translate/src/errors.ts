import { SmartputError } from "@smartput/kind/errors";

/**
 * A provider failed outright — non-2xx response, or a payload that does not
 * match the shape its own API promises — or `Translator` could not resolve a
 * language name / literal before ever reaching a provider. Same shape as
 * `@smartput/rate`'s `RateProviderError`; not added to `@smartput/kind/errors`
 * because a translation failure never crosses the shared `evaluate` path
 * (design §7).
 */
export class TranslateProviderError extends SmartputError {
  readonly provider: string;

  constructor(provider: string, detail: string) {
    super(`Translate provider ${JSON.stringify(provider)} failed: ${detail}`, provider);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "TranslateProviderError";
    this.provider = provider;
  }
}
