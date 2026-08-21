import { ANONYMOUS, type Principal } from '@kernalo/contracts'
import { InMemoryEventBus } from './events/bus.js'
export { InMemoryEventBus }
export const testPrincipal = (over: Partial<Principal> = {}): Principal => ({ ...ANONYMOUS, kind: 'user', userId: '01920000-0000-7000-8000-000000000001' as Principal['userId'], email: 'test@kern.dev', name: 'Test', ...over })
