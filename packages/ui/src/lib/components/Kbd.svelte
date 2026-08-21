<script lang="ts">
import type { Snippet } from 'svelte'
import { cn, formatKeys } from '../utils.js'

/** Keyboard hint. Pass `keys` (['mod','k']) or children. `chip` = bordered ⌘K chip (footer); default = plain DM Mono hint (palette). */
interface Props {
  keys?: string[]
  chip?: boolean
  class?: string
  children?: Snippet
}
let { keys, chip = false, class: className, children }: Props = $props()
</script>

<kbd class={cn('kkbd', chip && 'chip', className)}>{#if children}{@render children()}{:else if keys}{formatKeys(keys)}{/if}</kbd>

<style>
  .kkbd { font-family: var(--kern-font-mono); font-size: 12px; color: var(--kern-ink-250); white-space: nowrap; letter-spacing: -0.01em; }
  .kkbd.chip { font-size: 10.5px; color: var(--kern-ink-350); border: 1px solid var(--kern-border-strong); border-radius: var(--kern-r-md); padding: 2px 6px; line-height: 1.3; }
</style>
