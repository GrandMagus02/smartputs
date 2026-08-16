import { SmartputError } from "@smartput/kind/errors";

/**
 * A failure that belongs to the *search* rather than to any one provider
 * (geocode spec §10): every provider rejected, a `reverse` with no reversing
 * provider, a bounding box whose corners are the wrong way round.
 *
 * `PlaceProviderError` stays what a provider throws, and this is what a
 * `Geo` throws over the top of several of them. When an all-rejected search
 * produces one of these, every underlying failure is carried in `causes` —
 * collapsing four dead mirrors into one message would hide which of them is
 * actually down.
 *
 * Extends `SmartputError` for the reason every error in this repo does:
 * `instanceof SmartputError` is the discriminator consumers branch on, and an
 * error outside it is invisible to every one of them. Not added to
 * `core/errors.ts` — core hosts the errors its own evaluate path can throw, and
 * a search error never crosses it.
 */
export class GeoError extends SmartputError {
  /** Every provider failure behind an all-rejected search. Empty otherwise. */
  readonly causes: readonly unknown[];

  constructor(detail: string, causes: readonly unknown[] = [], input = "") {
    super(detail, input);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "GeoError";
    this.causes = causes;
  }
}

/**
 * The message an all-rejected search carries, built here so the shape is one
 * string rather than one per call site.
 *
 * Each provider is named with its own failure, because "every provider failed"
 * is the least useful sentence a consumer could be handed: with two providers
 * behind a `Geo` it is a coin toss which one to go and look at.
 */
export function allFailed(text: string, failures: readonly ProviderFailure[]): GeoError {
  const detail = failures.map((f) => `${f.id}: ${message(f.error)}`).join("; ");
  return new GeoError(
    `every provider failed for ${JSON.stringify(text)} — ${detail}`,
    failures.map((f) => f.error),
    text,
  );
}

/** One provider's rejection, kept with the id so the message can name it. */
export interface ProviderFailure {
  readonly id: string;
  readonly error: unknown;
}

/** A thrown value's message, for a `catch` that cannot assume it caught an Error. */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
