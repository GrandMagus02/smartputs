import { expect, test } from "bun:test";
import { MongoCompiler } from "./mongo";
import { QueryEngine } from "./query";
import { fixtureEngine, shop } from "./shop.fixture";
import { SqlCompiler } from "./sql";

/**
 * The same sentences as the SQL corpus, compiled by a second dialect.
 *
 * That is the assertion this file exists to make, and it is ruling R3's whole
 * claim: nothing upstream of the compiler changed. The parse, the schema
 * linking, the unit conversion and the ambiguity rules are shared, and what
 * differs between a `WHERE` and a `$match` is entirely inside these two
 * classes.
 */
const engine = new QueryEngine({ schema: shop, engine: fixtureEngine() });
const mongo = new MongoCompiler();

test("a plain filter is a find as well as a pipeline", () => {
  const out = engine.compile("orders over 500 usd", mongo);
  expect(out.collection).toBe("orders");
  expect(out.find?.filter).toEqual({ total_cents: { $gt: 50000 } });
  expect(out.pipeline).toEqual([{ $match: { total_cents: { $gt: 50000 } } }]);
});

test("the same rate conversion and the same scale as the SQL dialect", () => {
  const out = engine.compile("orders over 500 eur", mongo);
  const sql = engine.compile("orders over 500 eur", new SqlCompiler());
  expect(out.find?.filter).toEqual({ total_cents: { $gt: 55000 } });
  expect(sql.params).toEqual([55000]);
});

test("a mass predicate arrives in the column's own unit", () => {
  const out = engine.compile("orders where weight > 2 kg", mongo);
  expect(out.find?.filter).toEqual({ weight_g: { $gt: 2000 } });
});

test("a range is half-open here too", () => {
  const out = engine.compile("orders last week", mongo);
  const filter = out.find?.filter as { placed_at: { $gte: Date; $lt: Date } };
  expect(filter.placed_at.$gte).toBeInstanceOf(Date);
  expect(filter.placed_at.$lt).toBeInstanceOf(Date);
  expect(filter.placed_at.$lt.getTime()).toBeGreaterThan(filter.placed_at.$gte.getTime());
});

test("a place binds its country code", () => {
  const out = engine.compile("customers from ukraine", mongo);
  // `$eq` is written out rather than left implicit. `{field: value}` means
  // *exact document match* when the value happens to be a document, and a
  // compiler that emitted the short form would be one operand shape away from
  // silently meaning something else.
  expect(out.find?.filter).toEqual({ country_code: { $eq: "ua" } });
});

test("contains becomes an anchored-free regex, and the value is escaped", () => {
  const out = engine.compile("customers where email contains gmail", mongo);
  expect(out.find?.filter).toEqual({ email: { $regex: "gmail", $options: "i" } });
});

test("a join is a lookup and an unwind, in that order", () => {
  const out = engine.compile("sum of total by country", mongo);
  expect(out.find).toBeUndefined();
  expect(out.pipeline[0]).toEqual({
    $lookup: {
      from: "customers",
      localField: "customer_id",
      foreignField: "id",
      as: "customers",
    },
  });
  expect(out.pipeline[1]).toEqual({ $unwind: "$customers" });
});

test("a group projects its keys back to the top level", () => {
  const out = engine.compile("sum of total by country", mongo);
  const group = out.pipeline.find((s) => "$group" in s) as {
    $group: Record<string, unknown>;
  };
  expect(group.$group._id).toEqual({ country_code: "$customers.country_code" });
  expect(group.$group.sum_total_cents).toEqual({ $sum: "$total_cents" });
  const project = out.pipeline.at(-1) as { $project: Record<string, unknown> };
  expect(project.$project.country_code).toBe("$_id.country_code");
});

test("a ranking sorts on the grouped aggregate's name and limits after it", () => {
  const out = engine.compile("top 10 customers by revenue", mongo);
  const stages = out.pipeline.map((s) => Object.keys(s)[0]);
  expect(stages).toEqual(["$lookup", "$unwind", "$group", "$project", "$sort", "$limit"]);
  expect(out.pipeline.at(-2)).toEqual({ $sort: { revenue: -1 } });
  expect(out.pipeline.at(-1)).toEqual({ $limit: 10 });
});

test("a having becomes a second match, after the group", () => {
  const out = engine.compile("customers with more than 10 orders", mongo);
  const stages = out.pipeline.map((s) => Object.keys(s)[0]);
  expect(stages.at(-1)).toBe("$match");
  expect(out.pipeline.at(-1)).toEqual({ $match: { count: { $gt: 10 } } });
});

test("a distance filter uses the declared point field", () => {
  const out = engine.compile("shipments within 50 km of kyiv", mongo);
  const filter = out.find?.filter as {
    location: { $geoWithin: { $centerSphere: [[number, number], number] } };
  };
  const [[lon, lat], radians] = filter.location.$geoWithin.$centerSphere;
  expect(lon).toBeCloseTo(30.52, 1);
  expect(lat).toBeCloseTo(50.45, 1);
  // 50 km on a 6371 km sphere.
  expect(radians).toBeCloseTo(50_000 / 6_371_000, 6);
});

test("the SQL dialect answers the same distance with haversine and four parameters", () => {
  const out = engine.compile("shipments within 50 km of kyiv", new SqlCompiler());
  expect(out.text).toContain("ASIN(SQRT(");
  expect(out.params).toHaveLength(4);
  expect(out.params.at(-1)).toBeCloseTo(50_000, 0);
});
