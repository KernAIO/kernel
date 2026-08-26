import { mount } from 'svelte'
import '../../src/lib/styles/index.css'
// the page surface wears `.kern-prose`, and the point of a block menu is what the block looks like
import '../../src/lib/styles/prose.css'
import PageEditor from './PageEditor.svelte'

mount(PageEditor, { target: document.getElementById('app') as HTMLElement })
