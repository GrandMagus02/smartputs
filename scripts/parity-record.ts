/**
 * Regenerates the parity fixture. Run deliberately, never automatically: a
 * fixture that re-records itself proves nothing, and the whole value of this
 * file is that changing an output produces a diff a reviewer has to approve.
 */
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "../packages/core/src/engine";
import en from "../packages/core/src/locale/en";
import { record } from "../packages/core/src/parity";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

const target = new URL("../packages/core/parity/en.json", import.meta.url);
await Bun.write(target, `${JSON.stringify(record(engine), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
