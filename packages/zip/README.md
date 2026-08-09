# @smartput/zip

Postal codes: the literal matcher that reads one inside an expression, and the
validation and normalization layer that asks the same question directly.

```ts
import { POSTAL_FORMATS } from "@smartput/country";

const gb = POSTAL_FORMATS.for("GB");
gb.validate("sw1a1aa");  // true
gb.normalize("sw1a1aa"); // "SW1A 1AA"
gb.shape("sw1a1aa");     // "@@#@ #@@"
```

**This package ships no data.** Every entry point takes the country rows you
hand it, which is what keeps it underneath `@smartput/country` rather than
beside it: the `place` kind names `createPostalLiteral`, so a dependency in the
other direction would be a cycle. `PostalCountry` is the row contract and
`CountryRow` satisfies it, so the shipped table, a `definePlace()` table and a
row off a provider are all the same door.

Reaching a format *by code* needs a table, so that half is `PostalFormats` — an
instance over rows. `@smartput/country` exports it bound to the shipped 252 as
`POSTAL_FORMATS`; with your own rows it is `new PostalFormats(rows)`.

## One definition of "a valid GB postcode"

`format.ts` does not re-read `CountryRow.postalRegex`. It drives the literal
matcher in `literal.ts` — one country per matcher, aliases stripped, the code
offered as the whole input — because GeoNames' column is irregular enough
(Canada's trailing space, Ireland's missing `$`, the UK's `^A|B$`) that two
spellings of "what this pattern means" would disagree within a release, and the
one that disagrees silently is the parser's.

## Two limits on the way in

A code longer than `MAX_CODE_LENGTH` (40) is refused before any pattern sees it;
the longest code any shipped format can match is Portugal's, at 34. And a
pattern shaped the way catastrophic backtracking needs is refused outright, so
its country's format accepts nothing rather than everything. `isBacktrackRisk`
is exported for screening patterns of your own.

Full documentation: [Places and distances](https://smartputs.dev/guide/places).
