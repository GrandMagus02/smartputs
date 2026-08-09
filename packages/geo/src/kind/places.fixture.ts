import type { Admin1Row, CityRow, CountryRow } from "./types";

/**
 * The tables the kind's tests are built on.
 *
 * A fixture and not a gazetteer, and the distinction is the whole reason this
 * file is allowed to exist in a package whose point is that it ships no place
 * data. It is `.fixture.ts`, the convention `@smartput/query`'s `shop.fixture.ts`
 * already sets: nothing imports it but a test, it is not reachable from either
 * package entry point, and no consumer can get at it.
 *
 * **What it is for.** The tests next door assert *logic* — that a two-letter
 * alias never reaches the global index, that a scoped claim walks the trie
 * rather than becoming an operation, that a capital outranks a larger
 * non-capital, that "km" stays a kilometre. None of that needs 252 countries; it
 * needs the handful of rows where the rule is visible, which is what these are.
 * Every row below is here because a test would be unable to state its rule
 * without it, and the header on each group says which rule.
 *
 * **What it is not for.** It cannot stand in for the sweep the vendored tables
 * used to support — "no alias of any of 6 247 cities collides with a keyword" is
 * a claim about real data, and a fixture that satisfied it would only be saying
 * that the fixture is fine. That claim now lives in `live.network.test.ts`,
 * which asks GeoNames and is skipped when no account is configured.
 *
 * **Values.** Populations and coordinates are approximately real, because the
 * ranking tests turn on them. `geonameId`s are real where they are well known
 * and are not asserted on anywhere — they exist so that two rows are two places.
 * Aliases are hand-written to the rule `countryTable()` applies: lowercased, at
 * most four words, nothing under three characters except the alpha-2 itself.
 */

/** Shorthand so a row reads as its facts rather than as fourteen keys. */
function country(
  a2: string,
  a3: string,
  name: string,
  aliases: readonly string[],
  over: Partial<CountryRow> = {},
): CountryRow {
  return {
    a2,
    a3,
    name,
    aliases: [...new Set([...aliases, name.toLowerCase(), a3, a2])],
    capital: "",
    currency: "",
    phone: "",
    population: 0,
    area: 0,
    lat: 0,
    lon: 0,
    zone: "UTC",
    geonameId: 0,
    postalRegex: "",
    ...over,
  };
}

function city(
  geonameId: number,
  name: string,
  countryCode: string,
  over: Partial<CityRow> = {},
): CityRow {
  return {
    geonameId,
    name,
    aliases: [name.toLowerCase()],
    country: countryCode,
    admin1: "",
    lat: 0,
    lon: 0,
    zone: "UTC",
    population: 0,
    capital: false,
    ...over,
  };
}

/**
 * The countries.
 *
 * Grouped by the rule each group exists to make visible, because a fixture whose
 * rows have no stated reason is one nobody dares delete from.
 */
