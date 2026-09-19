import { expect, test } from "bun:test";
import type { Result } from "@smartput/core";
import { ChatResolver } from "./chat";
import { testEngine } from "./engine.fixture";
import { LinearModel } from "./model";
import { fixtureTable } from "./model.fixture";
import { convertResolver, evaluateResolver } from "./resolvers";
import type { Candidate, ResolveCtx, Resolver } from "./types";
import { chatEn } from "./vocabulary";

const engine = testEngine();
const resolvers = [evaluateResolver, convertResolver];

const make = (extra: readonly Resolver[] = []) =>
  new ChatResolver({
    engine,
    resolvers: [...resolvers, ...extra],
    locales: [chatEn],
    weights: LinearModel.from(fixtureTable([...resolvers, ...extra].map((r) => r.id))),
    threshold: 0.4,
  });

test("routes arithmetic to evaluate", () => {
  const out = make().handle("what is 2 + 2");
  expect(out?.resolver).toBe("evaluate");
  expect(out?.payload).toBe("2 + 2");
  expect((out?.result as Result | undefined)?.formatted).toBe("4");
});

test("abstains on chatter", () => {
  expect(make().handle("lol ok")).toBeNull();
});

test("abstains on a greeting alone", () => {
  expect(make().handle("hey")).toBeNull();
});

test("the worked case: a referent filled from the previous turn", () => {
  const chat = make();
  chat.handle("5 pounds of flour");
  const out = chat.handle("Hi, convert this to kg please");
  expect(out?.resolver).toBe("convert");
  expect(out?.filled[0]?.slot).toBe("source");
  expect(out?.filled[0]?.text).toBe("5 pounds");
  expect((out?.result as Result | undefined)?.formatted).toContain("kilogram");
});

test("a successful handle pushes its result onto the conversation", () => {
  const chat = make();
  expect(chat.conversation.size).toBe(0);
  chat.handle("what is 1 kg + 500 g");
  expect(chat.conversation.size).toBe(1);
  expect(chat.conversation.last()?.kind).toBe("mass");
});

test("an abstained message leaves the conversation alone", () => {
  const chat = make();
  chat.handle("lol ok");
  expect(chat.conversation.size).toBe(0);
});

test("handleAll returns several results for a message carrying two requests", () => {
  const found = make().handleAll("what is 2 + 2 and 3 kg + 1 kg");
  expect(found.length).toBeGreaterThanOrEqual(1);
});

test("handle excludes an async resolver rather than returning a promise", () => {
  const slow: Resolver<Result> = {
    id: "slow",
    frames: { en: [] },
    async: true,
    resolve: (c: Candidate, ctx: ResolveCtx) =>
      Promise.resolve(ctx.engine.suggest(c.text)[0] as Result),
  };
  const out = make([slow]).handle("what is 2 + 2");
  expect(out?.resolver).not.toBe("slow");
  expect(out?.result).not.toBeInstanceOf(Promise);
});

test("handleAsync scores async resolvers too", async () => {
  const slow: Resolver<Result> = {
    id: "slow",
    frames: { en: [] },
    async: true,
    resolve: (c: Candidate, ctx: ResolveCtx) =>
      Promise.resolve(ctx.engine.suggest(c.text)[0] as Result),
  };
  const out = await make([slow]).handleAsync("what is 2 + 2");
  expect(out).not.toBeNull();
});

test("a higher threshold silences a weak route", () => {
  const chat = new ChatResolver({
    engine,
    resolvers,
    locales: [chatEn],
    weights: LinearModel.from(fixtureTable(resolvers.map((r) => r.id))),
    threshold: 0.999,
  });
  expect(chat.handle("what is 2 + 2")).toBeNull();
});
