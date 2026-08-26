<script lang="ts">
/**
 * A page editor with nothing to connect to.
 *
 * Two things are checked against this. The drag grip: the plugin only takes it over when the editor
 * is created, which is after the highlighting grammars have been fetched, so between first paint and
 * that moment the grip is on screen with nobody positioning it — and it has to be invisible for the
 * whole of that window, however long the window is. And the `/` menu, which is the only way a person
 * can reach most of what a page can hold.
 *
 * The document is local either way, so the editor is fully usable with the socket refused.
 */
import CollaborativeEditor from '../../src/lib/editor/CollaborativeEditor.svelte'
import { setMessageLocale } from '../../src/lib/i18n.svelte.js'

// Port 9 is discard: the socket is refused immediately rather than hanging.
const url = 'ws://127.0.0.1:9/collab'

const params = new URLSearchParams(window.location.search)
const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
document.documentElement.dir = dir
document.documentElement.lang = dir === 'rtl' ? 'fa' : 'en'
setMessageLocale(dir === 'rtl' ? 'fa' : 'en')
if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark'

/*
 * A fresh document per case, named from the query string.
 *
 * `createCollabSession` keeps a copy in IndexedDB unless it is told not to, and IndexedDB survives
 * a reload — so without this every case in a run appends to the one the case before it left behind,
 * which looks exactly like a suggestion trigger misfiring.
 */
const doc = params.get('doc') ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const people = [
  { id: 'u2', label: 'Ada Lovelace' },
  { id: 'u3', label: 'Alan Turing' },
]
</script>

<CollaborativeEditor
  {url}
  name="ws:test:quire:page:{doc}"
  user={{ id: 'u1', name: 'Test' }}
  page
  placeholder="Write something"
  mentionSource={(q) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()))}
/>
