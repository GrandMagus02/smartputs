/** Scratch: compute candidate corpus rows for the unit-kind packages. */

import { angle } from "@smartput/angle";
import angleEn from "@smartput/angle/locale/en";
import { area } from "@smartput/area";
import areaEn from "@smartput/area/locale/en";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { datarate } from "@smartput/datarate";
import datarateEn from "@smartput/datarate/locale/en";
import { datasize } from "@smartput/datasize";
import datasizeEn from "@smartput/datasize/locale/en";
import { duration } from "@smartput/duration";
import durationEn from "@smartput/duration/locale/en";
import { energy } from "@smartput/energy";
import energyEn from "@smartput/energy/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import { mass } from "@smartput/mass";
import massEn from "@smartput/mass/locale/en";
import { measure } from "@smartput/measure";
import measureEn from "@smartput/measure/locale/en";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import { percent } from "@smartput/percent";
import percentEn from "@smartput/percent/locale/en";
import { power } from "@smartput/power";
import powerEn from "@smartput/power/locale/en";
import { speed } from "@smartput/speed";
import speedEn from "@smartput/speed/locale/en";
import { tempdelta, temperature } from "@smartput/temperature";
import temperatureEn from "@smartput/temperature/locale/en";
import { tempo } from "@smartput/tempo";
import tempoEn from "@smartput/tempo/locale/en";
import { volume } from "@smartput/volume";
import volumeEn from "@smartput/volume/locale/en";

const BUILTIN = BUILTIN_KINDS;
const BUILTIN_VOCAB = [BUILTIN_EN].flat();

