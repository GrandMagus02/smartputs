<script setup lang="ts">
import { useCopyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms/vitepress-components";
import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Copy / download the page as Markdown. The `.md` files these fetch are the
 * ones `vitepress-plugin-llms` emits next to every route, so the content is
 * the real source, not a DOM scrape.
 *
 * The buttons are never disabled on `markdownPageURL`: it resolves in
 * `onMounted`, so gating on it renders differently on the server and the
 * client and Vue reports a hydration mismatch. A click before hydration does
 * nothing anyway.
 */
const {
  copied,
  downloaded,
  aiProviders,
  copyAsMarkdown,
  downloadMarkdown,
  viewAsMarkdown,
  openInAI,
} = useCopyOrDownloadAsMarkdownButtons();

const menuOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) menuOpen.value = false;
}

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") menuOpen.value = false;
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onEscape);
});
</script>

<template>
  <div ref="root" class="sp-actions">
    <!-- Split button: the primary action and its menu share one outline. -->
    <div class="sp-actions__split">
      <button
        type="button"
        class="sp-actions__btn sp-actions__btn--main"
        :aria-label="copied ? 'Copied' : 'Copy page as Markdown'"
        @click="copyAsMarkdown"
      >
        <span :class="copied ? 'i-hugeicons-tick-02' : 'i-hugeicons-copy-01'" aria-hidden="true" />
        {{ copied ? "Copied" : "Copy page" }}
      </button>

      <button
        type="button"
        class="sp-actions__btn sp-actions__btn--caret"
        aria-label="More page actions"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <span class="i-hugeicons-arrow-down-01" aria-hidden="true" />
      </button>

      <div v-if="menuOpen" class="sp-actions__menu" role="menu">
        <button
          type="button"
          role="menuitem"
          @click="
            viewAsMarkdown();
            menuOpen = false;
          "
        >
          <span class="i-hugeicons-file-02" aria-hidden="true" />
          View raw Markdown
        </button>
        <button
          v-for="provider in aiProviders"
          :key="provider.name"
          type="button"
          role="menuitem"
          @click="
            openInAI(provider);
            menuOpen = false;
          "
        >
          <span class="i-hugeicons-bot" aria-hidden="true" />
          Open in {{ provider.name }}
          <span class="i-hugeicons-link-square-01 sp-actions__ext" aria-hidden="true" />
        </button>
      </div>
    </div>

    <button
      type="button"
      class="sp-actions__btn sp-actions__btn--solo"
      :aria-label="downloaded ? 'Downloaded' : 'Download page as Markdown'"
      @click="downloadMarkdown"
    >
      <span :class="downloaded ? 'i-hugeicons-tick-02' : 'i-hugeicons-download-01'" aria-hidden="true" />
      {{ downloaded ? "Saved" : "Download" }}
    </button>
  </div>
</template>

<style scoped>
/**
 * Rendered in the `doc-before` slot, which sits before `<main>` in the flow.
 * Floating it right lets the page's `h1` — a block whose line boxes shorten
 * around a float — sit beside it, with no markup change to the content.
 */
.sp-actions {
  float: right;
  display: flex;
  gap: 8px;
  /* Above the `h1` it sits beside, so the heading's anchor and hover target
     never swallow a click on the buttons. */
  position: relative;
  z-index: 1;
  /*
   * Centres a 30px control against the 40px line-height of `.vp-doc h1`.
   * The total float height (5 + 30) must stay under that 40px, or the
   * paragraph after the title wraps around it too.
   */
  margin: 5px 0 0 20px;
}

.sp-actions__split {
  position: relative;
  display: flex;
}

.sp-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition:
    color 0.2s,
    border-color 0.2s,
    background-color 0.2s;
}

.sp-actions__btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  z-index: 1;
}

.sp-actions__btn--solo {
  border-radius: 8px;
}

.sp-actions__btn--main {
  border-radius: 8px 0 0 8px;
}

.sp-actions__btn--caret {
  /* Collapse the shared edge so the pair reads as one control. */
  margin-left: -1px;
  padding: 0 7px;
  border-radius: 0 8px 8px 0;
}

.sp-actions__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 200px;
  padding: 4px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  display: flex;
  flex-direction: column;
}

.sp-actions__menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-align: left;
  white-space: nowrap;
}

.sp-actions__menu button:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.sp-actions__ext {
  margin-left: auto;
  opacity: 0.6;
}

/* Too narrow to share a line with the title — stack above it instead. */
@media (max-width: 640px) {
  .sp-actions {
    float: none;
    margin: 0 0 20px;
  }

  .sp-actions__menu {
    right: auto;
    left: 0;
  }
}
</style>
