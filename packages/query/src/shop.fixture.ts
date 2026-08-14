import { composeLocale, createEngine, type Engine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { dateRange } from "@smartput/date-range";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { definePlace } from "@smartput/geo";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";
import { defineSchema, type Schema } from "./schema";

/**
 * The places this fixture's queries name.
 *
 * `@smartput/geo` ships no gazetteer, so a consumer brings its rows — which is
 * what this file is: a consumer. Two countries and two cities, because
 * `from ukraine` and `in kyiv` are the two readings the schema below binds a
 * column to, and a query fixture proving anything about a gazetteer would be
 * proving it in the wrong package.
 */
const COUNTRIES = [
  {
    a2: "ua",
    a3: "ukr",
    name: "Ukraine",
    aliases: ["ukraine", "ukr", "ua"],
    capital: "Kyiv",
    currency: "UAH",
    phone: "380",
    population: 44_622_516,
    area: 603_700,
    lat: 50.45466,
    lon: 30.5238,
    zone: "Europe/Kyiv",
    geonameId: 690_791,
    postalRegex: "^\\d{5}$",
  },
  {
    a2: "pl",
    a3: "pol",
    name: "Poland",
    aliases: ["poland", "pol", "pl"],
    capital: "Warsaw",
    currency: "PLN",
    phone: "48",
    population: 37_978_548,
    area: 312_685,
    lat: 52.22977,
    lon: 21.01178,
    zone: "Europe/Warsaw",
    geonameId: 798_544,
    postalRegex: "^\\d{2}-\\d{3}$",
  },
];

const CITIES = [
  {
    geonameId: 703_448,
    name: "Kyiv",
    aliases: ["kyiv", "kiev"],
    country: "ua",
    admin1: "30",
    lat: 50.45466,
    lon: 30.5238,
    zone: "Europe/Kyiv",
    population: 2_797_553,
    capital: true,
  },
  {
    geonameId: 756_135,
    name: "Warsaw",
    aliases: ["warsaw"],
    country: "pl",
    admin1: "78",
    lat: 52.22977,
    lon: 21.01178,
    zone: "Europe/Warsaw",
    population: 1_702_139,
    capital: true,
  },
];

/**
 * The engine and schema every test in this package runs against, and the
 * clearest statement of what this package does and does not own.
 *
 * Six kind packages are registered here and none of them is a dependency: the
 * consumer builds the engine, so `€500` is money because *this file* asked for
 * `@smartput/rate`, and `last quarter` is a span because it asked for the range
 * kinds. A schema that declares `kind: "money"` against an engine without money
 * fails at the first predicate, which is the correct and legible failure.
 *
 * Exported rather than kept in a test file because a doc page and a consumer's
 * first experiment both want the same worked example, and one that drifts from
 * what the tests run is worse than none.
 */
export function fixtureEngine(): Engine {
  return createEngine({
    // `moneyEn` rides along with the built-ins because the money kind names no
    // language of its own: an engine that registers the kind and not the
    // vocabulary reads "500 usd" and not "$500" or "500 dollars". A query layer
    // without it is a query layer where half the money filters people type do
    // not parse.
    locales: [composeLocale(en, [...BUILTIN_EN, moneyEn])],
    kinds: [
      ...BUILTIN_KINDS,
      datetime,
      date,
      dateRange,
      definePlace({ countries: COUNTRIES, cities: CITIES }),
      money,
    ],
    rates: snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 }),
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
}

/**
 * A three-table shop, which is the smallest schema that can show every rule:
 * a join with a unique path, two money columns on different tables so ruling
 * R8's nearest-first preference is observable, a scaled minor unit, an
 * enumerated column with no kind at all, and a table positioned on the globe.
 */
export const shop: Schema = defineSchema({
  tables: [
    {
      name: "customers",
      aliases: ["customer", "client", "clients", "buyer", "buyers"],
      key: "id",
      labels: ["name"],
      columns: [
        { name: "id" },
        { name: "name", aliases: ["customer name"] },
        { name: "email" },
        // The place kind is what makes "from ukraine" and "in kyiv" work, and
        // the column stores what a place Value's unit already is: alpha-2.
        { name: "country_code", aliases: ["country", "nationality"], kind: "place" },
        {
          name: "created_at",
          aliases: ["signed up", "joined", "registered"],
          kind: "datetime",
        },
        { name: "tier", aliases: ["plan"], values: ["free", "gold", "platinum"] },
        {
          name: "lifetime_cents",
          aliases: ["lifetime value"],
          kind: "money",
          unit: "usd",
          scale: 100,
        },
      ],
    },
    {
      name: "orders",
      aliases: ["order", "purchase", "purchases", "sale", "sales"],
      key: "id",
      columns: [
        { name: "id" },
        { name: "customer_id" },
        // Stored in cents: `unit` names what the engine knows and `scale` says
        // how many of those one stored number is. Ruling R4 in one line.
        {
          name: "total_cents",
          aliases: ["total", "amount", "price", "value"],
          kind: "money",
          unit: "usd",
          scale: 100,
        },
        { name: "weight_g", aliases: ["weight"], kind: "mass", unit: "g" },
        { name: "placed_at", aliases: ["placed", "ordered", "date"], kind: "datetime" },
        { name: "status", values: ["pending", "paid", "shipped", "cancelled"] },
      ],
    },
    {
      name: "shipments",
      aliases: ["shipment", "delivery", "deliveries"],
      key: "id",
      columns: [
        { name: "id" },
        { name: "order_id" },
        { name: "destination", aliases: ["dest", "shipped to"], kind: "place" },
        { name: "lat" },
        { name: "lon" },
        { name: "delivered_at", aliases: ["delivered"], kind: "datetime" },
      ],
      geo: { lat: "lat", lon: "lon", point: "location" },
    },
  ],
  joins: [
    { from: "orders.customer_id", to: "customers.id" },
    { from: "shipments.order_id", to: "orders.id" },
  ],
  metrics: [
    {
      name: "revenue",
      aliases: ["spend", "turnover"],
      fn: "sum",
      column: "orders.total_cents",
    },
    // Not aliased "orders placed": a metric alias that opens with a table word
    // wins the projection slot before the source is read, and `orders placed
    // last week` becomes a count instead of a filter. Alias hygiene is the
    // schema author's job, and this is what it looks like when it lapses.
    { name: "order_count", aliases: ["order count"], fn: "count", table: "orders" },
    {
      name: "average_order",
      aliases: ["average order value"],
      fn: "avg",
      column: "orders.total_cents",
    },
  ],
});
