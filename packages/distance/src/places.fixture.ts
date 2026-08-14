import type { PositionedPlace } from "./distance";

/**
 * A fixture row: what the op needs, plus the country facts its tests copy into a
 * Value's meta. `PositionedPlace` is deliberately narrower — the op reads a
 * position per unit and nothing else — so this widens it here rather than there.
 */
export interface FixturePlace extends PositionedPlace {
  readonly name: string;
  readonly geonameId: number;
  readonly zone: string;
  readonly currency: string;
  readonly population: number;
}

/**
 * The positioned rows this package's own tests measure between.
 *
 * `PlaceDistance` takes its table through the constructor and imports none,
 * which is what stops a cycle with the package that registers the op on its
 * kind. That has always been true; what changed is that there is no longer a
 * committed country table anywhere to borrow for a test, so the rows a test
 * needs are written here.
 *
 * Thirteen, chosen for the cases the op has to get right rather than for
 * coverage: a pair a few hundred kilometres apart, a pair near the antipode
 * (`is` to `nz`, which is what the clamped `asin` in `metresBetween` exists
 * for), a country measured against itself, and a southern-hemisphere pair so a
 * sign error cannot pass.
 *
 * Positions are the capitals', to five decimal places, which is the precision
 * GeoNames publishes and the reason `between` rounds its answer to the metre:
 * anything finer would be invented, and a host's last-bit `Math.sin` must not
 * decide a corpus row.
 *
 * A fixture, not data the package ships — `.fixture.ts`, unreachable from the
 * entry point, the same convention `@smartput/geo`'s `places.fixture.ts` uses.
 */
