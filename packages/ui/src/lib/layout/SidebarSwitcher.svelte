<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'
import Avatar from '../components/Avatar.svelte'
import Icon from '../icons/Icon.svelte'

/** Workspace switcher button: name 15px w600, mono sub-line, chevrons. */
interface Props extends HTMLButtonAttributes {
  name: string
  subline?: string
  logoUrl?: string | null
  id?: string
  showAvatar?: boolean
  children?: Snippet
}
let { name, subline, logoUrl = null, id, showAvatar = true, children, ...rest }: Props = $props()
</script>

<button type="button" class="ksw" aria-haspopup="menu" {...rest}>
  {#if showAvatar}<Avatar {id} {name} src={logoUrl} size={28} />{/if}
  <span class="txt">
    <span class="n">{name}</span>
    {#if subline}<span class="s">{subline}</span>{/if}
  </span>
  {@render children?.()}
  <Icon name="chevrons-up-down" size={13} strokeWidth={1.6} class="ksw-chev" />
</button>

<style>
  .ksw { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 14px; min-width: 0; text-align: start; color: inherit; }
  .ksw:hover { background: var(--kern-surface-switcher-hover); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .n { font-size: 15px; font-weight: 600; color: var(--kern-ink-900); letter-spacing: -0.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .s { font-family: var(--kern-font-mono); font-size: 11px; color: var(--kern-ink-300); letter-spacing: -0.01em; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.ksw-chev) { color: var(--kern-ink-250); flex: none; }
</style>