export const COUNTRIES: readonly CountryRow[] = [
  // The ordinary case, and the one most tests reach for first. Japan has a
  // currency the rates bridge reads, a capital's zone the datetime bridge reads,
  // and a name nothing else in any table claims.
  country("jp", "jpn", "Japan", ["nippon", "nihon"], {
    capital: "Tokyo",
    currency: "JPY",
    phone: "81",
    population: 127_185_332,
    area: 377_835,
    lat: 35.68536,
    lon: 139.75309,
    zone: "Asia/Tokyo",
    geonameId: 1_861_060,
    postalRegex: "^\\d{3}-\\d{4}$",
  }),
  country("ua", "ukr", "Ukraine", ["ukraina"], {
    capital: "Kyiv",
    currency: "UAH",
    phone: "380",
    population: 44_622_516,
    area: 603_700,
    lat: 50.45466,
    lon: 30.5238,
    zone: "Europe/Kyiv",
    geonameId: 690_791,
    postalRegex: "^\\d{5}$",
  }),
  // The alias cases. "uk" is two letters and therefore refused as an alias by
  // the rule in `countryTable`, which is exactly why "united kingdom" and
  // "britain" have to be there — a country whose only short name is refused must
  // still be reachable.
  country("gb", "gbr", "United Kingdom", ["britain", "great britain", "england"], {
    capital: "London",
    currency: "GBP",
    phone: "44",
    population: 66_488_991,
    area: 244_820,
    lat: 51.50853,
    lon: -0.12574,
    zone: "Europe/London",
    geonameId: 2_635_167,
    postalRegex:
      "^(([A-Z]{1,2}\\d[A-Z\\d]?|ASCN|STHL|TDCU|BBND|[BFS]IQQ|PCRN|TKCA) ?\\d[A-Z]{2}|BFPO ?\\d{1,4}|(KY\\d|MSR|VG|AI)[ -]?\\d{4}|[A-Z]{2} ?\\d{2}|GE ?CX|GIR ?0A{2}|SIQQ ?1ZZ)$",
  }),
  country("fr", "fra", "France", ["republique francaise"], {
    capital: "Paris",
    currency: "EUR",
    phone: "33",
    population: 66_987_244,
    area: 547_030,
    lat: 48.85341,
    lon: 2.3488,
    zone: "Europe/Paris",
    geonameId: 3_017_382,
    postalRegex: "^\\d{5}$",
  }),
  country("us", "usa", "United States", ["america", "usa", "united states of america"], {
    capital: "Washington",
    currency: "USD",
    phone: "1",
    population: 327_167_434,
    area: 9_629_091,
    lat: 38.89511,
    lon: -77.03637,
    zone: "America/New_York",
    geonameId: 6_252_001,
    postalRegex: "^\\d{5}(-\\d{4})?$",
  }),
  // The two Congos: one name, two countries, and the reason `congo` must be
  // ambiguous rather than resolved by whichever row the table happened to list
  // first. `kinshasa congo` is the scoped reading that picks one.
  country("cd", "cod", "Democratic Republic of the Congo", ["congo", "drc", "zaire"], {
    capital: "Kinshasa",
    currency: "CDF",
    phone: "243",
    population: 84_068_091,
    area: 2_345_410,
    lat: -4.32758,
    lon: 15.31357,
    zone: "Africa/Kinshasa",
    geonameId: 203_312,
  }),
  country("cg", "cog", "Republic of the Congo", ["congo", "congo brazzaville"], {
    capital: "Brazzaville",
    currency: "XAF",
    phone: "242",
    population: 5_244_363,
    area: 342_000,
    lat: -4.26613,
    lon: 15.28318,
    zone: "Africa/Brazzaville",
    geonameId: 2_260_494,
  }),
  // Georgia is a country *and* a US state, which is the collision that makes
  // `US.GA` below load-bearing: a scoped `atlanta georgia` must not be able to
  // read its scope as the country.
  country("ge", "geo", "Georgia", ["sakartvelo"], {
    capital: "Tbilisi",
    currency: "GEL",
    phone: "995",
    population: 3_731_000,
    area: 69_700,
    lat: 41.69411,
    lon: 44.83368,
    zone: "Asia/Tbilisi",
    geonameId: 614_540,
  }),
  // A country whose name is a prefix of another country's, which is what stops
  // a trie walk from stopping at the first terminal it reaches.
  country("nl", "nld", "Netherlands", ["holland"], {
    capital: "Amsterdam",
    currency: "EUR",
    phone: "31",
    population: 17_231_017,
    area: 41_526,
    lat: 52.37403,
    lon: 4.88969,
    zone: "Europe/Amsterdam",
    geonameId: 2_750_405,
    postalRegex: "^\\d{4} ?[A-Z]{2}$",
  }),
  country("an", "ant", "Netherlands Antilles", [], {
    capital: "Willemstad",
    currency: "ANG",
    phone: "599",
    population: 300_000,
    area: 960,
    lat: 12.1084,
    lon: -68.9335,
    zone: "America/Curacao",
    geonameId: 8_505_032,
  }),
  // A city-state: the one row where a country and a city are the same place, and
  // the tie-break §6.1 rules on has nothing to separate.
  country("sg", "sgp", "Singapore", [], {
    capital: "Singapore",
    currency: "SGD",
    phone: "65",
    population: 5_638_676,
    area: 693,
    lat: 1.28967,
    lon: 103.85007,
    zone: "Asia/Singapore",
    geonameId: 1_880_251,
    postalRegex: "^\\d{6}$",
  }),
  // Multi-word names, for the matcher's word cap and the completer's prefixes.
  country("nz", "nzl", "New Zealand", ["aotearoa"], {
    capital: "Wellington",
    currency: "NZD",
    phone: "64",
    population: 4_885_500,
    area: 268_680,
    lat: -41.28664,
    lon: 174.77557,
    zone: "Pacific/Auckland",
    geonameId: 2_186_224,
    postalRegex: "^\\d{4}$",
  }),
  country("ae", "are", "United Arab Emirates", ["emirates"], {
    capital: "Abu Dhabi",
    currency: "AED",
    phone: "971",
    population: 9_630_959,
    area: 82_880,
    lat: 24.45118,
    lon: 54.39696,
    zone: "Asia/Dubai",
    geonameId: 290_557,
  }),
  country("pl", "pol", "Poland", ["polska"], {
    capital: "Warsaw",
    currency: "PLN",
    phone: "48",
    population: 37_978_548,
    area: 312_685,
    lat: 52.22977,
    lon: 21.01178,
    zone: "Europe/Warsaw",
    geonameId: 798_544,
    postalRegex: "^\\d{2}-\\d{3}$",
  }),
  country("es", "esp", "Spain", ["espana"], {
    capital: "Madrid",
    currency: "EUR",
    phone: "34",
    population: 46_723_749,
    area: 504_782,
    lat: 40.4165,
    lon: -3.70256,
    zone: "Europe/Madrid",
    geonameId: 2_510_769,
    postalRegex: "^\\d{5}$",
  }),
  country("gr", "grc", "Greece", ["hellas", "ellada"], {
    capital: "Athens",
    currency: "EUR",
    phone: "30",
    population: 10_727_668,
    area: 131_940,
    lat: 37.98376,
    lon: 23.72784,
    zone: "Europe/Athens",
    geonameId: 390_903,
    postalRegex: "^\\d{3} ?\\d{2}$",
  }),
  country("au", "aus", "Australia", [], {
    capital: "Canberra",
    currency: "AUD",
    phone: "61",
    population: 24_992_369,
    area: 7_686_850,
    lat: -35.28346,
    lon: 149.12807,
    zone: "Australia/Sydney",
    geonameId: 2_077_456,
    postalRegex: "^\\d{4}$",
  }),
  country("ca", "can", "Canada", [], {
    capital: "Ottawa",
    currency: "CAD",
    phone: "1",
    population: 37_058_856,
    area: 9_984_670,
    lat: 45.41117,
    lon: -75.69812,
    zone: "America/Toronto",
    geonameId: 6_251_999,
    postalRegex: "^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$",
  }),
  country("ru", "rus", "Russia", ["russian federation"], {
    capital: "Moscow",
    currency: "RUB",
    phone: "7",
    population: 144_478_050,
    area: 17_100_000,
    lat: 55.75222,
    lon: 37.61556,
    zone: "Europe/Moscow",
    geonameId: 2_017_370,
    postalRegex: "^\\d{6}$",
  }),
  // "soudan" is the French name and reaches the trie as an alias; "sudan" is the
  // English one. Both, because a test asserts an alias is not the display name.
  // The rows the matcher's own tests name, each for a rule that needs a country
  // with a particular *shape* of name rather than a particular country.
  //
  // "km" is the collision the whole two-letter refusal exists for: Comoros'
  // alpha-2 is a kilometre, and the fold is destructive, so a code that did not
  // yield to a registered unit alias would cost every "10 km" its reading.
  country("km", "com", "Comoros", [], {
    currency: "KMF",
    zone: "Indian/Comoro",
    geonameId: 921_929,
  }),
  // A long multi-word name whose first word is also a claim, for the trie's
  // longest-match walk.
  country("ba", "bih", "Bosnia and Herzegovina", ["bosnia"], {
    currency: "BAM",
    zone: "Europe/Sarajevo",
    geonameId: 3_277_605,
    postalRegex: "^\\d{5}$",
  }),
  // The four whose names contain a word the engine owns — "and", "guinea" three
  // times over, "new" — which is what makes a scan-based matcher wrong and a
  // trie walk right.
  country("gn", "gin", "Guinea", [], {
    currency: "GNF",
    zone: "Africa/Conakry",
    geonameId: 2_420_477,
  }),
  country("gq", "gnq", "Equatorial Guinea", [], {
    currency: "XAF",
    zone: "Africa/Malabo",
    geonameId: 2_309_096,
  }),
  country("pg", "png", "Papua New Guinea", [], {
    currency: "PGK",
    zone: "Pacific/Port_Moresby",
    geonameId: 2_088_628,
  }),
  country("sv", "slv", "El Salvador", ["salvador"], {
    currency: "USD",
    zone: "America/El_Salvador",
    geonameId: 3_585_968,
    postalRegex: "^\\d{4}$",
  }),
  // Two-letter alpha-2s that are English words in their own right: "as", "in"
  // and "to" are American Samoa, India and Tonga, and every one of them is a
  // keyword the parser needs more than it needs a country.
  country("as", "asm", "American Samoa", [], {
    currency: "USD",
    zone: "Pacific/Pago_Pago",
    geonameId: 5_880_801,
  }),
  country("ws", "wsm", "Samoa", [], {
    currency: "WST",
    zone: "Pacific/Apia",
    geonameId: 4_034_894,
  }),
  country("in", "ind", "India", [], {
    currency: "INR",
    zone: "Asia/Kolkata",
    geonameId: 1_269_750,
    postalRegex: "^\\d{6}$",
  }),
  country("cn", "chn", "China", [], {
    currency: "CNY",
    zone: "Asia/Shanghai",
    geonameId: 1_814_991,
    postalRegex: "^\\d{6}$",
  }),
  // Two countries whose common English name is a *prefix phrase* of another
  // country's official one, which is where a longest-match walk earns its keep.
  country("kr", "kor", "South Korea", ["korea", "republic of korea"], {
    currency: "KRW",
    zone: "Asia/Seoul",
    geonameId: 1_835_841,
    postalRegex: "^\\d{5}$",
  }),
  country("tw", "twn", "Taiwan", ["republic of china"], {
    currency: "TWD",
    zone: "Asia/Taipei",
    geonameId: 1_668_284,
  }),
  country("mc", "mco", "Monaco", [], {
    currency: "EUR",
    zone: "Europe/Monaco",
    geonameId: 2_993_457,
    postalRegex: "^980\\d{2}$",
  }),
  country("vg", "vgb", "British Virgin Islands", ["virgin islands"], {
    currency: "USD",
    zone: "America/Tortola",
    geonameId: 3_577_718,
  }),

  // The postal shapes. These rows exist for `../postal/format.test.ts` and carry
  // GeoNames' own `postalCodeRegex` verbatim, because the pattern *is* the
  // subject: Portugal has two separators and cannot be rebuilt by one
  // reinsertion, Andorra and Sweden prefix their codes with the country's
  // letters, Ireland's is the one row upstream leaves without a closing anchor,
  // Malta's is letters-then-digits, and Canada's alternates the two. A country
  // here with nothing else about it is a country that had nothing else to say.
  country("de", "deu", "Germany", ["deutschland"], {
    currency: "EUR",
    zone: "Europe/Berlin",
    geonameId: 2_921_044,
    postalRegex: "^\\d{5}$",
  }),
  country("ad", "and", "Andorra", ["principality of andorra"], {
    currency: "EUR",
    zone: "Europe/Andorra",
    geonameId: 3_041_565,
    postalRegex: "^(?:AD)*(\\d{3})$",
  }),
  country("se", "swe", "Sweden", ["sverige"], {
    currency: "SEK",
    zone: "Europe/Stockholm",
    geonameId: 2_661_886,
    postalRegex: "^(?:SE)*(\\d{3}\\s?\\d{2})$",
  }),
  country("az", "aze", "Azerbaijan", [], {
    currency: "AZN",
    zone: "Asia/Baku",
    geonameId: 587_116,
    // A space where Moldova has a dash, so the separator search is exercised on
    // both characters rather than only on the one that is easy to spot.
    postalRegex: "^AZ \\d{4}$",
  }),
  country("md", "mda", "Moldova", [], {
    currency: "MDL",
    zone: "Europe/Chisinau",
    geonameId: 617_790,
    // The separator is inside the prefix here, not between the digits, which is
    // what makes this row worth having: a normalizer that assumed the separator
    // splits the numeric part would put it in the wrong place.
    postalRegex: "^MD-\\d{4}$",
  }),
  country("cz", "cze", "Czechia", ["czech republic"], {
    currency: "CZK",
    zone: "Europe/Prague",
    geonameId: 3_077_311,
    postalRegex: "^\\d{3}\\s?\\d{2}$",
  }),
  country("br", "bra", "Brazil", ["brasil"], {
    currency: "BRL",
    zone: "America/Sao_Paulo",
    geonameId: 3_469_034,
    postalRegex: "^\\d{5}-\\d{3}$",
  }),
  // Two separators, and the row that proves a normalizer cannot work by
  // reinserting one.
  country("pt", "prt", "Portugal", [], {
    currency: "EUR",
    zone: "Europe/Lisbon",
    geonameId: 2_264_397,
    postalRegex: "^\\d{4}-\\d{3}\\s?[a-zA-Z]{0,25}$",
  }),
  // Letters first, then digits: the separator search cannot assume a position.
  country("mt", "mlt", "Malta", [], {
    currency: "EUR",
    zone: "Europe/Malta",
    geonameId: 2_562_770,
    postalRegex: "^[A-Z]{3}\\s?\\d{2,4}$",
  }),
  // The one pattern upstream ships with no closing `$`, which is what makes
  // `PostalFormat`'s re-anchoring observable rather than theoretical.
  country("ie", "irl", "Ireland", ["eire"], {
    capital: "Dublin",
    currency: "EUR",
    phone: "353",
    population: 4_853_506,
    area: 70_280,
    lat: 53.34399,
    lon: -6.26719,
    zone: "Europe/Dublin",
    geonameId: 2_963_597,
    postalRegex: "^(?:^[AC-FHKNPRTV-Y][0-9]{2}|D6W)[ -]?[0-9AC-FHKNPRTV-Y]{4}",
  }),
  // The three with no postal system at all, so `for()` has a real null to
  // return: an empty pattern anchored as `^(?:)$` matches the empty string and,
  // unanchored, matches everything.
  country("aq", "ata", "Antarctica", [], {
    zone: "Antarctica/Casey",
    geonameId: 6_697_173,
  }),
  country("to", "ton", "Tonga", [], {
    currency: "TOP",
    zone: "Pacific/Tongatapu",
    geonameId: 4_032_283,
  }),
  country("ky", "cym", "Cayman Islands", [], {
    currency: "KYD",
    zone: "America/Cayman",
    geonameId: 3_580_718,
  }),
  country("sd", "sdn", "Sudan", ["soudan"], {
    capital: "Khartoum",
    currency: "SDG",
    phone: "249",
    population: 41_801_533,
    area: 1_861_484,
    lat: 15.55177,
    lon: 32.53241,
    zone: "Africa/Khartoum",
    geonameId: 366_755,
    postalRegex: "^\\d{5}$",
  }),
];

