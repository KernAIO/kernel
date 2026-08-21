<script lang="ts">
import type { Snippet } from 'svelte'
import { cn, uid } from '../utils.js'
import Label from './Label.svelte'

/** Label + control + (error|hint) stack. Pass `id` to children via the snippet argument. */
interface Props {
  label?: string
  required?: boolean
  hint?: string
  error?: string | null
  id?: string
  inline?: boolean
  class?: string
  children: Snippet<[string]>
}
let {
  label,
  required = false,
  hint,
  error = null,
  id = uid('f'),
  inline = false,
  class: className,
  children,
}: Props = $props()
</script>

<div class={cn('kfield', inline && 'inline', className)}>
  {#if label}<Label for={id} {required}>{label}</Label>{/if}
  <div class="ctl">{@render children(id)}</div>
  {#if error}<p class="msg err" role="alert">{error}</p>{:else if hint}<p class="msg">{hint}</p>{/if}
</div>

<style>
  .kfield { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .kfield.inline { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 6px 16px; align-items: center; }
  .kfield.inline .msg { grid-column: 2; }
  .ctl { min-width: 0; }
  .msg { margin: 0; font-size: 12px; color: var(--kern-ink-350); }
  .msg.err { color: var(--kern-danger); }
</style>
