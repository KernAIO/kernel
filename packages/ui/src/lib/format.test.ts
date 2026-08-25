import { describe, expect, it } from 'vitest'
import { formatBytes } from './format.js'

describe('formatBytes', () => {
  it('uses 1024 so it agrees with the operating system', () => {
    expect(formatBytes(1024, 'en')).toBe('1 KB')
    expect(formatBytes(1024 * 1024, 'en')).toBe('1 MB')
  })

  it('keeps one decimal below ten and none above', () => {
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatBytes(1024 * 15, 'en')).toBe('15 KB')
  })

  it('shows whole bytes', () => {
    expect(formatBytes(512, 'en')).toBe('512 B')
  })

  it('answers for nothing and for nonsense rather than throwing', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })
})
