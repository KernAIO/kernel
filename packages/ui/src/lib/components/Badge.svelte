<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import { cn } from '../utils.js'

/**
 * chip   — 12px, pad 3/9, r6, tint/fg pairs (status/kind/state chips)
 * count  — DM Mono 10.5px, 16px tall pill, min-width 17 (nav badge)
 * glow   — like count, danger bg (unread/urgent)
 * dot    — 6–7px unread dot
 */
export type BadgeVariant = 'chip' | 'count' | 'glow' | 'dot'
export type BadgeTone =
  | 'grey'
  | 'neutral'
  | 'accent'
  | 'danger'
  | 'success'
  | 'info'
  | 'purple'
  | 'warning'
  | 'slate'
  // semantic aliases (DESIGN.md §1.1 / §3.8)
  | 'mention'
  | 'assigned'
  | 'huddle'
  | 'thread'
  | 'active'
  | 'live'
  | 'done'
  | 'upcoming'
  | 'planned'
  | 'declined'
  | 'on-leave'
  | 'onboarding'
  | 'in-progress'
  | 'in-review'
  | 'todo'
  | 'triage'
  | 'urgent'

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  tone?: BadgeTone
  icon?: Snippet
  class?: string
  children?: Snippet
}
let { variant = 'chip', tone = 'grey', icon, class: className, children, ...rest }: Props = $props()
const toneMap: Record<string, string> = {
  mention: 'purple',
  assigned: 'info',
  huddle: 'success',
  thread: 'neutral',
  active: 'success',
  live: 'success',
  done: 'success',
  upcoming: 'grey',
  planned: 'grey',
  declined: 'danger',
  'on-leave': 'warning',
  onboarding: 'info',
  'in-progress': 'accent',
  'in-review': 'purple2',
  todo: 'grey',
  triage: 'grey',
  urgent: 'danger-solid',
}
const t = $derived(toneMap[tone] ?? tone)
</script>

{#if variant === 'dot'}
  <span class={cn('kdot', `t-${t}`, className)} {...rest}></span>
{:else}
  <span class={cn('kbadge', `v-${variant}`, `t-${t}`, className)} {...rest}>{#if icon}{@render icon()}{/if}{@render children?.()}</span>
{/if}

<style>
  .kbadge { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; line-height: 1.3; vertical-align: middle; }
  .v-chip { font-size: 12px; padding: 3px 9px; border-radius: var(--kern-r-md); }
  /*
   * A count is read as one glance, so it is sized like a token rather than typeset like text: a fixed
   * 16px height with `line-height: 1` puts the digit on the optical centre, and `min-width` keeps a
   * single digit from collapsing into a square block. Two digits and "99+" grow the pill sideways.
   */
  .v-count, .v-glow { font-family: var(--kern-font-mono); font-size: 10.5px; font-weight: 500; height: 16px; min-width: 17px; padding: 0 5px; justify-content: center; line-height: 1; border-radius: var(--kern-r-full); background: var(--kern-surface-active); color: var(--kern-ink-400); flex: none; }
  .v-glow { background: var(--kern-danger) !important; color: var(--kern-ink-inverse) !important; }
  .kdot { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: var(--kern-danger); flex: none; }
  .kdot.t-success { background: var(--kern-success); }
  .kdot.t-grey { background: var(--kern-border-hover); }
  .kdot.t-accent { background: var(--kern-accent); }

  .v-chip.t-grey { background: var(--kern-surface-chip); color: var(--kern-ink-520); }
  .v-chip.t-neutral { background: var(--kern-surface-chip); color: var(--kern-ink-500); }
  .v-chip.t-accent { background: var(--kern-accent-tint); color: var(--kern-accent-deep); }
  .v-chip.t-danger { background: var(--kern-danger-tint); color: var(--kern-danger); }
  .v-chip.t-danger-solid { background: var(--kern-danger); color: var(--kern-ink-inverse); }
  .v-chip.t-success { background: var(--kern-success-tint); color: var(--kern-success-chip); }
  .v-chip.t-info { background: var(--kern-info-tint); color: var(--kern-info); }
  .v-chip.t-purple { background: var(--kern-purple-tint); color: var(--kern-purple); }
  .v-chip.t-purple2 { background: var(--kern-purple-tint-2); color: var(--kern-purple-status); }
  .v-chip.t-warning { background: var(--kern-warning-tint); color: var(--kern-warning); }
  .v-chip.t-slate { background: var(--kern-slate-tint); color: var(--kern-slate); }
  .v-count.t-accent { background: var(--kern-accent-tint); color: var(--kern-accent-deep); }
</style>
