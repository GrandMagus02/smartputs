---
title: Inputs, autocomplete and error messages
description: Wiring the micro path into a real form with Reka UI — an unstyled combobox, live validation, and messages a person can act on.
---

# Inputs, autocomplete and error messages

[The micro path](/packages/shared) answers one question — is this string a
valid length? — in about 1.5 KB. This page is the other half: what the answer
looks like on screen, who hears it, and what completes the word while it is
being typed.

The components are built on [Reka UI](https://reka-ui.com), an unstyled Vue
primitive library. Unstyled matters here for a reason that is not aesthetic: a
combobox is a keyboard contract (`aria-expanded`, `aria-activedescendant`,
roving highlight, dismiss on Escape, focus restoration) and a styled library
gives you that contract welded to somebody else's design tokens. Reka UI gives
you the contract and no opinion about the border radius.

```sh
npm add reka-ui        # or: bun add reka-ui / pnpm add reka-ui
```

Everything below runs on this page. The source is in
`docs/.vitepress/theme/` — `validation.ts`, `useField.ts`,
`components/SpField.vue` and `components/SpUnitCombobox.vue`.

## The library returns a code, not a message

`parseLength("30 smth")` gives you this:

```ts
{ ok: false, code: "unknown-unit", input: "30 smth" }
```

It never gives you `"That's not a unit of length."` A message is a product
decision — tone, language, how much of the unit list to spell out — and the
1.3 KB budget in [`check-size.ts`](/packages/shared#three-doors-not-one) has
no room to carry a copywriting opinion in eleven languages. So the app owns the
map from the six [`ErrCode`](/api/validate#errcode) values to sentences, and
owns it in one place:

```ts
// docs/.vitepress/theme/validation.ts
export function messagesFor(field: FieldKind): Record<ErrCode, string> {
  const units = unitKeys(field.table);        // canonical first
  const shown = units.slice(0, 4).join(", ");
  return {
    empty: `Enter a ${field.label.toLowerCase()}, for example ${field.example}.`,
    nan: `That is not a number — try ${field.example}.`,
    "missing-unit": `Add a unit: ${shown}…`,
    "unknown-unit": `That unit is not a ${field.label.toLowerCase()}. Try ${shown}…`,
    "wrong-unit": `This field only accepts one unit.`,
    trailing: `Remove the text after the unit.`,
  };
}
```

The unit list in those sentences is read off `LENGTH_UNITS` rather than typed
out, so a unit added to the table appears in the error the same day. A
hard-coded `"try cm, m or km"` is how an error message starts lying.

| Code | Reached by | What the field should say |
| --- | --- | --- |
| `empty` | `""` | Nothing, until the field is required and submitted |
| `nan` | `"abc"`, `"cm12"` | That is not a number |
| `missing-unit` | `"30"` | Add a unit — and list a few |
| `unknown-unit` | `"30 smth"` | Not a unit of this kind — and list a few |
| `wrong-unit` | `"30 m"` with `{ unit: "cm" }` | Name the one unit accepted |
| `trailing` | `"30 cm ish"` | One number, one unit |

Note what is *not* in that table: `"cm"` on its own is **valid** and parses as
one centimetre. Loose mode reads a unit with no count in front of it as one of
that unit, so a message saying "start with a number" would be a message the
parser disagrees with.

`empty` is the odd one: it is not an error while the person has not started
typing. `useField` below folds that into `valid` via a `required` flag rather
than making every template special-case one code.

## One input

<SpValidatedInput kind="length" hint="Switch kinds with the chips. The parse
line is the raw return value — no engine, no Decimal, one table." />

Two things drive it. `useField()` holds the state and the accessibility
wiring; `SpField.vue` renders the chrome. Neither knows about units.

```ts
// docs/.vitepress/theme/useField.ts
const parsed = computed(() => kind.value.parse(value.value));

const valid = computed(() => {
  if (parsed.value.ok) return true;
  return !required && parsed.value.code === "empty";
});

const message = computed(() => {
  if (valid.value) return null;
  if (when === "blur" && !touched.value) return null;   // not yet
  return messageFor(kind.value, parsed.value);
});

const inputProps = computed(() => ({
  id: ids.input,
  "aria-invalid": message.value !== null ? "true" : undefined,
  "aria-describedby": message.value !== null ? `${ids.error} ${ids.hint}` : ids.hint,
  onBlur: () => { touched.value = true },
}));
```

`inputProps` is the part worth extracting. `aria-invalid` and an
`aria-describedby` that points at the error region *only while the region
exists* are what make the red border mean anything to a screen reader — and
they are the two lines that get forgotten in every hand-rolled field. A
dangling `aria-describedby` is worse than none: some readers announce nothing
at all rather than skipping the missing node.

Ids come from Vue's `useId()`, so they survive the SSR pass VitePress does at
build time. A `Math.random()` id hydrates into a mismatch warning and,
occasionally, an input whose label points at nothing.

### `when: "blur"`

Validating on every keystroke tells someone who has typed `3` that `3` is not a
number yet. The default here is `"blur"`: say nothing until the field has been
left once, then update live on every keystroke after that. `markTouched()`
exists for the submit handler, so a field nobody ever focused can still fail
loudly when the form is sent.

### Reka UI's `Label`

`SpField.vue` uses one primitive:

```vue
<script setup lang="ts">
import { Label } from "reka-ui";
</script>

<template>
  <div class="sp-formfield" :class="{ 'sp-formfield--invalid': message }">
    <Label :for="ids.input" class="sp-formfield__label">{{ label }}</Label>

    <slot />

    <p v-if="message" :id="ids.error" role="alert">{{ message }}</p>
    <p :id="ids.hint">…</p>
  </div>
</template>
```

`role="alert"` and not `aria-live="assertive"`: the element is created and
destroyed along with the message, and only `role="alert"` is reliably announced
when the node itself appears. A permanently-mounted `aria-live` region that
starts empty is the other correct answer; an `aria-live` region that is
`v-if`-ed in is the wrong one, and it is the common one.

The control is a `<slot>`, not an `<input>` prop — which is what lets the same
chrome wrap a whole combobox next.

## Autocomplete over the unit table

<SpUnitCombobox kind="length" model-value="12 c" />

Type a number and the first letters of a unit. The rows are the kind's own
alias table — `LENGTH_UNITS.alias`, thirty-two entries mapping to eight units —
matched against the tail of the input. No engine, no network, no debounce: it
is an object lookup over a table the field already imported to validate with.

```vue
<ComboboxRoot
  ignore-filter
  open-on-focus
  :reset-search-term-on-blur="false"
  :reset-search-term-on-select="false"
  @update:model-value="accept"
>
  <ComboboxAnchor>
    <ComboboxInput v-bind="field.inputProps.value" v-model="value" />
  </ComboboxAnchor>

  <ComboboxContent>
    <ComboboxItem v-for="row in rows" :key="row.alias" :value="row.alias">
      {{ row.alias }} <span>{{ row.unit }}</span>
    </ComboboxItem>
    <ComboboxEmpty>No unit starts with {{ fragment }}.</ComboboxEmpty>
  </ComboboxContent>
</ComboboxRoot>
```

Four props carry the whole difference between this and the demo on the Reka UI
homepage:

- **`ignore-filter`** — Reka UI filters items by their rendered text by
  default. Here the candidate list is already the answer to a query, so its
  filter would run a second, dumber one on top. Turning it off makes
  `ComboboxItem` render exactly what you pass.
- **`open-on-focus`** — a unit field has a small, useful candidate set from the
  first keystroke. A search box over ten thousand rows should not do this.
- **`reset-search-term-on-blur` / `-on-select` set to `false`** — both default
  to `true`, which is right when the input is a *search box over* the value and
  wrong when the input *is* the value. Left on, the field empties itself the
  moment you tab away.

The rewrite keeps the number:

```ts
const TAIL = /[\p{L}%°/µ]*$/u;
const fragment = computed(() => value.value.match(TAIL)?.[0] ?? "");
const head = computed(() => value.value.slice(0, value.value.length - fragment.value.length));

function accept(alias: string) {
  value.value = `${head.value}${alias}`;
}
```

Completing the whole input would fight the number in front of it. Splitting
once and rewriting only the tail is also what makes accepting a row
idempotent — accept `cm` twice and the field still reads `12 cm`.

### Matching, and why not `toLowerCase()`

The filter is Reka UI's `useFilter`, which wraps `Intl.Collator`:

```ts
const { startsWith } = useFilter({ sensitivity: "base" });

startsWith("CM", "cm");         // true — case
startsWith("m²", "m2");         // true — compatibility form
startsWith("Ångström", "ang");  // true — accents
```

`sensitivity: "base"` folds case, accents *and* compatibility forms in one
pass. `alias.toLowerCase().startsWith(q.toLowerCase())` gets the first of those
three and misses the other two — so someone typing `m2` never finds `m²`, and a
diacritic in a unit name becomes a unit nobody can complete.

It is not magic, and the demo above shows the edge: `°C` does not match `c`,
because `°` is a character the person has not typed yet. The alias table
carries both `c` and `°c`, which is the right place to solve that — a filter
cannot invent a prefix.

### The keyboard, for free

↓ ↑ move, Enter accepts, Escape dismisses, Tab leaves, and the highlighted row
carries `data-highlighted` so it can be styled without tracking an index:

```css
.sp-cb__item[data-highlighted] {
  background: var(--vp-c-brand-soft);
}
```

That attribute is the whole reason to reach for a primitive library rather than
a `<div>` with a click handler. The other reason is `aria-activedescendant`,
which Reka UI keeps pointed at the highlighted row — the difference between a
list a screen reader narrates and a list it cannot see.

## When to use the engine instead

The combobox above completes *one kind's units*, because the field accepts one
kind. When the field accepts an expression — `1 kg + 500 g`, `3pm in tokyo` —
the candidates come from [`engine.complete()`](/api/complete) instead, which
ranks every registered unit by prefix, scale and length:

<SpComplete model-value="30 ho" />

The two are the same shape and a different weight class: `complete()` needs an
`Engine`, which means locales, kinds and `decimal.js`. Reach for it when the
input really is an expression; reach for the alias table when the input is one
number and one unit, which is most form fields.

The keyboard behaviour for that surface lives in
`docs/.vitepress/theme/useCompletions.ts`, written before Reka UI was in the
project — it is a fair side-by-side of what a primitive library saves you.

## Two things people type that the engine now reads

Both of these used to be errors, and both of them are things a person types into
a form without thinking twice. Neither needs any configuration.

### One quantity, written in two units

A height is `5 ft 3 inches`. A cooking time is `1 h 30 min`. A weight on a
kitchen scale is `1 kg 200 g`. Nobody writes the `+`, and the engine no longer
asks for it:

```ts
engine.evaluate("1 h 30 min").formatted;   // "1.5 hours"
engine.evaluate("1 kg 200 g").formatted;   // "1.2 kilograms"
engine.evaluate("1h30m").formatted;        // "1.5 hours" — no spaces needed
```

The fold is deliberately narrow, because a field that guesses is worse than a
field that refuses. All four of these have to hold:

- **One kind reads both words.** `10 kg 5 s` still fails.
- **Strictly descending units.** `3 m 4 m` is a typo, not a compound, and
  `30 min 1 h` is nobody's way of writing an hour and a half.
- **The kind opted in.** `duration`, `length`, `mass`, `volume` and `angle`
  declare `compound`. `datasize` declines — nobody writes `1 gb 500 mb` — and
  `temperature` must not have it at all, because `20 c 5 f` is not a
  temperature.
- **Everything else stays an expression.** A compound is an operand like any
  other: `1 h 30 min in min` is `90 minutes`, and `1 h 30 min + 30 min` is
  `2 hours`.

One case still fails, and it is worth knowing before a user finds it: `5 ft 3 in`
throws, while `5 ft 3 inches` works. English `length` withholds `in` as a unit
alias on purpose — registering it makes `in 3 days` read as an all-units phrase —
so the trailing `in` stays the conversion keyword. If your field is a height
field, say `inches` in the placeholder.

### Numbers written the way the user's language writes them

On an engine with more than one language installed, a run of digits is read once
per installed number grammar, and the readings are ranked rather than one being
picked:

```
"1 000,5 кг"   → 1000.5 kg   (Ukrainian groups with a space, points with a comma)
"1.000,5 kg"   → 1000.5 kg   (German groups with a dot)
"1,000.5 kg"   → 1000.5 kg   (English groups with a comma)
```

Nothing about the field changes; the unit word beside the digits is what settles
them, because a reading whose grammar agrees with the language that listed the
unit scores higher. For a form this matters most in the case where there is *no*
unit to agree with: a bare `1,000` keeps reading the way the engine's own
language reads it rather than becoming an `AmbiguityError` on every thousand
somebody types. See
[the grammar selector](/guide/weights#the-grammar-selector-for-digits-rather-than-words)
if you want to pin it instead.

## Validating a form, not a field

`useField` gives you `valid` and `markTouched` so a submit handler stays four
lines:

```ts
function submit() {
  for (const field of fields) field.markTouched();
  if (!fields.every((f) => f.valid.value)) return;

  // Every field parsed. `parsed.value` is `Ok`, so `.value` and `.unit` are
  // both there, and converting is one call with no engine in sight.
  const cm = toLength(width.parsed.value as Ok<LengthUnit>, "cm");
}
```

Two things this deliberately does not do:

- **Coerce on the way in.** The field holds the text the person typed. Snapping
  `"12 c"` to `"12 cm"` while they are still typing steals the cursor and,
  worse, sometimes guesses wrong — `"12 c"` is also the start of `"12 chains"`.
- **Submit a string.** Hand the rest of the app `parsed.value`, the `Ok` — it
  carries the number, the unit, and `raw`, the digits exactly as authored, for
  a `Decimal` handoff later. Re-parsing a string at every layer is how a form
  ends up with three regexes that disagree.

## Checklist

A field built this way should tick all of these — the first four come from
`useField`, the rest from the markup around it:

- `<label for>` pointing at the input's `id`, generated with `useId()`
- `aria-invalid` on the input while, and only while, a message is shown
- `aria-describedby` listing the hint always, the error only when it exists
- the error region as `role="alert"`, created with the message
- the message naming what to do, not what went wrong (`Add a unit: cm, m, km`
  beats `Invalid input`)
- the unit list in the message read from the table, never typed out
- `inputmode="decimal"`, `autocomplete="off"`, `spellcheck="false"` on a unit
  field
- the combobox reachable and dismissable by keyboard alone, with no mouse
