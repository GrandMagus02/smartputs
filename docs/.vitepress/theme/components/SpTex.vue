<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";

const props = withDefaults(
  defineProps<{
    /** LaTeX source. Rendered as maths, not as text. */
    tex: string;
    display?: boolean;
  }>(),
  { display: false },
);

type Katex = typeof import("katex").default;

/**
 * KaTeX and its stylesheet are fetched on mount rather than imported into the
 * theme chunk: pages without maths on them should not carry a typesetter. Until
 * it lands — and during the SSR pass, which has no `window` — the source shows
 * as code, which is readable and does not reflow into a blank.
 */
const katex = shallowRef<Katex | null>(null);

onMounted(async () => {
  const [module] = await Promise.all([
    import("katex"),
    import("katex/dist/katex.min.css"),
  ]);
  katex.value = module.default;
});

/**
 * `throwOnError: false` renders an unparseable formula as its own source in
 * red, rather than taking the demo down with it. These are live inputs, so
 * every renderable state is reached through unrenderable ones.
 */
const html = computed(() =>
  katex.value === null
    ? null
    : katex.value.renderToString(props.tex, {
        displayMode: props.display,
        throwOnError: false,
        output: "html",
      }),
);
</script>

<template>
  <span v-if="html" class="sp-tex" :class="{ 'sp-tex--display': display }" v-html="html" />
  <code v-else class="sp-tex sp-tex--raw">{{ tex }}</code>
</template>

<style scoped>
.sp-tex {
  line-height: 1.5;
}

.sp-tex--display {
  display: block;
  margin: 2px 0;
}

.sp-tex--raw {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

/* KaTeX ships its own colours for light backgrounds; inherit the page's
   instead so the dark theme does not print black on near-black. */
.sp-tex :deep(.katex) {
  color: inherit;
  font-size: 1.05em;
}
</style>
