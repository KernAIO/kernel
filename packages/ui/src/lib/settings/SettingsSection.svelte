<script lang="ts">
import type { Snippet } from 'svelte'

/**
 * A settings card: heading, optional description and header action, a body of rows, and a footer that
 * only appears when there is something to confirm — so a form never shows a dead Save button.
 *
 * Lives in the design system so a module package can build its settings pages from the same cards as
 * the host app's own. The app's `$lib/components/settings` re-exports these; nothing else changes.
 */
interface Props {
  title?: string
  description?: string
  /** action shown in the section header, e.g. "Add" */
  action?: Snippet
  footer?: Snippet
  /** removes body padding for full-bleed content such as tables */
  flush?: boolean
  tone?: 'default' | 'danger'
  children: Snippet
}
let { title, description, action, footer, flush = false, tone = 'default', children }: Props = $props()
</script>

<section
  class="overflow-hidden rounded-[10px] border bg-[var(--kern-surface-raised)] {tone === 'danger'
    ? 'border-[var(--kern-danger-tint)]'
    : 'border-[var(--kern-border)]'}"
>
  {#if title}
    <header class="flex items-start gap-4 px-[18px] pb-3 pt-4">
      <div class="min-w-0 flex-1">
        <h2
          class="text-[15px] font-medium tracking-[-0.01em] {tone === 'danger'
            ? 'text-[var(--kern-danger)]'
            : 'text-[var(--kern-ink-900)]'}"
        >
          {title}
        </h2>
        {#if description}
          <p class="mt-1 text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">{description}</p>
        {/if}
      </div>
      {#if action}<div class="shrink-0">{@render action()}</div>{/if}
    </header>
  {/if}

  <!--
    With a title the header supplies the top padding; without one the body is the first thing in the
    card and has to supply its own, or the content sits against the border with 18px below it.
  -->
  <div class={flush ? '' : title ? 'px-[18px] pb-[18px]' : 'p-[18px]'}>{@render children()}</div>

  {#if footer}
    <footer
      class="flex items-center justify-end gap-2 border-t border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-[18px] py-3"
    >
      {@render footer()}
    </footer>
  {/if}
</section>
