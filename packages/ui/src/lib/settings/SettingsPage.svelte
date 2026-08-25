<script lang="ts">
import type { Snippet } from 'svelte'

/**
 * Frame for a settings page: title, one line of context, and the accent measure rule that marks the
 * start of content elsewhere in the product (app DESIGN.md §2.4). Pages compose `SettingsSection`s
 * below.
 *
 * Lives in the design system so a module package can frame its own settings pages exactly like the
 * app's own — same tokens, same anatomy. The app's `$lib/components/settings` re-exports this.
 */
interface Props {
  title: string
  description?: string
  /** what this page sits under in the browser tab — "Settings" unless the page says otherwise */
  section?: string
  actions?: Snippet
  children: Snippet
  /** names the browser tab; the host app supplies its translated "Settings" */
  settingsTitle?: () => string
}
let { title, description, section, actions, children, settingsTitle }: Props = $props()
</script>

<!--
  The frame already knows the page's name, so it names the browser tab too — there is one source for
  it rather than a `<svelte:head>` each page has to remember.

  Do not add a second `<svelte:head><title>` in a page that uses this frame. Two `<title>` elements
  both reach the document and the browser keeps the first, which is this one — so the page's own
  would look right in the source and never appear.
-->
<svelte:head>
  <title>{title} · {section ?? settingsTitle?.() ?? 'Settings'}</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-[760px] gap-5">
  <header class="grid gap-3">
    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <h1 class="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-[var(--kern-ink-900)]">
          {title}
        </h1>
        {#if description}
          <p class="mt-1 text-[13px] leading-relaxed text-[var(--kern-ink-500)]">{description}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex shrink-0 items-center gap-2 pt-0.5">{@render actions()}</div>
      {/if}
    </div>
    <div class="h-[3px] w-[34px] rounded-[2px] bg-[var(--kern-accent)]"></div>
  </header>

  {@render children()}
</div>
