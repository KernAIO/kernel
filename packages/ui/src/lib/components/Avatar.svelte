<script lang="ts">
import { Avatar as AvatarPrimitive } from 'bits-ui'
import { avatarFontSize, avatarRadius, cn, identityColor, initials } from '../utils.js'

interface Props {
  name?: string | null
  src?: string | null
  /** seed for the identity colour (user id); defaults to name */
  id?: string | null
  size?: number
  /** explicit bg colour override */
  color?: string
  /** presence dot */
  presence?: 'online' | 'away' | 'dnd' | 'offline' | null
  /** ring colour for stacks (default white) */
  ring?: boolean
  square?: boolean
  class?: string
  title?: string
}
let {
  name = '',
  src = null,
  id = null,
  size = 22,
  color,
  presence = null,
  ring = false,
  square = true,
  class: className,
  title,
}: Props = $props()
const bg = $derived(color ?? identityColor(id ?? name))
</script>

<AvatarPrimitive.Root
  class={cn('kav', ring && 'ring', className)}
  style="--s:{size}px;--r:{square ? avatarRadius(size) : 999}px;--fs:{avatarFontSize(size)}px;--bg:{bg}"
  title={title ?? name ?? undefined}
  delayMs={0}
>
  {#if src}<AvatarPrimitive.Image {src} alt={name ?? ''} class="kav-img" />{/if}
  <AvatarPrimitive.Fallback class="kav-fb">{initials(name)}</AvatarPrimitive.Fallback>
  {#if presence}<span class={cn('kav-presence', `p-${presence}`)} aria-label={presence}></span>{/if}
</AvatarPrimitive.Root>

<style>
  :global(.kav) {
    position: relative; display: inline-grid; place-items: center; flex: none;
    width: var(--s); height: var(--s); border-radius: var(--r); background: var(--bg);
    color: var(--kern-av-fg); font-size: var(--fs); font-weight: 600; letter-spacing: -0.01em; line-height: 1;
    overflow: visible; user-select: none;
  }
  :global(.kav.ring) { box-shadow: var(--kern-shadow-avatar-ring); }
  :global(.kav-img) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  :global(.kav-fb) { display: grid; place-items: center; width: 100%; height: 100%; border-radius: inherit; }
  .kav-presence { position: absolute; bottom: -2px; inset-inline-end: -2px; width: 9px; height: 9px; border-radius: 999px; border: 2px solid var(--kern-shell); background: var(--kern-success); box-sizing: content-box; }
  .kav-presence.p-away { background: var(--kern-warning); }
  .kav-presence.p-dnd { background: var(--kern-danger); }
  .kav-presence.p-offline { background: var(--kern-border-hover); }
</style>
