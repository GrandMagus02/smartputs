import { ADMIN1 } from "../src/data/admin1";
import { CITIES } from "../src/data/cities";

const byAlias = new Map<string, typeof CITIES>();
for (const city of CITIES) {
  for (const alias of city.aliases) {
    const list = byAlias.get(alias) ?? [];
    byAlias.set(alias, [...list, city] as typeof CITIES);
  }
}

/** The largest claimant, which is how the matcher ranks a bare alias. */
const biggest = (alias: string) => {
  const list = byAlias.get(alias);
  if (list === undefined) return undefined;
  return [...list].sort((a, b) => b.population - a.population)[0];
};

const CITY_WORDS = [
  "kyiv",
  "kiev",
  "warsaw",
  "paris",
  "tokyo",
  "new york city",
  "nyc",
  "london",
  "berlin",
  "san francisco",
  "los angeles",
  "sao paulo",
  "mumbai",
  "bombay",
  "istanbul",
  "cairo",
  "reykjavik",
  "wellington",
  "vatican city",
  "shanghai",
  "itu",
  "poa",
];

const ADMIN_WORDS = [
  "texas",
  "tx",
  "california",
  "ontario",
  "bavaria",
  "kent",
  "in",
  "or",
  "ca",
];

console.log("### cities");
for (const word of CITY_WORDS) {
  const c = biggest(word);
  if (c === undefined) {
    console.log(`${word}\tcity\t-\t-\t-\t-\t-`);
    continue;
  }
  console.log(
    `${word}\tcity\t${c.geonameId}\t${c.name}\t${c.country}\t${c.admin1 === "" ? "-" : c.admin1}\t${c.zone}`,
  );
}

console.log("### admin1");
for (const word of ADMIN_WORDS) {
  const hits = ADMIN1.filter((a) => a.aliases.includes(word));
  if (hits.length === 0) {
    console.log(`${word}\tadmin1\t-\t-\t-\t-\t-`);
    continue;
  }
  const first = hits[0];
  if (first === undefined) throw new Error("unreachable");
  const [country, code] = first.key.split(".");
  console.log(
    `${word}\tadmin1\t${first.key}\t${first.name}\t${(country ?? "").toLowerCase()}\t${code}\t-`,
  );
}
