import { expect, test } from "bun:test";
import { ChatError } from "./errors";
import type { FeatureVector } from "./features";
import { NAMED_FEATURES, NGRAM_BUCKETS } from "./features";
import type { WeightTable } from "./model";
import { ABSTAIN, LinearModel } from "./model";

const zeros = () => new Array(NAMED_FEATURES.length).fill(0) as number[];

/** A table with two classes and no hashed weights. */
const table = (named: Record<string, number[]>): WeightTable => {
  const classes = Object.keys(named);
  return {
    locale: "en",
    features: [...NAMED_FEATURES],
    buckets: NGRAM_BUCKETS,
    classes,
    named: classes.map((c) => named[c] ?? zeros()),
    hashed: Buffer.alloc(classes.length * NGRAM_BUCKETS).toString("base64"),
    hashedScale: classes.map(() => 1),
  };
};

const vector = (named: number[]): FeatureVector => ({
  named: Float64Array.from(named),
  hashed: new Map(),
});

const withFeature = (name: string, value: number): number[] => {
  const v = zeros();
  v[NAMED_FEATURES.indexOf(name as (typeof NAMED_FEATURES)[number])] = value;
  return v;
};

test("scores every class and the probabilities sum to one", () => {
  const model = LinearModel.from(table({ convert: zeros(), [ABSTAIN]: zeros() }));
  const scores = model.score(vector(zeros()));
  expect([...scores.keys()].sort()).toEqual([ABSTAIN, "convert"]);
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  expect(total).toBeCloseTo(1, 10);
});

test("a class whose weight matches the firing feature wins", () => {
  const model = LinearModel.from(
    table({ convert: withFeature("frameMatched", 4), [ABSTAIN]: zeros() }),
  );
  const scores = model.score(vector(withFeature("frameMatched", 1)));
  expect((scores.get("convert") ?? 0) > (scores.get(ABSTAIN) ?? 0)).toBe(true);
});

test("abstain wins when nothing argues for a resolver", () => {
  const model = LinearModel.from(
    table({ convert: withFeature("frameMatched", 4), [ABSTAIN]: withFeature("bias", 1) }),
  );
  const scores = model.score(vector(withFeature("bias", 1)));
  expect((scores.get(ABSTAIN) ?? 0) > (scores.get("convert") ?? 0)).toBe(true);
});

test("hashed weights move the score", () => {
  const classes = ["convert", ABSTAIN];
  const q = Buffer.alloc(classes.length * NGRAM_BUCKETS);
  q[7] = 100; // class 0, bucket 7
  const model = LinearModel.from({
    ...table({ convert: zeros(), [ABSTAIN]: zeros() }),
    hashed: q.toString("base64"),
    hashedScale: [0.05, 0.05],
  });
  const plain = model.score({ named: Float64Array.from(zeros()), hashed: new Map() });
  const hit = model.score({
    named: Float64Array.from(zeros()),
    hashed: new Map([[7, 1]]),
  });
  expect((hit.get("convert") ?? 0) > (plain.get("convert") ?? 0)).toBe(true);
});

test("embed scores are added to the same logits when the table carries weights", () => {
  const base = table({ convert: zeros(), [ABSTAIN]: zeros() });
  const model = LinearModel.from({
    ...base,
    embed: [
      [3, 1],
      [0, 0],
    ],
  });
  const without = model.score(vector(zeros()));
  const with_ = model.score(
    vector(zeros()),
    new Map([["convert", { centroid: 0.9, max: 0.95 }]]),
  );
  expect((with_.get("convert") ?? 0) > (without.get("convert") ?? 0)).toBe(true);
});

test("rejects a table whose feature list does not match this build", () => {
  const bad = { ...table({ convert: zeros() }), features: ["bias"] };
  expect(() => LinearModel.from(bad)).toThrow(ChatError);
});

test("rejects a table whose bucket count does not match this build", () => {
  const bad = { ...table({ convert: zeros() }), buckets: 64 };
  expect(() => LinearModel.from(bad)).toThrow(ChatError);
});
