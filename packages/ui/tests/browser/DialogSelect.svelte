<script lang="ts">
/**
 * The shape that was unusable: a Select inside a Dialog. Both are portalled to `<body>`, so the
 * only thing deciding whether the pointer reaches an option is the layer scale.
 *
 * Modelled on Quire's property-type picker, which is where it was found — with the type picker
 * unreachable, every column type except Text was unreachable with it.
 */
import Dialog from '../../src/lib/components/Dialog.svelte'
import Select from '../../src/lib/components/Select.svelte'

let open = $state(true)
let value = $state('text')

const options = [
  { value: 'text', label: 'Text' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'number', label: 'Number' },
]
</script>

<Dialog bind:open title="New property" initialFocus={false}>
  <Select bind:value {options} placeholder="Type" id="property-type" />
  <p id="chosen">{value}</p>
</Dialog>
