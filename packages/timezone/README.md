# @smartput/timezone

Time zones as data: the named zones, every zone written as an offset from UTC,
and the parser that reads `GMT+3`. No runtime dependency at all.

```ts
import { OFFSET_ZONES, parseOffsetZone, ZONES, zoneSymbol } from "@smartput/timezone";

ZONES["Asia/Tokyo"];               // { aliases: ["tokyo", "jst", "japan"], symbol: "JST" }
OFFSET_ZONES["+05:30"];            // { aliases: [], symbol: "UTC+05:30" }
parseOffsetZone("gmt+5:30 stand"); // { zone: "+05:30", length: 8 }
zoneSymbol("+05:30");              // "UTC+05:30"
```

**It is a package of its own so a zone picker costs a zone picker.** These are
tables and one regex; `@smartput/datetime` is those plus `chrono-node` and
`temporal-polyfill`, which are several times the size of the engine. A form
field offering a list of zones, or validating that a user typed a real one,
needs none of that — so the dependency runs from the consumer inwards, the same
argument that keeps `@smartput/city` out of `@smartput/country`.

Every key is a string Temporal accepts as a time zone id, which is what lets a
consumer register the two tables as units of an opaque kind directly.
`@smartput/datetime` does exactly that, and adds nothing to them.

**Aliases are single words**, because `@smartput/core`'s alias index is keyed by
one segmented word: `nyc` can be an alias and `"new york"` cannot. The offset
zones carry no aliases at all — `gmt+3` lexes as three tokens, so no lookup
could reach it and `parseOffsetZone` is the door instead.

Offsets run every quarter hour from `-12:00` to `+14:00`, which is the range and
the granularity real zones are kept on.

Full documentation: [Dates and time zones](https://smartputs.dev/guide/datetime).
