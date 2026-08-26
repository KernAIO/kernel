<script lang="ts">
/**
 * A page editor with nothing to connect to.
 *
 * That is the case worth pinning: the drag-handle plugin only takes the grip over when the editor
 * is created, which is after the highlighting grammars have been fetched, so between first paint
 * and that moment the grip is on screen with nobody positioning it. It has to be invisible for
 * the whole of that window, however long the window is.
 */
import CollaborativeEditor from '../../src/lib/editor/CollaborativeEditor.svelte'

// Port 9 is discard: the socket is refused immediately rather than hanging.
const url = 'ws://127.0.0.1:9/collab'
</script>

<CollaborativeEditor
  {url}
  name="ws:test:quire:page:1"
  user={{ id: 'u1', name: 'Test' }}
  page
  placeholder="Write something"
/>
