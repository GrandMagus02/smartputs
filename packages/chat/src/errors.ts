import { SmartputError } from "@smartput/kind/errors";

/**
 * A stage could not run at all — no vocabulary installed, a weight table whose
 * class list does not match the resolvers it was handed. Imported from
 * `@smartput/kind/errors` and not through `@smartput/core`'s root barrel: that
 * door links `decimal.js` for a class that needs none of it (design §10).
 *
 * A message that routes nowhere is NOT this. Routing failure is `null` from
 * `handle`, because "no resolver wanted it" is the expected outcome for most
 * of what arrives in a chat.
 */
export class ChatError extends SmartputError {
  readonly stage: string;

  constructor(stage: string, detail: string) {
    super(`Chat stage ${JSON.stringify(stage)} failed: ${detail}`, stage);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "ChatError";
    this.stage = stage;
  }
}
