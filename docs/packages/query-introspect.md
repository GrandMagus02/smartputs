---
title: "@smartput/query-introspect"
description: "A live database catalogue into an editable query schema file."
---

# @smartput/query-introspect

A CLI, not a runtime: it reads `pg_catalog` and writes the
`defineSchema({...})` module you commit and own. A catalogue proves names,
keys, foreign keys, enumerated values and the two temporal kinds; it cannot
prove that `total_cents` is money, in what currency, or what your team calls
the sum of it — so those arrive as `TODO` comments, never as fields. Put the
answer in a `COMMENT ON COLUMN` and it survives the next regeneration.

```sh
bunx @smartput/query-introspect --url postgres://… --out schema.ts
bunx @smartput/query-introspect --url postgres://… --out schema.ts --check
```

`--check` is the half worth wiring into CI: it reads the committed file back
and fails on a migration the schema did not follow.

## Try it

<SpQuery />

## Installing

```sh
npm add @smartput/query-introspect
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/query-introspect` | The package root. |
| `@smartput/query-introspect/postgres` | `PostgresIntrospector` — the catalogue reader. |

## Runtime exports

Type-only exports are erased and do not appear here.

`AnnotationError` · `DriftCheck` · `IntrospectionError` · `SchemaEmitter` · `SchemaFileError` · `UsageError` · `columnAnnotation` · `geoHint` · `hintFor` · `loadSchemaFile` · `provenBinding` · `provenKind` · `skipped` · `tableAnnotation`

## Dependencies

None. Not "none for now" — this package is depended on by others precisely
because it has none.

## See also

- [Querying a database](/packages/query)

