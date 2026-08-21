<script lang="ts">
import Icon from '../icons/Icon.svelte'

interface Props {
  size?: number
  class?: string
  label?: string
}
let { size = 16, class: className, label = 'Loading' }: Props = $props()
</script>
<span class="kspin {className ?? ''}" role="status" aria-label={label}><Icon name="loader" {size} strokeWidth={1.8} /></span>
<style>
  .kspin { display: inline-grid; place-items: center; color: var(--kern-ink-350); }
  .kspin :global(svg) { animation: kspin 0.8s linear infinite; }
  @keyframes kspin { to { transform: rotate(360deg); } }
</style>
