#!/usr/bin/env python3
"""Emit corpus/en.tsv + src/corpus.test.ts for the unit-kind packages."""
import os, re, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PKGS = os.path.join(ROOT, "packages")

# name -> (imports, kinds expr, vocab expr, wiring note, tsv note)
SPEC = {
    "angle": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { angle } from "./index";',
                 'import angleEn from "./locale/en";'],
        kinds="[number, angle]", vocab="[numberEn, angleEn]",
        note="`number` because the generated scaling ops name it: without it "
             "`45 deg * 2` has no signature to match.",
    ),
    "area": dict(
        imports=['import { length } from "@smartput/length";',
                 'import lengthEn from "@smartput/length/locale/en";',
                 'import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { area } from "./index";',
                 'import areaEn from "./locale/en";'],
        kinds="[number, length, area]", vocab="[numberEn, lengthEn, areaEn]",
        note="`length` because this kind's whole reason to exist is the "
             "`length * length` bridge it declares, and a signature whose "
             "operands are unregistered is unreachable rather than an error.",
    ),
    "datarate": dict(
        imports=['import { datasize } from "@smartput/datasize";',
                 'import datasizeEn from "@smartput/datasize/locale/en";',
                 'import { duration } from "@smartput/duration";',
                 'import durationEn from "@smartput/duration/locale/en";',
                 'import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { datarate } from "./index";',
                 'import datarateEn from "./locale/en";'],
        kinds="[number, duration, datasize, datarate]",
        vocab="[numberEn, durationEn, datasizeEn, datarateEn]",
        note="`datasize` and `duration` are registered but not depended on: "
             "the four bridge signatures name them by id string, which is "
             "exactly the claim these rows check.",
    ),
    "datasize": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { datasize } from "./index";',
                 'import datasizeEn from "./locale/en";'],
        kinds="[number, datasize]", vocab="[numberEn, datasizeEn]",
        note="`number` for the scaling ops. The decimal/binary split is the "
             "point of half these rows: 1 gb is not 1 gib.",
    ),
    "duration": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { duration } from "./index";',
                 'import durationEn from "./locale/en";'],
        kinds="[number, duration]", vocab="[numberEn, durationEn]",
        note="`number` for the scaling ops.",
    ),
    "energy": dict(
        imports=['import { duration } from "@smartput/duration";',
                 'import durationEn from "@smartput/duration/locale/en";',
                 'import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { power } from "@smartput/power";',
                 'import powerEn from "@smartput/power/locale/en";',
                 'import { energy } from "./index";',
                 'import energyEn from "./locale/en";'],
        kinds="[number, duration, power, energy]",
        vocab="[numberEn, durationEn, powerEn, energyEn]",
        note="`power` and `duration` are registered but not depended on: this "
             "kind owns all four signatures of the power x duration bridge and "
             "names both operands by id string.",
    ),
    "length": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { length } from "./index";',
                 'import lengthEn from "./locale/en";'],
        kinds="[number, length]", vocab="[numberEn, lengthEn]",
        note="`number` for the scaling ops, and for the spelled cardinals the "
             "last row reads.",
    ),
    "mass": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { mass } from "./index";',
                 'import massEn from "./locale/en";'],
        kinds="[number, mass]", vocab="[numberEn, massEn]",
        note="`number` for the scaling ops.",
    ),
    "measure": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { measure } from "./index";',
                 'import measureEn from "./locale/en";'],
        kinds="[number, measure]", vocab="[numberEn, measureEn]",
        note="This kind is deliberately absent from `BUILTIN_KINDS` — its "
             "mm/cm aliases collide with `length` — so an engine built by hand "
             "is the only way to reach it, and the only way to test it.",
    ),
    "number": dict(
        imports=['import { number } from "./index";',
                 'import numberEn from "./locale/en";'],
        kinds="[number]", vocab="[numberEn]",
        note="One kind and nothing else. Everything below is arithmetic over a "
             "ratio of one, which is what this package is.",
    ),
    "percent": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { percent } from "./index";',
                 'import percentEn from "./locale/en";'],
        kinds="[number, percent]", vocab="[numberEn, percentEn]",
        note="`number` for the `of` and the plus/minus forms, whose result is a "
             "number rather than a percentage.",
    ),
    "power": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { power } from "./index";',
                 'import powerEn from "./locale/en";'],
        kinds="[number, power]", vocab="[numberEn, powerEn]",
        note="`number` for the scaling ops.",
    ),
    "speed": dict(
        imports=['import { duration } from "@smartput/duration";',
                 'import durationEn from "@smartput/duration/locale/en";',
                 'import { length } from "@smartput/length";',
                 'import lengthEn from "@smartput/length/locale/en";',
                 'import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { speed } from "./index";',
                 'import speedEn from "./locale/en";'],
        kinds="[number, length, duration, speed]",
        vocab="[numberEn, lengthEn, durationEn, speedEn]",
        note="`length` and `duration` are registered but not depended on: the "
             "`length / duration` signature names both by id string.",
    ),
    "temperature": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { tempdelta, temperature } from "./index";',
                 'import temperatureEn from "./locale/en";'],
        kinds="[number, temperature, tempdelta]",
        vocab="[numberEn, ...temperatureEn]",
        note="Two kinds, because a temperature and a difference between two of "
             "them are not the same thing: `30 C - 20 C` is 10 degrees of "
             "delta, not the temperature 10°C. The vocabulary is spread, not "
             "nested — this package exports one per kind.",
    ),
    "tempo": dict(
        imports=['import { duration } from "@smartput/duration";',
                 'import durationEn from "@smartput/duration/locale/en";',
                 'import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { tempo } from "./index";',
                 'import tempoEn from "./locale/en";'],
        kinds="[number, duration, tempo]",
        vocab="[numberEn, durationEn, tempoEn]",
        note="`duration` for the reciprocal bridge, which is an `in` signature "
             "rather than a ratio row: 120 bpm is a half-second beat, and no "
             "unit table can say that.",
    ),
    "volume": dict(
        imports=['import { number } from "@smartput/number";',
                 'import numberEn from "@smartput/number/locale/en";',
                 'import { volume } from "./index";',
                 'import volumeEn from "./locale/en";'],
        kinds="[number, volume]", vocab="[numberEn, volumeEn]",
        note="`number` for the scaling ops.",
    ),
    "boolean": dict(
        imports=['import { BUILTIN_KINDS } from "@smartput/kinds";',
                 'import BUILTIN_EN from "@smartput/kinds/locale/en";'],
        kinds="BUILTIN_KINDS", vocab="BUILTIN_EN",
        note="The whole built-in set, and not a hand-picked pair: this kind "
             "generates no operation of its own, so every row below is a "
             "comparison signature core generated for some *other* kind. A "
             "corpus over two kinds would only prove those two.",
    ),
}

