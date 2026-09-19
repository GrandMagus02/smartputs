import { expect, test } from "bun:test";
import { chatEn } from "./vocabulary";

test("every spelling is lowercase and trimmed", () => {
  const all = [
    ...chatEn.greetings,
    ...chatEn.leading,
    ...chatEn.trailing,
    ...chatEn.referents,
    ...chatEn.interrogatives,
    ...Object.values(chatEn.frames).flat(),
  ];
  for (const word of all) {
    expect(word).toBe(word.toLowerCase().trim());
    expect(word.length).toBeGreaterThan(0);
  }
});

test("no spelling appears under two frames", () => {
  const seen = new Map<string, string>();
  for (const [frame, words] of Object.entries(chatEn.frames)) {
    for (const word of words) {
      const first = seen.get(word);
      expect(first === undefined || first === frame).toBe(true);
      seen.set(word, frame);
    }
  }
});

test("a referent is never also a frame spelling", () => {
  const frames = new Set(Object.values(chatEn.frames).flat());
  for (const ref of chatEn.referents) expect(frames.has(ref)).toBe(false);
});

test("names the convert frame, which the worked case needs", () => {
  expect(chatEn.frames.convert).toContain("convert");
  expect(chatEn.referents).toContain("this");
  expect(chatEn.trailing).toContain("please");
  expect(chatEn.greetings).toContain("hi");
});
