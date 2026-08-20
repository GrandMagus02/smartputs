import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Where the lab's failures go.
 *
 * The reason this exists is the one every attempt to widen the vocabulary runs
 * into: nobody knows which phrasings are actually missing. Every gap found by
 * hand so far was found by somebody guessing sentences, and a guessed gap is
 * not evidence. A ranked list of what real inputs the engine refused is — and
 * it is also the only artefact that could ever justify something heavier than
 * another row in a vocabulary table.
 *
 * Both credentials below are public by construction: this is a static site, so
 * anything the browser needs is in the bundle. That is safe only because the
 * table's row-level security is insert-only — see the migration. Treat the anon
 * key as published, never as a secret that happens to be shipped.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The page works without a database. Telemetry is an addition, not a gate. */
export const telemetryEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!telemetryEnabled) return null;
  if (client === null) {
    client = createClient(url as string, anonKey as string, {
      // No session to persist and no user to refresh: every write is anonymous
      // and the client would otherwise reach for localStorage on a page that
      // never signs anybody in.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * A random id per tab, thrown away on reload.
 *
 * It exists so that twelve failures from one person exploring can be told
 * apart from twelve people hitting the same wall, which is the difference
 * between a curiosity and a priority. It is deliberately not stable across
 * reloads: grouping a burst is all the resolution this needs, and anything
 * durable would be tracking.
 */
const sessionId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export interface LabEvent {
  type: "error" | "report";
  input: string;
  errorName?: string | null;
  errorMessage?: string | null;
  message?: string | null;
  modules: string[];
  locales: string[];
}

/**
 * Inputs already filed this session.
 *
 * Typing "1 kg +" fails on every keystroke, and a table full of one person's
 * prefixes is a table nobody can rank. The key is the input plus the error
 * name, so the same text failing a different way is still news.
 */
const filed = new Set<string>();

/** A ceiling on one tab's contribution, so a stuck loop cannot flood the table. */
const SESSION_CAP = 60;
let filedCount = 0;

/**
 * File one event. Never throws and never rejects: a docs page that breaks
 * because its analytics endpoint is down has traded the thing people came for
 * against the thing they did not ask for.
 */
export async function fileEvent(event: LabEvent): Promise<boolean> {
  const supabase = db();
  if (supabase === null) return false;

  // A report is always filed. The user pressed a button and wrote a sentence,
  // so it is deliberate by definition and the dedupe below would be an insult.
  // Only automatic error rows are rationed.
  if (event.type === "error") {
    const key = `${event.errorName ?? ""} ${event.input}`;
    if (filed.has(key)) return false;
    if (filedCount >= SESSION_CAP) return false;
    filed.add(key);
    filedCount += 1;
  }

  try {
    const { error } = await supabase.from("lab_events").insert({
      type: event.type,
      input: event.input.slice(0, 2000),
      error_name: event.errorName ?? null,
      error_message: event.errorMessage?.slice(0, 4000) ?? null,
      message: event.message?.slice(0, 4000) ?? null,
      modules: event.modules,
      locales: event.locales,
      session_id: sessionId,
      page: typeof location === "undefined" ? null : location.pathname,
      app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? null,
      user_agent:
        typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 500),
    });
    return error === null;
  } catch {
    // Offline, blocked by an extension, CORS, a schema that has not been
    // migrated yet: all of them are the same thing from here, and none of them
    // is the page's problem.
    return false;
  }
}
