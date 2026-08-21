<script lang="ts">
import { cn } from '../utils.js'

/** measure = 3px header sprint bar (accent); bar = 6px milestone bar */
interface Props {
  value: number
  max?: number
  variant?: 'measure' | 'bar'
  tone?: 'accent' | 'info' | 'success' | 'danger'
  label?: string
  class?: string
}
let {
  value,
  max = 100,
  variant = 'bar',
  tone = variant === 'measure' ? 'accent' : 'info',
  label,
  class: className,
}: Props = $props()
const pct = $derived(Math.max(0, Math.min(100, (value / (max || 1)) * 100)))
</script>

<div class={cn('kpb', `v-${variant}`, `t-${tone}`, className)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
  <div class="fill" style:width="{pct}%"></div>
</div>

<style>
  .kpb { overflow: hidden; width: 100%; }
  .v-measure { height: 3px; border-radius: 2px; background: var(--kern-surface-active); }
  .v-bar { height: 6px; border-radius: 999px; background: var(--kern-border-strong); }
  .fill { height: 100%; border-radius: inherit; background: var(--kern-accent); transition: width 200ms var(--kern-ease-out); }
  .t-info .fill { background: var(--kern-info-bar); }
  .t-success .fill { background: var(--kern-success-chip); }
  .t-danger .fill { background: var(--kern-danger); }
  .t-accent .fill { background: var(--kern-accent); }
</style>
