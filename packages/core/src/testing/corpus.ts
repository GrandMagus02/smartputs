import { expect, test } from "bun:test";
import type { Engine, EvalOptions } from "../engine";

/**
 * One row of a corpus file: the tab-separated cells, trimmed of nothing.
 *
 * A `readonly string[]` rather than a named four-tuple because the column count
 * is the corpus's business, not this module's — `@smartput/shared` records
 * seven, `@smartput/timezone` three — and only `Corpora.evaluate()` below,
 * which is the engine-shaped default, commits to what the first four mean.
 */
export type CorpusRow = readonly string[];

/**
 * A language's half of a multi-language corpus: the file to read and the engine
 * to read it with.
 *
 * The engine is per language rather than per corpus because that is the thing
 * actually under test. An engine speaking `uk` is composed from a different
 * vocabulary, groups its thousands with U+00A0 and picks a plural form out of
 * four; sharing one engine across two tables would assert the tables and not
 * the language.
 */
export interface CorpusLanguage {
  /** The language id, which is also the corpus file's basename: `uk` → `corpus/uk.tsv`. */
  readonly id: string;
  /**
   * The engine `evaluate()` replays this language's rows through.
   *
   * Optional, for the two cases that have none. A `pending` language never runs
   * a row, and several packages record a corpus for a door that is not an
   * engine at all — `@smartput/currency` reads its rows with `parseAmount`,
   * `@smartput/timezone` with a table lookup — and reach them through `each()`,
   * which asks for no engine. `evaluate()` throws rather than skipping if a
   * language it is asked to replay has none.
   */
  readonly engine?: Engine;
  /**
   * Options every row of this language is evaluated with, typically the `kinds`
   * narrowing a package needs to reach its own reading — `@smartput/date` asks
   * for `["date", "duration"]` because an unnarrowed "today" is deliberately a
   * datetime.
   */
  readonly evaluate?: EvalOptions;
  /**
   * A corpus file this language deliberately does not have, with the reason.
   *
   * Declaring the language and marking it pending is not the same as leaving it
   * out of the table: the row stays visible in the test file, and the check
   * below turns a *silently* missing file into a failure while letting a
   * knowingly missing one through. Used for a language whose vocabulary the
   * package has not been translated into yet.
   */
  readonly pending?: string;
}

/** How many rows a corpus has to carry before it counts as one. */
const MIN_ROWS = 10;

/**
 * Every non-comment, non-blank line of a corpus file, split on tabs.
 *
 * `#` starts a comment line and nothing else does — a corpus is data, and the
 * one place a reader needs prose is between rows, saying why the row above is
 * the shape it is. Ukrainian's decimal comma against English's thousands
 * separator is three lines of comment in `core/corpus/uk.tsv` and would be
 * unreadable as a fifth column.
 */
export function parseCorpus(text: string): CorpusRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

/**
 * A package's corpus, in every language it has been written in, and the tests
 * that replay it.
 *
 * The class exists because the loop it replaces was copied into thirty-four
 * files, and a second language would have doubled every one of them. What each
 * package still writes for itself is the part that is actually its own: which
 * kinds it registers, which vocabularies it composes, and what its rows say.
 *
 * ```ts
 * const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
 *   { id: "en", engine: englishEngine },
 *   { id: "uk", engine: ukrainianEngine },
 * ]);
 * corpora.evaluate();
 * ```
 *
 * `evaluate()` is the four-column default — input, kind, canonical, formatted —
 * and `each()` is the door for a corpus with other columns, which is how
 * `@smartput/currency` and `@smartput/timezone` keep their own assertions while
 * still getting the per-language table and its missing-file check.
 */
export class Corpora {
  private constructor(
    private readonly languages: readonly CorpusLanguage[],
    private readonly tables: ReadonlyMap<string, CorpusRow[]>,
  ) {}

  /**
   * Read `<dir>/<id>.tsv` for every language in the table.
   *
   * A declared language whose file is absent is an error unless it carries
   * `pending`, and the error is raised here — at load, naming the path — rather
   * than as an empty row list that would make the language's tests silently
   * pass by having none. That failure mode is the reason this method reads the
   * files instead of each caller doing it: a corpus that does not exist and a
   * corpus that is green are indistinguishable from the outside.
   */
  static async load(dir: URL, languages: readonly CorpusLanguage[]): Promise<Corpora> {
    const tables = new Map<string, CorpusRow[]>();
    for (const language of languages) {
      const url = new URL(`${language.id}.tsv`, dir);
      const file = Bun.file(url);
      if (!(await file.exists())) {
        if (language.pending !== undefined) continue;
        throw new Error(
          `corpus ${url.pathname} does not exist — declare \`pending\` on the "${language.id}" entry if that is deliberate`,
        );
      }
      tables.set(language.id, parseCorpus(await file.text()));
    }
    return new Corpora(languages, tables);
  }

  /** The rows recorded for one language, or `[]` for a pending one. */
  rows(id: string): readonly CorpusRow[] {
    return this.tables.get(id) ?? [];
  }

  /**
   * Register one test per row per language, plus the per-language guard that
   * the table is not empty.
   *
   * `assert` is handed the row and the language it came from, so a package with
   * its own columns writes only the assertion:
   *
   * ```ts
   * corpora.each(([input, zone, symbol]) => { ... });
   * ```
   *
   * The test name carries the language id in front of the input because two
   * languages routinely record the same input — every row with no word in it,
   * which is most of the arithmetic — and Bun reports duplicates by name.
   *
   * `assert` may return a promise, and it is handed straight back to the test
   * runner rather than dropped. Every kind package's door is sync — an engine
   * evaluates on the calling stack — but a corpus over a *provider* is not:
   * `@smartput/geo` replays its rows through `Geo.search`, and an assertion
   * whose promise nothing awaited would report a passing test for an assertion
   * that had not run yet.
   */
  each(assert: (row: CorpusRow, language: CorpusLanguage) => void | Promise<void>): void {
    for (const language of this.languages) {
      const rows = this.tables.get(language.id);
      if (rows === undefined) {
        test.skip(`${language.id}: corpus pending — ${language.pending}`, () => {});
        continue;
      }
      test(`${language.id}: the corpus has rows`, () => {
        expect(rows.length).toBeGreaterThan(MIN_ROWS);
      });
      for (const row of rows) {
        test(`corpus ${language.id}: ${row[0]}`, () => assert(row, language));
      }
    }
  }

  /**
   * The four-column assertion every kind package's corpus makes: the input
   * reads as the recorded kind, lands on the recorded canonical amount, and
   * prints as the recorded string.
   *
   * All three, because a kind that reads a sentence and lands on the right
   * number in the wrong kind, or the right number under the wrong words, has
   * failed in a way a single assertion would miss — and the third column is the
   * one that catches a language: "1,5 кілометрів" is the right kind and the
   * right number in Ukrainian that no reviewer of the first two would see.
   */
  evaluate(): void {
    this.each(([input, kind, canonical, formatted], language) => {
      const engine = language.engine;
      if (engine === undefined) {
        throw new Error(
          `corpus language "${language.id}" has no engine — evaluate() cannot replay it`,
        );
      }
      const result = engine.evaluate(input as string, language.evaluate);
      expect(result.kind).toBe(kind as string);
      expect(result.value.canonical.toString()).toBe(canonical as string);
      expect(result.formatted).toBe(formatted as string);
    });
  }
}
