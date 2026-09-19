import type { Result } from "@smartput/core";
import { ChatError } from "../errors";
import type { Candidate, ResolveCtx, Resolver } from "../types";

/**
 * A resolver whose `resolve` is statically known to return a value.
 *
 * `Resolver.resolve` is declared `T | Promise<T>` because the async door has
 * to be expressible; annotating a synchronous resolver with the plain
 * interface would hide from its own callers that it never returns a promise.
 */
type SyncResolver = {
  resolve(candidate: Candidate, ctx: ResolveCtx): Result;
} & Resolver<Result>;

/**
 * The plain path: the payload is already an expression, so hand it to the
 * engine and return what comes back.
 *
 * `suggest` and not `evaluate`: the strict door throws `AmbiguityError`, and a
 * chat router that has already decided this message is a request should answer
 * it with the reading the engine ranked first rather than raise. A caller who
 * wants every reading uses `handleAll` and reads the ranked results.
 *
 * `frames` is empty on purpose. This resolver answers messages with no frame
 * at all — "what is 2 + 2", "5 kg + 3 kg" — and claiming a frame would put it
 * in competition with the resolver that owns one.
 */
export const evaluateResolver: SyncResolver = {
  id: "evaluate",
  frames: { en: [] },
  resolve(candidate: Candidate, ctx: ResolveCtx): Result {
    const found = ctx.engine.suggest(candidate.text);
    const top = found[0];
    if (top === undefined) {
      throw new ChatError(
        "resolve",
        `engine found no reading for ${JSON.stringify(candidate.text)}`,
      );
    }
    return top;
  },
};
