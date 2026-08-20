import { expect, test } from "bun:test";
import { columnAnnotation, tableAnnotation } from "./annotation";
import { AnnotationError } from "./errors";

/**
 * The annotation channel, and the one place this package refuses rather than
 * emitting a TODO.
 *
 * The asymmetry is the point. A *fact* it cannot map — a `jsonb`, a table with
 * no key — is reported as unknown, because the database is entitled to hold
 * things this package has no answer for. An *annotation* is a sentence someone
 * wrote for this tool, so a key it does not recognise is a typo, and a typo
 * that silently produced a column without its `kind` is the wrong-rows failure
 * ruling R7 exists to prevent.
 */
const column = (comment: string) => columnAnnotation("orders.x", comment);

test("a comment with no @smartput line is not an annotation", () => {
  expect(column("Order total, in minor units.")).toBeNull();
  expect(column("mentions @smartputs in passing")).toBeNull();
});

test("the annotated fields are read", () => {
  expect(column("@smartput kind=money unit=usd scale=100")).toEqual({
    kind: "money",
    unit: "usd",
    scale: 100,
  });
});

test("prose above the annotation is kept out of it", () => {
  expect(column("Order total, minor units.\n@smartput kind=money unit=usd")).toEqual({
    kind: "money",
    unit: "usd",
  });
});

test("a list value keeps its spaces out and its commas in", () => {
  // Written the way anybody would write it. A parser that split on whitespace
  // would have kept "total," and dropped the rest without a word.
  expect(column("@smartput aliases=total, amount, order value")).toEqual({
    aliases: ["total", "amount", "order value"],
  });
});

test("`ignore` is a bare word and drops the column", () => {
  expect(column("@smartput ignore")).toEqual({ ignore: true });
  expect(column("@smartput unit=ignoreme kind=mass")).toEqual({
    kind: "mass",
    unit: "ignoreme",
  });
});

test("a key this package does not know is an error, not a shrug", () => {
  expect(() => column("@smartput knid=money")).toThrow(AnnotationError);
  expect(() => column("@smartput knid=money")).toThrow(/unknown key "knid"/);
});

test("`unit` without `kind` is refused, because it converts nothing", () => {
  expect(() => column("@smartput unit=usd")).toThrow(/"unit" without "kind"/);
  expect(() => column("@smartput kind=money scale=100")).toThrow(
    /"scale" without "unit"/,
  );
});

test("a malformed annotation is an error rather than an empty one", () => {
  expect(() => column("@smartput kind money")).toThrow(/expected "key=value" pairs/);
  expect(() => column("@smartput kind=")).toThrow(/has no value/);
  expect(() => column("@smartput kind=money kind=mass")).toThrow(/set twice/);
  expect(() => column("@smartput as=int")).toThrow(/expected number, string/);
  expect(() => column("@smartput kind=money unit=usd scale=x")).toThrow(
    /not a non-zero number/,
  );
});

test("a table annotation carries the words a catalogue has no idea about", () => {
  expect(tableAnnotation("orders", "@smartput aliases=order, sale labels=name")).toEqual({
    aliases: ["order", "sale"],
    labels: ["name"],
  });
});

test("a table may declare its own key and its own position columns", () => {
  expect(tableAnnotation("events", "@smartput key=at geo=lat, lon, location")).toEqual({
    key: "at",
    geo: { lat: "lat", lon: "lon", point: "location" },
  });
  expect(() => tableAnnotation("events", "@smartput geo=lat")).toThrow(
    /expected lat,lon/,
  );
});

test("the two annotations take different keys, and say so", () => {
  expect(() => tableAnnotation("orders", "@smartput kind=money")).toThrow(
    /unknown key "kind"/,
  );
  expect(() => column("@smartput labels=name")).toThrow(/unknown key "labels"/);
});