const CASES: Record<string, { kinds: unknown[]; vocab: unknown[]; inputs: string[] }> = {
  angle: {
    kinds: [number, angle],
    vocab: [numberEn, angleEn],
    inputs: [
      "90 deg",
      "90 deg in rad",
      "0.25 turn in deg",
      "200 grad in deg",
      "90 deg + 90 deg",
      "1 turn - 90 deg",
      "45 deg * 2",
      "180 deg / 4",
      "-90 deg",
      "1 rad in deg",
      "one turn",
      "360 degrees in turns",
      "1.5 rad",
      "100 gon in grad",
      "2 revolutions in deg",
    ],
  },
  area: {
    kinds: [number, length, area],
    vocab: [numberEn, lengthEn, areaEn],
    inputs: [
      "3 m * 4 m",
      "1 hectare in m2",
      "1 acre in m2",
      "2 km2 in hectare",
      "5000 cm2 in m2",
      "10 m2 + 5 m2",
      "1 hectare - 2500 m2",
      "3 m2 * 4",
      "100 m2 / 4",
      "-5 m2",
      "2 sqkm in sqm",
      "1 m2 in cm2",
      "two hectares",
      "1 km * 1 km",
      "12 m2",
    ],
  },
  datarate: {
    kinds: [number, duration, datasize, datarate],
    vocab: [numberEn, durationEn, datasizeEn, datarateEn],
    inputs: [
      "100 mbps",
      "1 gbps in mbps",
      "500 mb / 20 s",
      "100 mbps * 1 min",
      "1 min * 100 mbps",
      "1 gb / 100 mbps",
      "100 mbps + 50 mbps",
      "1 tbps in gbps",
      "2 mbps * 3",
      "1 gbps / 4",
      "-10 mbps",
      "8000 bps in kbps",
      "one gbps",
      "1 gbps in bps",
      "250 mbps",
    ],
  },
  datasize: {
    kinds: [number, datasize],
    vocab: [numberEn, datasizeEn],
    inputs: [
      "1 kib in b",
      "1 gb in mb",
      "1 gib in mib",
      "1 tb in gb",
      "500 mb + 500 mb",
      "1 gb - 200 mb",
      "2 gb * 3",
      "1 tb / 4",
      "-1 gb",
      "1024 b in kib",
      "one gigabyte",
      "1 mib in kb",
      "3 terabytes",
      "1 gb in b",
      "1500 bytes",
    ],
  },
  duration: {
    kinds: [number, duration],
    vocab: [numberEn, durationEn],
    inputs: [
      "2 wk",
      "30 h - 30 min",
      "90 min in h",
      "1 d in h",
      "1 wk in d",
      "500 ms + 500 ms",
      "2 h * 3",
      "1 d / 4",
      "-2 h",
      "1 h in s",
      "one hour",
      "3600 s in h",
      "45 minutes",
      "1.5 h in min",
      "2 days + 12 hours",
    ],
  },
  energy: {
    kinds: [number, duration, power, energy],
    vocab: [numberEn, durationEn, powerEn, energyEn],
    inputs: [
      "1 kwh in j",
      "2 kw * 3 h",
      "3 h * 2 kw",
      "1 kwh / 1 h",
      "1 kwh / 1 kw",
      "1 kcal in j",
      "1 btu in j",
      "1 mj in kj",
      "500 j + 500 j",
      "2 kj * 3",
      "1 mwh in kwh",
      "-1 kwh",
      "one kilojoule",
      "1000 cal in kcal",
      "2.5 kwh",
    ],
  },
  length: {
    kinds: [number, length],
    vocab: [numberEn, lengthEn],
    inputs: [
      "10 km",
      "12 inch",
      "2 km in m",
      "1 mi in km",
      "10 m + 5 km",
      "1 km - 250 m",
      "10 km * 3",
      "1 km / 4",
      "-5 km",
      "3 ft in cm",
      "one kilometre",
      "1 yd in cm",
      "1,500 mm in m",
      "5280 ft in mi",
      "two hundred and five km",
    ],
  },
  mass: {
    kinds: [number, mass],
    vocab: [numberEn, massEn],
    inputs: [
      "1 kg + 500 g",
      "3 lbs",
      "1,500 g",
      "1 t in kg",
      "16 oz in lb",
      "1 kg in g",
      "2 kg - 500 g",
      "3 kg * 4",
      "1 t / 8",
      "-2 kg",
      "500 mg in g",
      "one kilogram",
      "2.5 tonnes in kg",
      "1 lb in oz",
      "1.5 kilograms",
    ],
  },
  measure: {
    kinds: [number, measure],
    vocab: [numberEn, measureEn],
    inputs: [
      "1 inch in pt",
      "72 pt in inch",
      "6 pc in inch",
      "1 inch in mm",
      "25.4 mm in inch",
      "1 inch in px",
      "96 px in inch",
      "2 inch + 36 pt",
      "1 inch - 12 pt",
      "3 inch * 2",
      "1 inch / 4",
      "-2 inch",
      "1 pc in pt",
      "10 mm in cm",
      "one inch",
    ],
  },
  number: {
    kinds: [number],
    vocab: [numberEn],
    inputs: [
      "(1 + 2) * 3",
      "1 + 1",
      "10 - 4",
      "6 * 7",
      "10 / 4",
      "-5",
      "1,500",
      "one thousand thirty two",
      "two hundred and five",
      "0.1 + 0.2",
      "2 * 3 * 7",
      "1234567890123456789",
      "3 * (4 + 5)",
      "100 / 3",
      "nine",
    ],
  },
  percent: {
    kinds: [number, percent],
    vocab: [numberEn, percentEn],
    inputs: [
      "20% of 50",
      "50 + 20%",
      "50 - 10%",
      "10%",
      "10% + 5%",
      "100 * 20%",
      "1 in percent",
      "0.5 in percent",
      "200%",
      "-10%",
      "15% of 200",
      "50 * 10%",
      "100 - 25%",
      "2.5%",
      "100% of 42",
    ],
  },
  power: {
    kinds: [number, power],
    vocab: [numberEn, powerEn],
    inputs: [
      "1 kw in w",
      "1 mw in kw",
      "1 hp in w",
      "500 w + 500 w",
      "2 kw - 500 w",
      "3 kw * 2",
      "1 mw / 4",
      "-1 kw",
      "1000 w in kw",
      "one kilowatt",
      "2.5 kw",
      "746 w in hp",
      "1 gw in mw",
      "100 w",
      "1.5 mw in w",
    ],
  },
  speed: {
    kinds: [number, length, duration, speed],
    vocab: [numberEn, lengthEn, durationEn, speedEn],
    inputs: [
      "100 km / 2 h",
      "100 kph in mph",
      "60 mph in kph",
      "1 knot in kph",
      "10 mps in kph",
      "50 kph + 50 kph",
      "100 kph - 20 kph",
      "30 kph * 2",
      "100 kph / 4",
      "-10 kph",
      "1 km / 1 min",
      "one kph",
      "3.6 kph in mps",
      "120 kph",
      "5 mps",
    ],
  },
  temperature: {
    kinds: [number, temperature, tempdelta],
    vocab: [numberEn, ...temperatureEn],
    inputs: [
      "212 F in C",
      "0 C in F",
      "100 C in K",
      "0 K in C",
      "30 C - 20 C",
      "20 C",
      "98.6 F in C",
      "-40 C in F",
      "37 C in F",
      "273.15 K in C",
      "10 C + 5 C",
      "1 C",
      "72 F",
      "300 K",
      "-10 C in K",
    ],
  },
  tempo: {
    kinds: [number, duration, tempo],
    vocab: [numberEn, durationEn, tempoEn],
    inputs: [
      "120 bpm",
      "120 bpm in ms",
      "120 bpm in s",
      "500 ms in bpm",
      "1 s in bpm",
      "60 bpm in s",
      "2 hz in bpm",
      "120 bpm in hz",
      "120 bpm + 8 bpm",
      "140 bpm - 20 bpm",
      "60 bpm * 2",
      "120 bpm / 2",
      "-10 bpm",
      "one bpm",
      "174 bpm",
    ],
  },
  volume: {
    kinds: [number, volume],
    vocab: [numberEn, volumeEn],
    inputs: [
      "1 l in ml",
      "1 m3 in l",
      "1 gal in l",
      "1 pint in ml",
      "500 ml + 500 ml",
      "2 l - 250 ml",
      "3 l * 4",
      "1 l / 4",
      "-2 l",
      "1000 ml in l",
      "one litre",
      "1 gal in pint",
      "2 pints in l",
      "1.5 l",
      "250 ml in l",
    ],
  },
  boolean: {
    kinds: BUILTIN,
    vocab: BUILTIN_VOCAB,
    inputs: [
      "1000 mb = 1 gb",
      "1 km > 999 m",
      "1 km < 999 m",
      "1 m = 100 cm",
      "1 kg = 1 kg",
      "2 > 1",
      "1 >= 1",
      "1 <= 0",
      "5 != 4",
      "1 gb = 1000 mb",
      "1 mi > 1 km",
      "3 < 4",
      "10 = 10",
      "1 kib > 1 kb",
      "0 < 1",
      "20 C > 10 C",
      "1 hectare = 10000 m2",
      "100 kph < 60 mph",
      "1 kwh = 3.6 mj",
      "1 h != 60 min",
    ],
  },
};

const only = process.argv[2];
for (const [name, spec] of Object.entries(CASES)) {
  if (only && only !== name) continue;
  console.log(`######## ${name} ########`);
  let engine: ReturnType<typeof createEngine>;
  try {
    engine = createEngine({
      locales: [composeLocale(en, spec.vocab as never)],
      kinds: spec.kinds as never,
    });
  } catch (e) {
    console.log(`ENGINE ERROR: ${(e as Error).message}`);
    continue;
  }
  for (const input of spec.inputs) {
    try {
      const r = engine.evaluate(input);
      console.log(`${input}\t${r.kind}\t${r.value.canonical.toString()}\t${r.formatted}`);
    } catch (e) {
      console.log(
        `${input}\tERROR\t${(e as Error).constructor.name}\t${(e as Error).message}`,
      );
    }
  }
}
