/**
 * Regenerates the parity fixture. Run deliberately, never automatically: a
 * fixture that re-records itself proves nothing, and the whole value of this
 * file is that changing an output produces a diff a reviewer has to approve.
 */
import { record } from "../packages/core/src/parity";

const target = new URL("../packages/core/parity/en.json", import.meta.url);
await Bun.write(target, `${JSON.stringify(record(), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
