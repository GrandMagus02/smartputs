import type { UnitTable } from "@smartput/shared";

export type DatarateUnit = "bps" | "kbps" | "mbps" | "gbps" | "tbps";

/**
 * Canonical bits per second. Network rates are decimal by definition -- a
 * kilobit per second is 1000 bps, never 1024 -- so every ratio here is an exact
 * power of 1000 and there is nothing for a decimal string to round. Unlike
 * `speed`, no ratio needs deriving in a `units.test.ts`.
 *
 * Byte-per-second units are absent, and that is a ruling rather than an
 * oversight. Two independent reasons, either one sufficient:
 *
 * 1. `/` is an operator character and a unit word is letters plus trailing
 *    digits (`parse/lex.ts`), so "mb/s" can never lex as a single token. It
 *    lexes as a datasize divided by a duration -- which the ops in `index.ts`
 *    already answer, and that answer is a datarate.
 * 2. Aliases fold to lowercase before they reach the index (`buildRegistry`
 *    pass 5), so the letter-only spellings "Mbps" (megabit) and "MBps"
 *    (megabyte) would land on one key rather than name two units. The
 *    lowercase-only spelling wins, and megabit is the one the world means when
 *    it writes "mbps".
 *
 * The bit/byte factor that this choice implies is not hidden in a ratio here:
 * `datasize`'s canonical is the byte, this kind's is the bit, and every bridge
 * signature in `index.ts` writes the times(8)/div(8) out where it is readable.
 *
 * No spelled-out aliases for the same reason `speed` gives its `mps` no
 * `display`: "megabits per second" is a compound the parser rejects, so a word
 * form here would be a name that never parses back.
 */
export const DATARATE_UNITS: UnitTable<DatarateUnit> = {
  canonical: "bps",
  ratio: {
    bps: "1",
    kbps: "1000",
    mbps: "1000000",
    gbps: "1000000000",
    tbps: "1000000000000",
  },
  alias: {
    bps: "bps",
    kbps: "kbps",
    mbps: "mbps",
    gbps: "gbps",
    tbps: "tbps",
  },
};
