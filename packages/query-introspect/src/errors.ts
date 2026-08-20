/**
 * The errors this package throws, and the one design note behind all of them.
 *
 * They extend `Error` rather than `@smartput/kind`'s `SmartputError`, which is
 * the base class every other package here uses. `SmartputError` carries the
 * `input` string and the character `spans` inside it that a reading failed on
 * — machinery for pointing at a phrase a person typed. Nothing in this package
 * reads a phrase: it reads a catalogue and writes a file, so both fields would
 * be permanently empty, and taking the base class would give this package its
 * only runtime dependency in exchange for two fields nobody could fill.
 */

/** The catalogue could not be read: no connection, unknown schema, no tables. */
export class IntrospectionError extends Error {
  constructor(detail: string) {
    super(`Cannot introspect: ${detail}`);
    this.name = "IntrospectionError";
  }
}

/**
 * A `@smartput` comment in the database is malformed.
 *
 * Loud rather than ignored, and this is the one place the package refuses
 * instead of emitting a TODO. Everywhere else the input is a *fact* — a type, a
 * constraint — and an unrecognised fact is honestly reported as unknown. An
 * annotation is a sentence a person wrote for this tool, so a key it does not
 * recognise is a typo, and a typo that silently produced a column without its
 * `kind` is exactly the wrong-rows failure ruling R7 exists to prevent.
 */
export class AnnotationError extends Error {
  readonly target: string;
  constructor(target: string, detail: string) {
    super(`Bad @smartput annotation on ${target}: ${detail}`);
    this.name = "AnnotationError";
    this.target = target;
  }
}

/** `--check` could not load the committed schema file, or found no schema in it. */
export class SchemaFileError extends Error {
  constructor(path: string, detail: string) {
    super(`Cannot read schema file ${path}: ${detail}`);
    this.name = "SchemaFileError";
  }
}

/** The CLI was invoked with arguments it cannot act on. */
export class UsageError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "UsageError";
  }
}