/**
 * The cities.
 *
 * Every one is a duplicate name, a reserved-word collision or a capital, because
 * a city whose name is unique and inert proves nothing the countries above do
 * not already prove.
 */
export const CITIES: readonly CityRow[] = [
  // Capitals: §6.1 weights a seat of government above a larger non-capital, and
  // these are the rows that make that orderable.
  city(703_448, "Kyiv", "ua", {
    admin1: "30",
    population: 2_797_553,
    capital: true,
    zone: "Europe/Kyiv",
    lat: 50.45466,
    lon: 30.5238,
  }),
  city(1_850_147, "Tokyo", "jp", {
    admin1: "40",
    population: 8_336_599,
    capital: true,
    zone: "Asia/Tokyo",
    lat: 35.6895,
    lon: 139.69171,
  }),
  city(756_135, "Warsaw", "pl", {
    admin1: "78",
    population: 1_702_139,
    capital: true,
    zone: "Europe/Warsaw",
    lat: 52.22977,
    lon: 21.01178,
  }),
  city(2_314_302, "Kinshasa", "cd", {
    admin1: "12",
    population: 7_785_965,
    capital: true,
    zone: "Africa/Kinshasa",
    lat: -4.32758,
    lon: 15.31357,
  }),
  city(264_371, "Athens", "gr", {
    admin1: "ESYE31",
    population: 664_046,
    capital: true,
    zone: "Europe/Athens",
    lat: 37.98376,
    lon: 23.72784,
  }),
  // One name, two countries. `paris` alone is France; `paris texas` and
  // `paris tx` are the scoped claim geo spec §5.2 exists for.
  city(2_988_507, "Paris", "fr", {
    admin1: "11",
    population: 2_138_551,
    capital: true,
    zone: "Europe/Paris",
    lat: 48.85341,
    lon: 2.3488,
  }),
  city(4_717_560, "Paris", "us", {
    admin1: "TX",
    population: 25_171,
    zone: "America/Chicago",
    lat: 33.66094,
    lon: -95.55551,
  }),
  // One name, two divisions of one country — the case a country scope cannot
  // separate and an admin1 scope can.
  city(4_250_542, "Springfield", "us", {
    admin1: "IL",
    population: 116_250,
    zone: "America/Chicago",
    lat: 39.80172,
    lon: -89.64371,
  }),
  city(4_409_896, "Springfield", "us", {
    admin1: "MO",
    population: 167_882,
    zone: "America/Chicago",
    lat: 37.21533,
    lon: -93.29824,
  }),
  city(5_174_035, "Toledo", "us", {
    admin1: "OH",
    population: 276_491,
    zone: "America/New_York",
    lat: 41.66394,
    lon: -83.55521,
  }),
  city(5_814_616, "Vancouver", "us", {
    admin1: "WA",
    population: 183_012,
    zone: "America/Los_Angeles",
    lat: 45.63873,
    lon: -122.66149,
  }),
  city(6_173_331, "Vancouver", "ca", {
    admin1: "BC",
    population: 600_000,
    zone: "America/Vancouver",
    lat: 49.24966,
    lon: -123.11934,
  }),
  city(2_147_714, "Sydney", "au", {
    admin1: "02",
    population: 4_627_345,
    zone: "Australia/Sydney",
    lat: -33.86785,
    lon: 151.20732,
  }),
  city(6_354_908, "Sydney", "ca", {
    admin1: "07",
    population: 29_904,
    zone: "America/Glace_Bay",
    lat: 46.13511,
    lon: -60.18313,
  }),
  // Cities whose name is also a country's, which is where §6.1's country-over-
  // city ruling is observable: a country is +3 and no city goes above +2, so the
  // country takes the name and `singapore to japan` stays a distance between two
  // countries. One per shape — a city-state, a city in a different country from
  // the one it shares a name with, and a city whose namesake country is an alias
  // rather than a display name.
  city(2_993_458, "Monaco", "mc", {
    population: 32_965,
    capital: true,
    zone: "Europe/Monaco",
    lat: 43.73333,
    lon: 7.41667,
  }),
  city(3_450_554, "Salvador", "br", {
    admin1: "05",
    population: 2_711_840,
    zone: "America/Bahia",
    lat: -12.97111,
    lon: -38.51083,
  }),
  // The reserved-word collisions. Every one of these is a real city of over
  // 100 000 people whose name is a word the engine needs, and the generator's
  // refusal list is what keeps them out of the alias index — `nice` must stay a
  // comparison word, `reading` a gerund, `mobile` an adjective.
  city(2_990_440, "Nice", "fr", {
    admin1: "93",
    population: 338_620,
    zone: "Europe/Paris",
    lat: 43.70313,
    lon: 7.26608,
  }),
  city(2_639_912, "Reading", "gb", {
    admin1: "ENG",
    population: 232_662,
    zone: "Europe/London",
    lat: 51.45625,
    lon: -0.97113,
  }),
  city(4_076_598, "Mobile", "us", {
    admin1: "AL",
    population: 189_572,
    zone: "America/Chicago",
    lat: 30.69436,
    lon: -88.04305,
  }),
  // Plain large cities, for the ranking tests and for `kyiv to warsaw`'s
  // American cousins.
  city(4_887_398, "Chicago", "us", {
    admin1: "IL",
    population: 2_720_546,
    zone: "America/Chicago",
    lat: 41.85003,
    lon: -87.65005,
  }),
  city(5_368_361, "Los Angeles", "us", {
    admin1: "CA",
    population: 3_971_883,
    zone: "America/Los_Angeles",
    lat: 34.05223,
    lon: -118.24368,
  }),
  city(5_391_959, "San Francisco", "us", {
    admin1: "CA",
    population: 864_816,
    zone: "America/Los_Angeles",
    lat: 37.77493,
    lon: -122.41942,
  }),
  city(5_128_581, "New York City", "us", {
    admin1: "NY",
    population: 8_175_133,
    zone: "America/New_York",
    lat: 40.71427,
    lon: -74.00597,
  }),
  city(5_101_798, "Newark", "us", {
    admin1: "NJ",
    population: 277_140,
    zone: "America/New_York",
    lat: 40.73566,
    lon: -74.17237,
  }),
  city(4_180_439, "Atlanta", "us", {
    admin1: "GA",
    population: 463_878,
    zone: "America/New_York",
    lat: 33.749,
    lon: -84.38798,
  }),
  // A city whose every alias is under the length floor, which is why it is
  // absent from the alias index and reachable only as a scoped claim.
  city(479_561, "Ufa", "ru", {
    admin1: "08",
    population: 1_033_338,
    zone: "Asia/Yekaterinburg",
    lat: 54.74306,
    lon: 55.96779,
  }),
  // The city-state's city half. Same name and same country as its country row,
  // which is the one place §6.1's country-over-city rule has to be stated.
  city(1_880_252, "Singapore", "sg", {
    population: 3_547_809,
    capital: true,
    zone: "Asia/Singapore",
    lat: 1.28967,
    lon: 103.85007,
  }),
];

