---
title: A launcher that answers
description: The Spotlight/Raycast row — a search box that computes when what is in it computes, with completion ranked on the same weights.
---

# A launcher that answers

Spotlight, Raycast, Alfred, the ⌘K palette in half the apps shipped since 2021:
all of them are a search box that quietly became a calculator. Type `2 tb in
gb` and an answer row appears above the file results.

<SpCommandPalette />

Two calls per keystroke and no network in either.

```ts
const rows   = engine.complete(input, { limit: 4 });   // what the word could become
const answer = engine.evaluate(input);                 // what the line comes to
```

Both are synchronous and allocation-light, which is why this recomputes on
every keystroke with no debounce. A launcher that debounces its own arithmetic
feels broken in a way that is hard to name and easy to notice.

## The answer row appears only when it is safe

`evaluate()` is strict: it throws on a reading that is not confidently the best
one. For a launcher that is not an error path, it is the normal state of a box
that is still being typed into:

```ts
const outcome = evaluateSafely(engine, input);          // never throws
const answer = outcome.status === "ok" ? outcome.result.formatted : null;
```

Showing the row only for a confident reading is what keeps a palette from
announcing that `10 m` is ten metres while the person is typing "10 minutes".
The completion rows underneath carry the alternatives, ranked, and accepting
one rewrites the whole input — so the row you accept always evaluates.

## Completion rewrites the input, not the word

```ts
engine.complete("30 ho");
// [{ text: "30 hours", alias: "hours", kind: "duration", unit: "h", span: {…}, score: … }]
```

`text` is the whole line with the fragment replaced, which is the property that
makes accepting a row safe to feed straight back into `evaluate`. A completer
that returned only the word leaves the caller to splice it, and splicing is
where the off-by-one lives.

The ranking is the solver's weights plus a magnitude fit — `30 ho` prefers
hours over hectares partly because thirty of them is a plausible number of
hours. See [Completion](/guide/completion) for the terms in that sum.

## The keyboard is the whole product

```ts
function onKeydown(event: KeyboardEvent) {
  if (completions.onKeydown(event)) { event.preventDefault(); return; }
  if (event.key === "Enter") void copy();
}
```

↓ ↑ move, Enter accepts a highlighted row, Escape dismisses the list, and Enter
with no row highlighted takes the answer. That order matters: the list gets
first refusal on every key, and the palette's own action only sees what the list
did not consume. `docs/.vitepress/theme/useCompletions.ts` is the whole
implementation, about eighty lines.

Copying on Enter is the one thing to get right in the action. A launcher answer
that cannot be taken anywhere is a calculator you have to retype from.

## Which engine

The demo registers the built-ins plus [`money`](/packages/rate), so both
`1 kg + 500 g` and `30 usd in gbp` land. A palette in a real product usually
wants dates too:

```ts
createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn, datetimeEn])],
  kinds: [...BUILTIN_KINDS, money, datetime],
  rates, now: () => Date.now(), timeZone,
});
```

Every kind you add is another sentence the box answers and another candidate
competing for an ambiguous fragment. That trade is tunable rather than fixed —
[weights](/guide/weights) let a palette that is mostly about files quietly
prefer one reading over another without removing the other.

## Cost

The engine is `decimal.js` and a registry, loaded once. If the palette is on a
page where that matters, load it on the first keystroke rather than at boot —
it is a dynamic import and there is nothing stateful to warm up:

```ts
const engine = await import("./palette-engine").then((m) => m.engine);
```

## Checklist

- `complete()` and `evaluate()` both called per keystroke, neither debounced
- the answer row shown only for an unambiguous reading
- accepted completions replace the whole input
- the completion list consumes keys before the palette's own action
- Enter on the answer copies it somewhere useful
- the engine is loaded lazily if the palette is not the main surface

## See also

- [Completion](/guide/completion) — the ranking, and `scaleFit`
- [Ambiguity and weights](/guide/weights) — the four layers, and how to lean them
- [Playground](/playground) — `complete`, `suggest` and `explain` side by side
