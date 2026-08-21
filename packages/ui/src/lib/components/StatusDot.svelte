<script lang="ts">
import { cn } from '../utils.js'

interface Props {
  status?: 'online' | 'away' | 'dnd' | 'offline' | 'live' | 'idle' | 'unread' | 'free'
  size?: number
  class?: string
  label?: string
}
let { status = 'online', size = 7, class: className, label }: Props = $props()
</script>

<span class={cn('ksd', `s-${status}`, className)} style:--s="{size}px" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}></span>

<style>
  .ksd { display: inline-block; width: var(--s); height: var(--s); border-radius: 999px; background: var(--kern-success); flex: none; }
  .s-live, .s-free { background: var(--kern-success); }
  .s-away { background: var(--kern-warning); }
  .s-dnd, .s-unread { background: var(--kern-danger); }
  .s-offline { opacity: 0; }
  .s-idle { background: var(--kern-border-hover); }
</style>
