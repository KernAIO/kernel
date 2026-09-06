<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'
import Avatar from '../components/Avatar.svelte'
import Icon from '../icons/Icon.svelte'

/**
 * Workspace switcher button: name 15px w600, mono sub-line, chevrons.
 *
 * The avatar's identity seed is `avatarId`, never `id`: this button is a menu trigger, and a
 * trigger's `id` belongs to whatever opened the menu. Naming the seed `id` shadowed the DOM
 * attribute, so the workspace id landed on the avatar and the button was left with no id at all —
 * and bits-ui compares `event.target.id` with the trigger's id to decide whether a click was on the
 * trigger, so with both empty every outside click on an element without an id read as a click on the
 * trigger and the menu never closed.
 */
interface Props extends HTMLButtonAttributes {
  name: string
  subline?: string
  logoUrl?: string | null
  /** identity the avatar derives its fallback colour from — not the button's DOM id */
  avatarId?: string | null
  showAvatar?: boolean
  children?: Snippet
}
let { name, subline, logoUrl = null, avatarId, showAvatar = true, children, ...rest }: Props = $props()
</script>

<button type="button" class="ksw" aria-haspopup="menu" {...rest}>
  {#if showAvatar}<Avatar id={avatarId} {name} src={logoUrl} size={28} />{/if}
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
