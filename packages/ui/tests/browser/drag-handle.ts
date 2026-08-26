import { mount } from 'svelte'
import '../../src/lib/styles/index.css'
import DragHandle from './DragHandle.svelte'

mount(DragHandle, { target: document.getElementById('app') as HTMLElement })
