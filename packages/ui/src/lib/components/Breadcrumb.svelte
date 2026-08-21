<script lang="ts">
import { cn } from '../utils.js'

interface Crumb {
  label: string
  href?: string
}
interface Props {
  items: Crumb[]
  class?: string
}
let { items, class: className }: Props = $props()
</script>

<nav class={cn('kbc', className)} aria-label="Breadcrumb">
  <ol>
    {#each items as it, i (i)}
      <li>
        {#if it.href && i < items.length - 1}<a href={it.href}>{it.label}</a>{:else}<span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>{/if}
        {#if i < items.length - 1}<span class="sep" aria-hidden="true">/</span>{/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .kbc { min-width: 0; flex: 1; overflow: hidden; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: 6px; font-family: var(--kern-font-mono); font-size: 11.5px; letter-spacing: -0.01em; color: var(--kern-ink-250); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  li { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
  li:last-child { overflow: hidden; text-overflow: ellipsis; }
  a { color: inherit; }
  a:hover { color: var(--kern-ink-700); }
  .sep { opacity: 0.8; }
</style>
