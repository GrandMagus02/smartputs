/**
 * Which script or scripts this language's words are written in. Unicode script
 * *names* — `"Han"`, `"Katakana"`, `"Thai"` — not ISO 15924 codes: `"Jpan"` is
 * a valid code and not a Unicode property value, and it throws here.
 *
 * A language whose words span several scripts lists them all. Japanese is the
 * three-element case (`Han`, `Hiragana`, `Katakana`); Thai and Khmer are
 * one-element cases.
 */
export interface ScriptSegmenterOptions {
  readonly script: string | readonly string[];
}

/**
 * A `Language.segment` for scripts that do not put spaces between words.
 *
 * **What this does that core's default does not**, stated plainly because the
 * honest answer is "not much and it should not pretend otherwise": `lex`
 * already segments every letter run with `Intl.Segmenter` at word granularity
 * (`defaultSegment`), so CJK and Thai are broken into words with no hook
 * installed at all. This helper delegates to exactly that API and differs in
 * three measured ways.
 *
 * 1. **It is scoped.** ICU breaks whatever it is handed, and `lex` hands the
 *    format language's hook every letter run in the input — including the
 *    Latin ones. A language that declares Thai gets Thai word breaking and
 *    nothing else: a run with no character of a declared script is returned
 *    whole, untouched. This is the only thing `script` does, and it is a real
 *    thing rather than a locale tag: ICU picks its dictionary from the *text*,
 *    not from the tag, and over every CJK and Thai run tried here `en`, `ja`,
 *    `zh`, `th`, `ko`, `de` and `und` produced identical splits. So the
 *    segmenter is pinned to `"und"` and the tag is not offered as a knob.
 * 2. **It loses no letter.** `defaultSegment` filters on `isWordLike`, and a
 *    filter drops. Of the 132,243 characters `\p{L}` accepts below U+30000,
 *    351 are not `isWordLike` when segmented alone — U+3005 々, the ideographic
 *    iteration mark, among them — and `lex` admits every one of them into a
 *    letter run. Dropping one is worse than a missing word: `lex` appends the
 *    run's trailing digits to the *last* segment returned and walks the input
 *    with `indexOf` from the end of the previous one, so a vanished segment
 *    moves digits onto the wrong word and mis-spans the tokens after it. The
 *    filter here is "contains a letter", which under `lex`'s letter-only runs
 *    keeps everything, and under a direct call still refuses to promote bare
 *    punctuation to a word.
 * 3. **It builds one `Intl.Segmenter`, not one per call.** `defaultSegment`
 *    constructs one on every letter run of every keystroke; constructing costs
 *    about 9µs more than segmenting on this machine (11.0µs against 1.7µs for
 *    a reused instance, over 20,000 six-character runs). `Intl.Segmenter` has
 *    no mutable state, so the instance is a resolved table and not state held
 *    between calls — the returned function is pure in the sense the other
 *    helpers are.
 *
 * What it deliberately does **not** do: split words `Intl.Segmenter` cannot
 * find. `lex`'s own comment is the guide to what this seam is for — a hook
 * returns *substrings of its input*, in order, which is what lets `lex` locate
 * each word and re-attach a run's trailing digits. A language whose words ICU
 * does not know (German compounds, an agglutinative stem plus affixes) is not
 * served by wrapping ICU more thickly; it is served by `compoundSplitter` and
 * the strippers, which run one seam later, on the analyzer chain. And ICU's
 * dictionaries are approximations: `กิโลกรัมเป็นกรัม` breaks as
 * `กิโลกรัม | เป็นก | รัม`, one character off. This helper reports what ICU
 * says and does not second-guess it.
 *
 * `Script_Extensions`, not `Script`, is what the guard tests, and the
 * difference is load-bearing: U+30FC ー — the prolonged sound mark in every
 * long katakana loanword, メートル's own last-but-one character — is
 * `Script=Common`, so a `Script` guard would fail to recognise the very runs a
 * Japanese language installs this for.
 */
export function scriptSegmenter(opts: ScriptSegmenterOptions): (run: string) => string[] {
  const names = typeof opts.script === "string" ? [opts.script] : [...opts.script];
  if (names.length === 0) {
    throw new RangeError("scriptSegmenter: script must name at least one Unicode script");
  }
  const declared = new RegExp(names.map(scriptClass).join("|"), "u");
  const segmenter = new Intl.Segmenter("und", { granularity: "word" });
  const letter = /\p{L}/u;

  return (run) => {
    if (!declared.test(run)) return [run];
    const words: string[] = [];
    for (const { segment } of segmenter.segment(run)) {
      if (letter.test(segment)) words.push(segment);
    }
    // A run can be all of the declared script and contain no letter at all —
    // Thai digits carry `Script_Extensions=Thai`. Handing `lex` an empty array
    // would delete the run and its digits with it, so the run stands for
    // itself, which is what an unsegmentable run means everywhere else here.
    return words.length === 0 ? [run] : words;
  };
}

/**
 * One script name as a character class, validated by construction. The
 * `RegExp` constructor is the only authority on which names the engine's
 * Unicode tables know, so it is asked rather than second-guessed with a list
 * that would go stale — and it is asked once per name so the message can say
 * which one was wrong. A language declaring nonsense fails when it is built,
 * on boot, rather than on the first input written in its script.
 */
function scriptClass(name: string): string {
  const source = `\\p{Script_Extensions=${name}}`;
  try {
    new RegExp(source, "u");
  } catch {
    throw new RangeError(
      `scriptSegmenter: "${name}" is not a Unicode script name. Use a property value such as "Han", "Katakana" or "Thai", not an ISO 15924 code such as "Jpan".`,
    );
  }
  return source;
}
