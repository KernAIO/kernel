<script lang="ts">
import { Dialog, Command as P } from 'bits-ui'
import type { Snippet } from 'svelte'
import Icon from '../icons/Icon.svelte'
import { cn } from '../utils.js'
import Kbd from './Kbd.svelte'

export interface CommandItem {
  id: string
  label: string
  icon?: string
  hint?: string
  keys?: string[]
  group?: string
  keywords?: string[]
  description?: string
  onSelect: () => void
  disabled?: boolean
}
/**
 * ⌘K palette (DESIGN.md §3.15): 560px, r12, top 84px, input row 48, item rows 42.
 * Controlled via `open`; `items` are grouped by `group` in insertion order. Set `shouldFilter=false`
 * to do your own filtering (e.g. async search) and pass `search` bindable.
 */
interface Props {
  open?: boolean
  items: CommandItem[]
  search?: string
  placeholder?: string
  emptyText?: string
  loading?: boolean
  shouldFilter?: boolean
  /** content inside the content column (absolute) instead of viewport */
  inline?: boolean
  footer?: Snippet
  class?: string
  onOpenChange?: (o: boolean) => void
}
let {
  open = $bindable(false),
  items,
  search = $bindable(''),
  placeholder = 'Jump to, or run a command…',
  emptyText = 'No results',
  loading = false,
  shouldFilter = true,
  inline = false,
  footer,
  class: className,
  onOpenChange,
}: Props = $props()

const groups = $derived.by(() => {
  const m = new Map<string, CommandItem[]>()
  for (const it of items) {
    const g = it.group ?? ''
    if (!m.has(g)) m.set(g, [])
    m.get(g)!.push(it)
  }
  return [...m.entries()]
})
function run(it: CommandItem) {
  open = false
  onOpenChange?.(false)
  queueMicrotask(() => it.onSelect())
}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { onOpenChange?.(o); if (!o) search = '' }}>
  <Dialog.Portal disabled={inline}>
    <Dialog.Overlay class={cn('kcmd-overlay', inline && 'inline')} />
    <Dialog.Content class={cn('kcmd', inline && 'inline', className)} aria-label="Command palette">
      <P.Root class="kcmd-root" {shouldFilter} loop>
        <div class="kcmd-inputrow">
          <Icon name={loading ? 'loader' : 'search'} size={16} strokeWidth={1.6} class={loading ? 'kcmd-sic spin' : 'kcmd-sic'} />
          <P.Input class="kcmd-input" {placeholder} bind:value={search} autofocus />
          <Kbd keys={['escape']} />
        </div>
        <P.List class="kcmd-list">
          <P.Viewport>
            <P.Empty class="kcmd-empty">{emptyText}</P.Empty>
            {#each groups as [g, its] (g)}
              <P.Group class="kcmd-group">
                {#if g}<P.GroupHeading class="kcmd-gh">{g}</P.GroupHeading>{/if}
                <P.GroupItems>
                  {#each its as it (it.id)}
                    <P.Item value={it.id} keywords={[it.label, ...(it.keywords ?? [])]} disabled={it.disabled} onSelect={() => run(it)} class="kcmd-item">
                      <span class="ic">{#if it.icon}<Icon name={it.icon} size={16} strokeWidth={1.6} />{/if}</span>
                      <span class="l"><span class="t">{it.label}</span>{#if it.description}<span class="d">{it.description}</span>{/if}</span>
                      {#if it.keys}<Kbd keys={it.keys} />{:else if it.hint}<span class="hint">{it.hint}</span>{/if}
                    </P.Item>
                  {/each}
                </P.GroupItems>
              </P.Group>
            {/each}
          </P.Viewport>
        </P.List>
        {#if footer}<div class="kcmd-foot">{@render footer()}</div>{/if}
      </P.Root>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.kcmd-overlay) { position: fixed; inset: 0; background: var(--kern-overlay); z-index: var(--kern-z-command); animation: kfade 0.1s ease-out; }
  :global(.kcmd-overlay.inline) { position: absolute; }
  :global(.kcmd) {
    position: fixed; top: 84px; left: 50%; transform: translateX(-50%);
    width: 560px; max-width: calc(100vw - 24px); max-height: min(520px, calc(100dvh - 100px));
    background: var(--kern-surface-raised); border-radius: var(--kern-r-dialog); box-shadow: var(--kern-shadow-dialog);
    overflow: hidden; z-index: calc(var(--kern-z-command) + 1); outline: none; animation: kfade 0.1s ease-out; display: flex; flex-direction: column;
  }
  :global(.kcmd.inline) { position: absolute; }
  :global(.kcmd-root) { display: flex; flex-direction: column; min-height: 0; }
  .kcmd-inputrow { display: flex; align-items: center; gap: 11px; height: 48px; padding: 0 16px; border-bottom: 1px solid var(--kern-border-strong); flex: none; }
  :global(.kcmd-sic) { color: var(--kern-ink-280); flex: none; }
  :global(.kcmd-sic.spin) { animation: kspin 0.8s linear infinite; }
  @keyframes kspin { to { transform: rotate(360deg); } }
  :global(.kcmd-input) { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; font-size: 15px; color: var(--kern-ink-800); box-shadow: none !important; padding: 0; }
  :global(.kcmd-input::placeholder) { color: var(--kern-ink-350); }
  :global(.kcmd-list) { overflow-y: auto; min-height: 0; padding: 6px 0; max-height: 440px; }
  :global(.kcmd-empty) { padding: 28px 16px; text-align: center; font-size: 13.5px; color: var(--kern-ink-350); }
  :global(.kcmd-gh) { padding: 8px 16px 4px; font-family: var(--kern-font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--kern-ink-300); }
  :global(.kcmd-item) { display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 16px; cursor: pointer; user-select: none; outline: none; }
  :global(.kcmd-item[data-selected]) { background: var(--kern-surface-popover-hover); }
  :global(.kcmd-item[data-disabled]) { opacity: 0.45; cursor: not-allowed; }
  .ic { width: 16px; display: inline-grid; place-items: center; color: var(--kern-ink-400); flex: none; }
  .l { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; overflow: hidden; }
  .t { font-size: 14px; color: var(--kern-ink-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .d { font-size: 12px; color: var(--kern-ink-350); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hint { font-family: var(--kern-font-mono); font-size: 12px; color: var(--kern-ink-250); }
  .kcmd-foot { display: flex; align-items: center; gap: 14px; height: 36px; padding: 0 16px; border-top: 1px solid var(--kern-border-hairline); font-size: 12px; color: var(--kern-ink-350); flex: none; }
  @media (max-width: 640px) { :global(.kcmd) { top: 12px; } }
</style>
