-- Lab telemetry: what the engine refused, and what people said about it.
--
-- One table, not two. A bug report is an error snapshot with a sentence
-- attached, so splitting them would mean the same columns twice and a UNION
-- every time somebody asks the only question this table exists to answer:
-- which inputs fail most often. `type` discriminates.
--
-- The rows are user-typed text arriving from a public static site with the
-- anon key in the bundle, so every guard here is load-bearing: the length
-- checks bound what one request can store, and the policy below is
-- insert-only because a readable table with a published key is a public table.

create table if not exists public.lab_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 'error'  — the engine refused an input the user typed
  -- 'report' — the user pressed Report and wrote something
  type          text not null check (type in ('error', 'report')),

  -- The input that produced it. This is the whole point of the table: the
  -- ranked tail of these is the list of phrasings the vocabulary is missing.
  input         text not null check (char_length(input) <= 2000),

  -- Null on a report filed against a working result — somebody can dislike an
  -- answer the engine was happy with, and that is worth hearing.
  error_name    text check (char_length(error_name) <= 200),
  error_message text check (char_length(error_message) <= 4000),

  -- The user's own words. Informal on purpose: a required structured form is a
  -- form nobody fills in.
  message       text check (char_length(message) <= 4000),

  -- Engine composition at the moment it failed. An input that works with every
  -- kind registered and fails with six is a different bug from one that never
  -- works, and without these two columns the row cannot tell them apart.
  modules       text[] not null default '{}',
  locales       text[] not null default '{}',

  -- Random per tab, regenerated on reload. Enough to group a burst of failures
  -- from one person exploring; not enough to follow them anywhere.
  session_id    text check (char_length(session_id) <= 64),

  page          text check (char_length(page) <= 500),
  app_version   text check (char_length(app_version) <= 50),
  user_agent    text check (char_length(user_agent) <= 500)
);

-- A report must carry either a message or an error; a row with neither says
-- nothing and is the shape a spam script produces by accident.
alter table public.lab_events
  drop constraint if exists lab_events_says_something;
alter table public.lab_events
  add constraint lab_events_says_something
  check (error_name is not null or nullif(btrim(coalesce(message, '')), '') is not null);

-- The two questions the table gets asked: "what failed recently" and "which
-- input fails most". The second is a group-by over `input`, so it gets its own
-- index rather than riding the timestamp one.
create index if not exists lab_events_recent_idx
  on public.lab_events (type, created_at desc);
create index if not exists lab_events_input_idx
  on public.lab_events (input);

alter table public.lab_events enable row level security;

-- Insert-only, and only these columns. The anon key ships inside a public
-- JavaScript bundle, so it must be assumed to be in the hands of anyone who
-- views source: no select policy means no policy can leak the table, and no
-- update or delete policy means nobody can rewrite or empty it.
drop policy if exists "anon may file an event" on public.lab_events;
create policy "anon may file an event"
  on public.lab_events
  for insert
  to anon
  with check (true);

revoke all on public.lab_events from anon, authenticated;
grant insert on public.lab_events to anon;