export const PLACES: readonly FixturePlace[] = [
  {
    a2: "aq",
    name: "Antarctica",
    geonameId: 6697173,
    zone: "Antarctica/Casey",
    currency: "",
    population: 0,
    lat: -66.28248,
    lon: 110.52496,
  },
  {
    a2: "de",
    name: "Germany",
    geonameId: 2921044,
    zone: "Europe/Berlin",
    currency: "EUR",
    population: 82927922,
    lat: 52.52437,
    lon: 13.41053,
  },
  {
    a2: "es",
    name: "Spain",
    geonameId: 2510769,
    zone: "Europe/Madrid",
    currency: "EUR",
    population: 46723749,
    lat: 40.4165,
    lon: -3.70256,
  },
  {
    a2: "fj",
    name: "Fiji",
    geonameId: 2205218,
    zone: "Pacific/Fiji",
    currency: "FJD",
    population: 883483,
    lat: -18.14161,
    lon: 178.44149,
  },
  {
    a2: "fr",
    name: "France",
    geonameId: 3017382,
    zone: "Europe/Paris",
    currency: "EUR",
    population: 66987244,
    lat: 48.85341,
    lon: 2.3488,
  },
  {
    a2: "gb",
    name: "United Kingdom",
    geonameId: 2635167,
    zone: "Europe/London",
    currency: "GBP",
    population: 66488991,
    lat: 51.50853,
    lon: -0.12574,
  },
  {
    a2: "in",
    name: "India",
    geonameId: 1269750,
    zone: "Asia/Kolkata",
    currency: "INR",
    population: 1352617328,
    lat: 28.63576,
    lon: 77.22445,
  },
  {
    a2: "is",
    name: "Iceland",
    geonameId: 2629691,
    zone: "Atlantic/Reykjavik",
    currency: "ISK",
    population: 353574,
    lat: 64.13548,
    lon: -21.89541,
  },
  {
    a2: "jp",
    name: "Japan",
    geonameId: 1861060,
    zone: "Asia/Tokyo",
    currency: "JPY",
    population: 127185332,
    lat: 35.6895,
    lon: 139.69171,
  },
  {
    a2: "km",
    name: "Comoros",
    geonameId: 921929,
    zone: "Indian/Comoro",
    currency: "KMF",
    population: 832322,
    lat: -11.70216,
    lon: 43.25506,
  },
  {
    a2: "ml",
    name: "Mali",
    geonameId: 2453866,
    zone: "Africa/Bamako",
    currency: "XOF",
    population: 19077690,
    lat: 12.65,
    lon: -8.0,
  },
  {
    a2: "nz",
    name: "New Zealand",
    geonameId: 2186224,
    zone: "Pacific/Auckland",
    currency: "NZD",
    population: 4885500,
    lat: -41.28664,
    lon: 174.77557,
  },
  {
    a2: "ua",
    name: "Ukraine",
    geonameId: 690791,
    zone: "Europe/Kyiv",
    currency: "UAH",
    population: 44622516,
    lat: 50.45466,
    lon: 30.5238,
  },
  {
    a2: "ar",
    name: "Argentina",
    geonameId: 3865483,
    zone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
    population: 44494502,
    lat: -34.61315,
    lon: -58.37723,
  },
  {
    a2: "au",
    name: "Australia",
    geonameId: 2077456,
    zone: "Australia/Sydney",
    currency: "AUD",
    population: 24992369,
    lat: -35.28346,
    lon: 149.12807,
  },
  {
    a2: "br",
    name: "Brazil",
    geonameId: 3469034,
    zone: "America/Sao_Paulo",
    currency: "BRL",
    population: 209469333,
    lat: -15.77972,
    lon: -47.92972,
  },
  {
    a2: "ca",
    name: "Canada",
    geonameId: 6251999,
    zone: "America/Toronto",
    currency: "CAD",
    population: 37058856,
    lat: 45.41117,
    lon: -75.69812,
  },
  {
    a2: "cl",
    name: "Chile",
    geonameId: 3895114,
    zone: "America/Santiago",
    currency: "CLP",
    population: 18729160,
    lat: -33.45694,
    lon: -70.64827,
  },
  {
    a2: "cn",
    name: "China",
    geonameId: 1814991,
    zone: "Asia/Shanghai",
    currency: "CNY",
    population: 1392730000,
    lat: 39.9075,
    lon: 116.39723,
  },
  {
    a2: "eg",
    name: "Egypt",
    geonameId: 357994,
    zone: "Africa/Cairo",
    currency: "EGP",
    population: 98423595,
    lat: 30.06263,
    lon: 31.24967,
  },
  {
    a2: "fi",
    name: "Finland",
    geonameId: 660013,
    zone: "Europe/Helsinki",
    currency: "EUR",
    population: 5518050,
    lat: 60.16952,
    lon: 24.93545,
  },
  {
    a2: "ie",
    name: "Ireland",
    geonameId: 2963597,
    zone: "Europe/Dublin",
    currency: "EUR",
    population: 4853506,
    lat: 53.33306,
    lon: -6.24889,
  },
  {
    a2: "ke",
    name: "Kenya",
    geonameId: 192950,
    zone: "Africa/Nairobi",
    currency: "KES",
    population: 51393010,
    lat: -1.28333,
    lon: 36.81667,
  },
  {
    a2: "mx",
    name: "Mexico",
    geonameId: 3996063,
    zone: "America/Mexico_City",
    currency: "MXN",
    population: 126190788,
    lat: 19.42847,
    lon: -99.12766,
  },
  {
    a2: "no",
    name: "Norway",
    geonameId: 3144096,
    zone: "Europe/Oslo",
    currency: "NOK",
    population: 5314336,
    lat: 59.91273,
    lon: 10.74609,
  },
  {
    a2: "pl",
    name: "Poland",
    geonameId: 798544,
    zone: "Europe/Warsaw",
    currency: "PLN",
    population: 37978548,
    lat: 52.22977,
    lon: 21.01178,
  },
  {
    a2: "se",
    name: "Sweden",
    geonameId: 2661886,
    zone: "Europe/Stockholm",
    currency: "SEK",
    population: 10183175,
    lat: 59.33258,
    lon: 18.0649,
  },
  {
    a2: "th",
    name: "Thailand",
    geonameId: 1605651,
    zone: "Asia/Bangkok",
    currency: "THB",
    population: 69428524,
    lat: 13.75398,
    lon: 100.50144,
  },
  {
    a2: "us",
    name: "United States",
    geonameId: 6252001,
    zone: "America/New_York",
    currency: "USD",
    population: 327167434,
    lat: 38.89511,
    lon: -77.03637,
  },
  {
    a2: "za",
    name: "South Africa",
    geonameId: 953987,
    zone: "Africa/Johannesburg",
    currency: "ZAR",
    population: 57779622,
    lat: -25.74486,
    lon: 28.18783,
  },
];
