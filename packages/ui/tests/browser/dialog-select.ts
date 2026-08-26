import { mount } from 'svelte'
import '../../src/lib/styles/index.css'
import DialogSelect from './DialogSelect.svelte'

mount(DialogSelect, { target: document.getElementById('app') as HTMLElement })
