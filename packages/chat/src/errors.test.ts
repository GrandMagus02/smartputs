import { expect, test } from "bun:test";
import { SmartputError } from "@smartput/kind/errors";
import { ChatError } from "./errors";

test("names the stage that failed", () => {
  const err = new ChatError("carve", "no vocabulary installed");
  expect(err.stage).toBe("carve");
  expect(err.message).toBe('Chat stage "carve" failed: no vocabulary installed');
  expect(err.name).toBe("ChatError");
});

test("extends SmartputError", () => {
  expect(new ChatError("score", "boom")).toBeInstanceOf(SmartputError);
});
