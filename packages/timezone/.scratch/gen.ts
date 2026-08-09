import { parseOffsetZone } from "../src/offset";
import { zoneSymbol } from "../src/symbol";
import { ZONES } from "../src/zones";

/** Which zone id an alias names, walked back out of the shipped table. */
const byAlias = new Map<string, string>();
for (const [id, def] of Object.entries(ZONES)) {
  for (const a of def.aliases) byAlias.set(a, id);
}

const WORDS = [
  "utc",
  "gmt",
  "zulu",
  "nyc",
  "est",
  "pst",
  "la",
  "london",
  "cet",
  "kyiv",
  "kiev",
  "msk",
  "tokyo",
  "jst",
  "beijing",
  "sydney",
  "auckland",
  "delhi",
  "brt",
  "sgt",
];

const OFFSETS = [
  "gmt+3",
  "GMT+3",
  "utc-5",
  "UTC+14",
  "gmt+5:30",
  "utc+0530",
  "gmt+05:45",
  "utc-03:00",
  "gmt + 3",
  "gmt+3 meeting",
  "gmt+0",
  "gmt",
  "est+3",
  "3pm",
  "gmt+15",
  "gmt-13",
];

console.log("### words");
for (const w of WORDS) {
  const id = byAlias.get(w);
  console.log(`${w}\tword\t${id}\t-\t${zoneSymbol(id as string)}`);
}
console.log("### offsets");
for (const text of OFFSETS) {
  const m = parseOffsetZone(text);
  if (m === null) {
    console.log(`${text}\toffset\t-\t-\t-`);
    continue;
  }
  console.log(`${text}\toffset\t${m.zone}\t${m.length}\t${zoneSymbol(m.zone)}`);
}
