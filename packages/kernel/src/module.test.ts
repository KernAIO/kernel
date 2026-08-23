/**
 * The boot-time compatibility gate.
 *
 * Kern releases every service and every module under one version, so `minKernel` is not there for
 * first-party builds — it is there for a custom build that mixed a module package with images it
 * was not written for. Without the gate that mismatch surfaces much later, as a missing procedure
 * or a column that is not there, and reads like a bug in the module rather than a version problem.
 */
import { describe, expect, it } from 'vitest'
import { assertModulesSatisfyKernel, DEV_VERSION, defineModule, defineServerModule } from './module.js'

const mod = (id: string, minKernel?: string) =>
  defineServerModule({ definition: defineModule({ id, name: id, version: '1.0.0', minKernel }) })

describe('assertModulesSatisfyKernel', () => {
  it('passes when no module asks for anything', () => {
    expect(() => assertModulesSatisfyKernel([mod('a'), mod('b')], '1.4.0')).not.toThrow()
  })

  it('passes when the running version satisfies every range', () => {
    expect(() => assertModulesSatisfyKernel([mod('a', '>=1.2.0'), mod('b', '^1.0.0')], '1.4.0')).not.toThrow()
  })

  it('names the module, the requirement and the running version when it does not', () => {
    expect(() => assertModulesSatisfyKernel([mod('tracker', '>=2.0.0')], '1.4.0')).toThrow(
      /1\.4\.0.*tracker requires Kern >=2\.0\.0/s,
    )
  })

  it('reports every unsatisfied module at once, not just the first', () => {
    const err = (() => {
      try {
        assertModulesSatisfyKernel([mod('tracker', '>=2.0.0'), mod('chat', '>=3.0.0')], '1.4.0')
      } catch (e) {
        return (e as Error).message
      }
    })()
    expect(err).toContain('tracker')
    expect(err).toContain('chat')
  })

  it('counts a release candidate as its version rather than excluding it', () => {
    expect(() => assertModulesSatisfyKernel([mod('a', '>=1.2.0')], '1.4.0-rc.1')).not.toThrow()
  })

  it('skips the check on an unreleased build, so local development still boots', () => {
    expect(() => assertModulesSatisfyKernel([mod('a', '>=99.0.0')], DEV_VERSION)).not.toThrow()
  })
})