TSV_HEADER = {
    "boolean": "# What a comparison returns. Registering this kind is what turns\n"
               "# `1000 mb = 1 gb` from an unresolvable expression into `true`.\n",
}

def doc(name, spec):
    return f"""/**
 * The corpus for `@smartput/{name}`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * {spec['note']}
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 */"""

def emit(name):
    spec = SPEC[name]
    pkg = os.path.join(PKGS, name)
    imports = "\n".join(spec["imports"])
    body = f'''import {{ expect, test }} from "bun:test";
import {{ composeLocale, createEngine }} from "@smartput/core";
import {{ english as en }} from "@smartput/core/locale/en";
{imports}

{doc(name, spec)}
const engine = createEngine({{
  locales: [composeLocale(en, {spec["vocab"]})],
  kinds: {spec["kinds"]},
}});
const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\\t"));

test("the corpus has rows", () => {{
  expect(rows.length).toBeGreaterThan(10);
}});

for (const [input, kind, canonical, formatted] of rows) {{
  test(`corpus: ${{input}}`, () => {{
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  }});
}}
'''
    with open(os.path.join(pkg, "src", "corpus.test.ts"), "w") as f:
        f.write(body)

# Parse generator output into per-package rows.
out = open(os.path.join(os.path.dirname(__file__), "out.txt")).read()
blocks = re.split(r"^######## (\S+) ########$", out, flags=re.M)[1:]
rows_by_pkg = {}
for i in range(0, len(blocks), 2):
    rows_by_pkg[blocks[i]] = [l for l in blocks[i + 1].split("\n") if l.strip()]

for name in SPEC:
    pkg = os.path.join(PKGS, name)
    os.makedirs(os.path.join(pkg, "corpus"), exist_ok=True)
    rows = rows_by_pkg[name]
    assert all("\tERROR\t" not in r for r in rows), name
    header = TSV_HEADER.get(name, "")
    with open(os.path.join(pkg, "corpus", "en.tsv"), "w") as f:
        f.write(header + "# input\tkind\tcanonical\tformatted\n")
        f.write("\n".join(rows) + "\n")
    emit(name)
    print(f"{name}: {len(rows)} rows")
