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
    // Display name, then the two codes, then whatever else the row was given —
    // the order `countryTable()` emits. It matters at every tie: "ukraine" and
    // "ukraina" are both seven characters and both begin "ukrai", so nothing but
    // insertion order decides which one a completion is labelled with, and the
    // one upstream puts first is the name.
    aliases: [...new Set([name.toLowerCase(), a3, a2, ...aliases])],
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
    population: 126_529_100,
    area: 377_835,
    lat: 35.6895,
    lon: 139.69171,
    zone: "Asia/Tokyo",
    geonameId: 1_861_060,
    postalRegex: "^\\d{3}-\\d{4}$",
  }),
  // The historical alias is the long one upstream carries, not a near-spelling
  // of the name: an alias that ties the display name on both weight and length
  // would be separated by nothing but alphabetical order, and would label a
  // completion of "ukrai" with a word the user did not mean.
  country("ua", "ukr", "Ukraine", ["ukrainian soviet socialist republic"], {
    capital: "Kyiv",
    currency: "UAH",
    phone: "380",
    population: 40_000_000,
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
    // GeoNames' own column 14, and the row the anchoring rule exists for: it is
    // written `^A|B$`, which read verbatim means "starts with A, or ends with B"
    // and claims "GIR0AAX". Reanchoring is what makes it a whole-string test.
    //
    // Not the widely copied variant with an `[A-Z]{2} ?\d{2}` branch in it. That
    // branch accepts two letters and two digits, so it claims "OF 50" out of
    // "20% of 50" and takes the subtraction underneath it — which is exactly
    // what the UNTOUCHED suite below is watching for.
    postalRegex:
      "^([Gg][Ii][Rr]\\s?0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z]))))\\s?[0-9][A-Za-z]{2})$",
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
  // France's neighbour, and the second half of the distance rows: `france to
  // germany` and `paris to berlin` are the same 878 km because a country's
  // coordinates are its capital's, which is the convention every full row above
  // follows and the one that makes the two queries agree.
  country("de", "deu", "Germany", ["deutschland"], {
    capital: "Berlin",
    currency: "EUR",
    phone: "49",
    population: 82_927_922,
    area: 357_021,
    lat: 52.52437,
    lon: 13.41053,
    zone: "Europe/Berlin",
    geonameId: 2_921_044,
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
  // The four-word alias, and the only row that can state the walk's bound: the
  // trie is offered at most four words, so this claims whole and a five-word
  // alias would be dead data.
  country(
    "ae",
    "are",
    "United Arab Emirates",
    ["emirates", "federation of arab emirates"],
    {
      capital: "Abu Dhabi",
      currency: "AED",
      phone: "971",
      population: 9_630_959,
      area: 82_880,
      lat: 24.45118,
      lon: 54.39696,
      zone: "Asia/Dubai",
      geonameId: 290_557,
    },
  ),
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
    postalRegex: "^(\\d{5})$",
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
  // The five whose names contain a word the engine owns — "and", "guinea" four
  // times over, "new" — which is what makes a scan-based matcher wrong and a
  // trie walk right. Guinea-Bissau is the hyphenated one, and it is the row that
  // says a claim's length lands on a word boundary when the boundary is a
  // hyphen rather than a space.
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
  country("gw", "gnb", "Guinea-Bissau", [], {
    currency: "XOF",
    zone: "Africa/Bissau",
    geonameId: 2_372_248,
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
  // Here for its capital rather than for itself: San José is the capital that
  // has to outrank the larger San Jose in California, which is §6.1's
  // capital-over-population rule stated on a name two countries share.
  country("cr", "cri", "Costa Rica", [], {
    capital: "San José",
    currency: "CRC",
    phone: "506",
    population: 4_999_441,
    area: 51_100,
    lat: 9.93333,
    lon: -84.08333,
    zone: "America/Costa_Rica",
    geonameId: 3_624_060,
    postalRegex: "^\\d{5}$",
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
  // Carries its facts as well as its name, because it is the corpus row that
  // takes the population abbreviation past a billion.
  country("cn", "chn", "China", [], {
    capital: "Beijing",
    currency: "CNY",
    phone: "86",
    population: 1_411_778_724,
    area: 9_596_960,
    lat: 39.9075,
    lon: 116.39723,
    zone: "Asia/Shanghai",
    geonameId: 1_814_991,
    postalRegex: "^\\d{6}$",
  }),
  // Two countries whose common English name is a *prefix phrase* of another
  // country's official one, which is where a longest-match walk earns its keep.
  //
  // Neither Korea carries the bare "korea", and that is upstream's shape rather
  // than an omission here: GeoNames aliases each by its official name, so the
  // commonest English word for either is unclaimable and `3pm in korea` has no
  // reading. Curating one in would put country data in the fixture and hide the
  // gap the matcher test records.
  country("kr", "kor", "South Korea", ["republic of korea"], {
    currency: "KRW",
    zone: "Asia/Seoul",
    geonameId: 1_835_841,
    postalRegex: "^\\d{5}$",
  }),
  country("kp", "prk", "North Korea", ["democratic peoples republic of korea"], {
    currency: "KPW",
    zone: "Asia/Pyongyang",
    geonameId: 1_873_107,
    postalRegex: "^\\d{6}$",
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
  // Czechia's format to the character, and the third country that accepts it
  // alongside Sweden's. A shape three countries share is what makes "123 45" a
  // claim with three readings rather than an answer.
  country("sk", "svk", "Slovakia", ["slovak republic"], {
    currency: "EUR",
    zone: "Europe/Bratislava",
    geonameId: 3_057_568,
    postalRegex: "^\\d{3}\\s?\\d{2}$",
  }),
  // The three Crown dependencies, which accept the British format and are the
  // reason a shared shape has to arrive ranked: emitted at one weight each they
  // would tie with the United Kingdom and turn an unambiguous code into an
  // AmbiguityError naming Jersey. Populations are what separate them.
  country("je", "jey", "Jersey", [], {
    currency: "GBP",
    population: 90_812,
    zone: "Europe/Jersey",
    geonameId: 3_042_142,
    postalRegex:
      "^((?:(?:[A-PR-UWYZ][A-HK-Y]\\d[ABEHMNPRV-Y0-9]|[A-PR-UWYZ]\\d[A-HJKPS-UW0-9])\\s\\d[ABD-HJLNP-UW-Z]{2})|GIR\\s?0AA)$",
  }),
  country("im", "imn", "Isle of Man", [], {
    currency: "GBP",
    population: 84_077,
    zone: "Europe/Isle_of_Man",
    geonameId: 3_042_225,
    postalRegex:
      "^((?:(?:[A-PR-UWYZ][A-HK-Y]\\d[ABEHMNPRV-Y0-9]|[A-PR-UWYZ]\\d[A-HJKPS-UW0-9])\\s\\d[ABD-HJLNP-UW-Z]{2})|GIR\\s?0AA)$",
  }),
  country("gg", "ggy", "Guernsey", [], {
    currency: "GBP",
    population: 65_228,
    zone: "Europe/Guernsey",
    geonameId: 3_042_362,
    postalRegex:
      "^((?:(?:[A-PR-UWYZ][A-HK-Y]\\d[ABEHMNPRV-Y0-9]|[A-PR-UWYZ]\\d[A-HJKPS-UW0-9])\\s\\d[ABD-HJLNP-UW-Z]{2})|GIR\\s?0AA)$",
  }),
  // The five-digit shape, and the country a qualifier reaches: "90210" is sixty
  // countries' code at once, so `mexico 90210` is how one of them is named.
  country("mx", "mex", "Mexico", ["united mexican states"], {
    capital: "Mexico City",
    currency: "MXN",
    phone: "52",
    population: 126_190_788,
    area: 1_972_550,
    lat: 19.42847,
    lon: -99.12766,
    zone: "America/Mexico_City",
    geonameId: 3_996_063,
    postalRegex: "^(\\d{5})$",
  }),
  // Upstream ships eight rows that are an example code rather than a pattern,
  // and this is one of them: "NRU68" has no metacharacter in it at all. Anchoring
  // is the whole of what makes it usable, which is why it is here rather than in
  // the group above.
  country("nr", "nru", "Nauru", [], {
    currency: "AUD",
    zone: "Pacific/Nauru",
    geonameId: 2_110_425,
    postalRegex: "NRU68",
  }),
  country("br", "bra", "Brazil", ["brasil", "united states of brazil"], {
    currency: "BRL",
    zone: "America/Sao_Paulo",
    geonameId: 3_469_034,
    postalRegex: "^\\d{5}-\\d{3}$",
  }),
  // The "united …" family. Eight countries carry an alias beginning with that
  // word and they are all on the same flat country weight, so nothing but the
  // length of the alias still to be typed can order them — which is the one
  // arrangement that isolates the completer's length term. Alphabetical would
  // lead with the Emirates; length leads with the United States.
  country("eg", "egy", "Egypt", ["united arab republic"], {
    capital: "Cairo",
    currency: "EGP",
    phone: "20",
    population: 98_423_595,
    zone: "Africa/Cairo",
    geonameId: 357_994,
    postalRegex: "^\\d{5}$",
  }),
  country("id", "idn", "Indonesia", ["united states of indonesia"], {
    capital: "Jakarta",
    currency: "IDR",
    phone: "62",
    population: 267_663_435,
    zone: "Asia/Jakarta",
    geonameId: 1_643_084,
    postalRegex: "^\\d{5}$",
  }),
  country("ve", "ven", "Venezuela", ["united states of venezuela"], {
    capital: "Caracas",
    currency: "VES",
    phone: "58",
    population: 28_870_195,
    zone: "America/Caracas",
    geonameId: 3_625_428,
    postalRegex: "^\\d{4}$",
  }),
  // The country half of the exact-alias pair: "beni" finishes Beni in the DRC
  // and is still a prefix of Benin, so the heavier country would lead on weight
  // alone and the completer's bonus for a finished alias is what reorders them.
  // Chile is here for its Los Ángeles, which is the second reading of a name
  // most people know as one place. A span with a single reading cannot show that
  // the readings behind a winner are spaced.
  // Croatia for Split, the fourth ordinary English word T1 adds to the engine's
  // input — beside Nice, Mobile and Reading, and like them a real city of over
  // 100 000 people whose name the engine had no reading for at all.
  country("hr", "hrv", "Croatia", ["hrvatska"], {
    capital: "Zagreb",
    currency: "EUR",
    phone: "385",
    population: 3_871_833,
    zone: "Europe/Zagreb",
    geonameId: 3_202_326,
    postalRegex: "^\\d{5}$",
  }),
  country("cl", "chl", "Chile", [], {
    capital: "Santiago",
    currency: "CLP",
    phone: "56",
    population: 18_729_160,
    zone: "America/Santiago",
    geonameId: 3_895_114,
    postalRegex: "^\\d{7}$",
  }),
  // The third country holding a "san jose", which is what makes the readings of
  // that span three deep: two would show a winner and a runner-up, and three is
  // the shortest list on which RANK_STEP's spacing is visible as a step rather
  // than as a gap.
  country("ph", "phl", "Philippines", [], {
    capital: "Manila",
    currency: "PHP",
    phone: "63",
    population: 106_651_922,
    zone: "Asia/Manila",
    geonameId: 1_694_008,
    postalRegex: "^\\d{4}$",
  }),
  country("bj", "ben", "Benin", [], {
    capital: "Porto-Novo",
    currency: "XOF",
    phone: "229",
    population: 11_485_048,
    zone: "Africa/Porto-Novo",
    geonameId: 2_395_170,
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
    postalRegex: "^[A-Z]{3}\\s?\\d{4}$",
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
  // The second name that is two countries. "soudan" is French for both, and the
  // pair is here for the reason the Congos are: §6.1 ranks a collision by
  // population, so Sudan takes the claim and Mali is the reading behind it. Two
  // such pairs rather than one, because a single collision cannot show that the
  // rule is a rule.
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
  country("ml", "mli", "Mali", ["soudan"], {
    capital: "Bamako",
    currency: "XOF",
    phone: "223",
    population: 19_077_690,
    area: 1_240_000,
    lat: 12.65,
    lon: -8.0,
    zone: "Africa/Bamako",
    geonameId: 2_453_866,
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
  // "kiev" is the row that separates the alias matched from the name shown: a
  // user typing the old transliteration must still be offered "Kyiv".
  city(703_448, "Kyiv", "ua", {
    admin1: "30",
    aliases: ["kyiv", "kiev"],
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
  // The other Congo's capital, and the row that makes `brazzaville congo` a
  // scoped claim rather than a degraded one: "congo" is two countries, so the
  // scope walks both in population order and the larger one — the DRC — has no
  // Brazzaville to offer. Without this row the walk would have nothing to find
  // in either and the test could not tell a successful second try from a miss.
  city(2_260_535, "Brazzaville", "cg", {
    admin1: "12",
    population: 1_284_609,
    capital: true,
    zone: "Africa/Brazzaville",
    lat: -4.26613,
    lon: 15.28318,
  }),
  city(264_371, "Athens", "gr", {
    admin1: "ESYE31",
    population: 664_046,
    capital: true,
    zone: "Europe/Athens",
    lat: 37.98376,
    lon: 23.72784,
  }),
  // Athens, Georgia: the same alias on a bigger-sounding name and a smaller
  // place, so §6.1's capital row is the whole of the ranking between them. It is
  // also the scope that must resolve to the US state and never to the country
  // `ge`, which is why the division below keeps its name.
  city(4_180_386, "Athens", "us", {
    admin1: "GA",
    population: 127_315,
    zone: "America/New_York",
    lat: 33.96095,
    lon: -83.37794,
  }),
  // One name, one row. Paris, Texas is *not* here, and its absence is the data
  // this fixture is asserting: T1 is "over 100 000 people, plus every seat of
  // government", and at 25 171 and neither, it is exactly the row the tier does
  // not carry — so `paris texas` finds no US Paris to scope to and degrades,
  // leaving "texas" dangling. `matcher.test.ts` appends it to a table of its own
  // where it wants to watch a scope succeed; putting it here would delete the
  // failure ambiguity.test.ts exists to record.
  city(2_988_507, "Paris", "fr", {
    admin1: "11",
    population: 2_138_551,
    capital: true,
    zone: "Europe/Paris",
    lat: 48.85341,
    lon: 2.3488,
  }),
  // The arrondissements, which are what "paris" completes to after Paris itself:
  // every one of them is a longer alias at a lower weight, so they queue behind
  // the city in the order the length term puts them. Without them the completer
  // has nothing to rank under a name it already matched exactly.
  city(6_455_259, "Paris 15 Vaugirard", "fr", {
    admin1: "11",
    population: 232_400,
    zone: "Europe/Paris",
    lat: 48.84019,
    lon: 2.29335,
  }),
  city(6_455_236, "Paris 18 Buttes-Montmartre", "fr", {
    admin1: "11",
    population: 200_600,
    zone: "Europe/Paris",
    lat: 48.89218,
    lon: 2.34472,
  }),
  city(6_455_233, "Paris 20 Menilmontant", "fr", {
    admin1: "11",
    population: 191_800,
    zone: "Europe/Paris",
    lat: 48.86471,
    lon: 2.39835,
  }),
  // One name, three divisions of one country — the case a country scope cannot
  // separate and an admin1 scope can. Three rather than two because the ranking
  // test needs a middle: `springfield` alone is Missouri's, and the other two
  // are the readings behind it in population order.
  city(4_250_542, "Springfield", "us", {
    admin1: "IL",
    population: 114_394,
    zone: "America/Chicago",
    lat: 39.80172,
    lon: -89.64371,
  }),
  city(4_409_896, "Springfield", "us", {
    admin1: "MO",
    population: 170_188,
    zone: "America/Chicago",
    lat: 37.21533,
    lon: -93.29824,
  }),
  city(4_951_788, "Springfield", "us", {
    admin1: "MA",
    population: 153_606,
    zone: "America/New_York",
    lat: 42.10148,
    lon: -72.58981,
  }),
  // The capital-over-population pair. Costa Rica's San José is a third the size
  // of California's San Jose and still takes the bare name, because §6.1 weights
  // a seat of government at a flat +2 and a population at log10(p)/3 — which for
  // 997 000 is 1.9996, a decided ranking and a coin flip once softmaxed. The two
  // rows exist to state that the spacing survives being scored.
  city(3_621_849, "San José", "cr", {
    admin1: "SJ",
    aliases: ["san josé", "san jose"],
    population: 335_007,
    capital: true,
    zone: "America/Costa_Rica",
    lat: 9.93333,
    lon: -84.08333,
  }),
  city(5_392_171, "San Jose", "us", {
    admin1: "CA",
    population: 997_000,
    zone: "America/Los_Angeles",
    lat: 37.33939,
    lon: -121.89496,
  }),
  city(1_688_497, "San Jose", "ph", {
    admin1: "49",
    population: 129_424,
    zone: "Asia/Manila",
    lat: 15.79139,
    lon: 120.99,
  }),
  // The scoped rows the corpus reaches for, and the divisions they need.
  //
  // Both Cambridges, because the Massachusetts scope is only doing work if the
  // unscoped answer is the other one: England's is 158 000 to Massachusetts'
  // 110 000, so `cambridge` alone is English and `cambridge massachusetts` is
  // the scope overriding a default rather than restating it.
  city(2_653_941, "Cambridge", "gb", {
    admin1: "ENG",
    population: 158_434,
    zone: "Europe/London",
    lat: 52.2,
    lon: 0.11667,
  }),
  city(4_931_972, "Cambridge", "us", {
    admin1: "MA",
    population: 110_402,
    zone: "America/New_York",
    lat: 42.3751,
    lon: -71.10561,
  }),
  // Columbus is the scope whose division name is also a country's: `columbus
  // ohio` must reach the state, and Ohio is not the trap — Georgia is, next door.
  city(4_509_177, "Columbus", "us", {
    admin1: "OH",
    population: 892_533,
    zone: "America/New_York",
    lat: 39.96118,
    lon: -82.99879,
  }),
  // The far endpoints of the distance spot-checks: a city datetime never heard
  // of, a city it did, and the capital whose zone it owns outright.
  city(5_419_384, "Denver", "us", {
    admin1: "CO",
    population: 715_522,
    zone: "America/Denver",
    lat: 39.73915,
    lon: -104.9847,
  }),
  city(2_643_743, "London", "gb", {
    admin1: "ENG",
    population: 8_961_989,
    capital: true,
    zone: "Europe/London",
    lat: 51.50853,
    lon: -0.12574,
  }),
  city(1_853_909, "Osaka", "jp", {
    admin1: "32",
    population: 2_691_185,
    zone: "Asia/Tokyo",
    lat: 34.69374,
    lon: 135.50218,
  }),
  city(4_699_066, "Houston", "us", {
    admin1: "TX",
    population: 2_296_224,
    zone: "America/Chicago",
    lat: 29.76328,
    lon: -95.36327,
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
    admin1: "NS",
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
  city(3_190_261, "Split", "hr", {
    admin1: "20",
    population: 178_102,
    zone: "Europe/Zagreb",
    lat: 43.50891,
    lon: 16.43915,
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
  city(3_883_167, "Los Ángeles", "cl", {
    admin1: "06",
    aliases: ["los ángeles", "los angeles"],
    population: 123_445,
    zone: "America/Santiago",
    lat: -37.46973,
    lon: -72.35366,
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
  // The historical name that reaches the modern one: a user types "leningrad"
  // and must be offered "Saint Petersburg". It is the clearest row for the rule
  // that `text` is the place's display name and `alias` is merely what was
  // matched — on every other row the two are the same word and the distinction
  // is invisible.
  city(498_817, "Saint Petersburg", "ru", {
    admin1: "66",
    aliases: ["saint petersburg", "leningrad", "sankt-peterburg"],
    population: 5_351_935,
    zone: "Europe/Moscow",
    lat: 59.93863,
    lon: 30.31413,
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
  // The second endpoint of each city-to-city distance. A country's coordinates
  // are its capital's, so `paris to berlin` and `france to germany` have to come
  // out at the same 878 km; these are the rows that let the corpus say so, and
  // Kyoto is the pair that is a distance between two cities of one country.
  city(1_857_910, "Kyoto", "jp", {
    admin1: "22",
    population: 1_459_640,
    zone: "Asia/Tokyo",
    lat: 35.02107,
    lon: 135.75385,
  }),
  city(2_950_159, "Berlin", "de", {
    admin1: "16",
    population: 3_426_354,
    capital: true,
    zone: "Europe/Berlin",
    lat: 52.52437,
    lon: 13.41053,
  }),
  // Tonga's alpha-2 is "to", so a scope walk that did not stop at a conversion
  // keyword would read `nuku'alofa to japan` as a scoped city and swallow the
  // operator. Nothing downstream recovers it, which is why the guard is stated
  // on a real capital rather than on a synthetic row.
  city(4_032_402, "Nuku'alofa", "to", {
    population: 22_400,
    capital: true,
    zone: "Pacific/Tongatapu",
    lat: -21.13938,
    lon: -175.2018,
  }),
  // Jakarta's GeoNames aliases really do include "new york van java", and it is
  // a capital, so on weight alone it ties New York City. What separates them is
  // how much of the alias is still untyped — which core measured against the
  // fragment "yor" until the whole input reached it, and neither alias begins
  // with that. This row is the one that catches the regression.
  city(1_642_911, "Jakarta", "id", {
    admin1: "04",
    aliases: ["jakarta", "new york van java"],
    population: 8_540_121,
    capital: true,
    zone: "Asia/Jakarta",
    lat: -6.21462,
    lon: 106.84513,
  }),
  // Beni finishes the alias "beni"; Benin the country only begins with it.
  city(217_745, "Beni", "cd", {
    admin1: "19",
    population: 426_000,
    zone: "Africa/Lubumbashi",
    lat: 0.49658,
    lon: 29.47337,
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
  // A division code survives only when `RESERVED_WORDS` does not already carry
  // it, because the generator filters this table before shipping it and a
  // fixture that skipped the filter would let tests scope by codes no real build
  // can offer. Eight of the sixteen below lose their code that way — every
  // country alpha-2 is reserved, which takes "il" (Israel), "mo" (Macau), "ca"
  // (Canada), "al" (Albania), "ga" (Gabon) and "bc"; and "in" and "or" are words
  // the parser owns outright. The name always survives, so every one of these is
  // still reachable as `springfield illinois`.
  { key: "US.IL", name: "Illinois", aliases: ["illinois"] },
  { key: "US.MO", name: "Missouri", aliases: ["missouri"] },
  { key: "US.MA", name: "Massachusetts", aliases: ["massachusetts"] },
  { key: "US.TX", name: "Texas", aliases: ["texas", "tx"] },
  { key: "US.OH", name: "Ohio", aliases: ["ohio", "oh"] },
  { key: "US.WA", name: "Washington", aliases: ["washington", "wa"] },
  { key: "US.CA", name: "California", aliases: ["california"] },
  { key: "US.CO", name: "Colorado", aliases: ["colorado"] },
  { key: "US.NY", name: "New York", aliases: ["new york", "ny"] },
  { key: "US.NJ", name: "New Jersey", aliases: ["new jersey", "nj"] },
  { key: "US.AL", name: "Alabama", aliases: ["alabama"] },
  // The country/state collision: `atlanta georgia` must scope to this and never
  // to the country `ge`.
  { key: "US.GA", name: "Georgia", aliases: ["georgia"] },
  // The two whose codes the reserved list refuses as words rather than as codes.
  { key: "US.IN", name: "Indiana", aliases: ["indiana"] },
  { key: "US.OR", name: "Oregon", aliases: ["oregon"] },
  { key: "CA.BC", name: "British Columbia", aliases: ["british columbia"] },
  { key: "CA.NS", name: "Nova Scotia", aliases: ["nova scotia", "ns"] },
  { key: "AU.02", name: "New South Wales", aliases: ["new south wales", "nsw"] },
];
