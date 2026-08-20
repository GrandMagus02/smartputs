-- The database `shop.catalog.fixture.ts` is recorded from.
--
-- Every table here earns its place by being a case the emitter has to get
-- right, not by making a plausible shop: `order_lines` has a composite primary
-- key, `events` has none at all, `orders` reaches `addresses` twice so the join
-- graph is genuinely ambiguous, `tier` and `status` enumerate their values by
-- two different routes, `email` sits behind a domain, and `metadata` is a type
-- this package deliberately has no binding for.
--
--   createdb shop
--   psql -d shop -f packages/query-introspect/scripts/shop.sql
--   DATABASE_URL=postgres://…/shop bun run packages/query-introspect/scripts/record-fixture.ts

CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled');

-- A domain, so the reader has to resolve through `typbasetype` to find `text`.
CREATE DOMAIN email_address AS text CHECK (VALUE ~ '@');

CREATE TABLE customers (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  email          email_address,
  country_code   char(2),
  created_at     timestamptz NOT NULL DEFAULT now(),
  tier           text NOT NULL CHECK (tier IN ('free', 'gold', 'platinum')),
  lifetime_cents bigint NOT NULL DEFAULT 0
);

CREATE TABLE addresses (
  id          bigserial PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers (id),
  line1       text NOT NULL,
  lat         double precision,
  lon         double precision
);

CREATE TABLE orders (
  id                  bigserial PRIMARY KEY,
  customer_id         bigint NOT NULL REFERENCES customers (id),
  billing_address_id  bigint REFERENCES addresses (id),
  shipping_address_id bigint REFERENCES addresses (id),
  status              order_status NOT NULL,
  total_cents         bigint NOT NULL,
  weight_g            numeric(12, 3),
  discount_rate       numeric(5, 4),
  placed_at           timestamptz NOT NULL,
  delivered_on        date,
  is_gift             boolean NOT NULL DEFAULT false,
  note                text,
  metadata            jsonb
);

CREATE TABLE order_lines (
  order_id bigint NOT NULL REFERENCES orders (id),
  line_no  integer NOT NULL,
  sku      text NOT NULL,
  qty      integer NOT NULL,
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE events (
  at   timestamptz NOT NULL,
  what text NOT NULL
);

-- The annotation channel. Everything below survives regeneration, which is the
-- whole point of putting it here rather than editing the generated file.
COMMENT ON TABLE orders IS 'One customer order.
@smartput aliases=order, purchase, sale, sales';

COMMENT ON COLUMN orders.total_cents IS 'Order total, minor units.
@smartput kind=money unit=usd scale=100 aliases=total, amount';

COMMENT ON COLUMN customers.country_code IS '@smartput kind=place aliases=country';