/**
 * The divisions.
 *
 * Only the ones a city above is scoped by, plus the two whose codes are words
 * the engine needs: Indiana's "in" and Oregon's "or" are why `RESERVED_WORDS`
 * applies to an admin1 alias at all, and a fixture without them cannot say so.
 */
export const ADMIN1: readonly Admin1Row[] = [
  { key: "US.IL", name: "Illinois", aliases: ["illinois", "il"] },
  { key: "US.MO", name: "Missouri", aliases: ["missouri", "mo"] },
  { key: "US.TX", name: "Texas", aliases: ["texas", "tx"] },
  { key: "US.OH", name: "Ohio", aliases: ["ohio", "oh"] },
  { key: "US.WA", name: "Washington", aliases: ["washington", "wa"] },
  { key: "US.CA", name: "California", aliases: ["california", "ca"] },
  { key: "US.NY", name: "New York", aliases: ["new york", "ny"] },
  { key: "US.NJ", name: "New Jersey", aliases: ["new jersey", "nj"] },
  { key: "US.AL", name: "Alabama", aliases: ["alabama", "al"] },
  // The country/state collision: `atlanta georgia` must scope to this and never
  // to the country `ge`.
  { key: "US.GA", name: "Georgia", aliases: ["georgia", "ga"] },
  // The two whose codes the reserved list refuses.
  { key: "US.IN", name: "Indiana", aliases: ["indiana"] },
  { key: "US.OR", name: "Oregon", aliases: ["oregon"] },
  { key: "CA.BC", name: "British Columbia", aliases: ["british columbia", "bc"] },
  { key: "CA.NS", name: "Nova Scotia", aliases: ["nova scotia", "ns"] },
  { key: "AU.02", name: "New South Wales", aliases: ["new south wales", "nsw"] },
];
