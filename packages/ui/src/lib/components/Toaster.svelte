<script lang="ts">
import Icon from '../icons/Icon.svelte'
import { toastStore } from './toast.svelte.js'

/** Bottom-centre (DESIGN.md §3.16) or bottom-end. Dark ink bg, white 13px, r8. */
interface Props {
  position?: 'bottom-center' | 'bottom-end'
  inline?: boolean
}
let { position = 'bottom-center', inline = false }: Props = $props()
</script>

<div class="ktoasts {position}" class:inline aria-live="polite" aria-atomic="false">
  {#each toastStore.items as t (t.id)}
    <div class="ktoast k-{t.kind}" role="status" onmouseenter={() => toastStore.pause(t.id)} onmouseleave={() => toastStore.resume(t.id)}>
      {#if t.kind === 'success'}<Icon name="circle-check" size={14} strokeWidth={1.8} class="ic" />{:else if t.kind === 'error'}<Icon name="circle-alert" size={14} strokeWidth={1.8} class="ic" />{:else if t.kind === 'warning'}<Icon name="triangle-alert" size={14} strokeWidth={1.8} class="ic" />{/if}
      <span class="txt"><span class="t">{t.title}</span>{#if t.description}<span class="d">{t.description}</span>{/if}</span>
      {#if t.action}<button type="button" class="act" onclick={() => { t.action?.onClick(); toastStore.dismiss(t.id) }}>{t.action.label}</button>{/if}
      {#if t.duration === 0 || t.kind === 'error'}<button type="button" class="x" aria-label="Dismiss" onclick={() => toastStore.dismiss(t.id)}><Icon name="x" size={12} strokeWidth={2} /></button>{/if}
    </div>
  {/each}
</div>

<style>
  .ktoasts { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: var(--kern-z-toast); pointer-events: none; max-width: calc(100vw - 32px); }
  .ktoasts.inline { position: absolute; }
  .ktoasts.bottom-end { left: auto; transform: none; inset-inline-end: 20px; align-items: flex-end; }
  .ktoast { pointer-events: auto; display: flex; align-items: center; gap: 10px; background: var(--kern-ink-900); color: var(--kern-ink-inverse); font-size: 13px; padding: 10px 16px; border-radius: var(--kern-r-lg); box-shadow: var(--kern-shadow-toast); animation: kfade 0.14s ease-out; max-width: 440px; }
  .ktoast :global(.ic) { flex: none; opacity: 0.9; }
  .k-error :global(.ic) { color: #F2A08D; }
  .k-success :global(.ic) { color: #8FD3A5; }
  .k-warning :global(.ic) { color: #F0C27D; }
  .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .d { font-size: 12px; opacity: 0.7; }
  .act { color: inherit; font-weight: 600; font-size: 12.5px; padding: 2px 6px; margin-inline-start: 4px; border-radius: 5px; background: rgba(255,255,255,0.12); }
  .act:hover { background: rgba(255,255,255,0.2); }
  .x { color: inherit; opacity: 0.6; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; }
  .x:hover { opacity: 1; background: rgba(255,255,255,0.12); }
  @media (max-width: 640px) { .ktoasts { bottom: calc(var(--kern-bottombar-h) + 12px); } }
</style>
