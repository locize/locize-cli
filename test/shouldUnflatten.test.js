import { describe, it, expect } from 'vitest'
import shouldUnflatten from '../src/shouldUnflatten.js'

describe('shouldUnflatten', () => {
  it('returns true for flat keys', () => {
    expect(shouldUnflatten({ 'a.b': 1, 'c.d': 2 })).toBe(true)
  })
  it('returns false if a key contains space', () => {
    expect(shouldUnflatten({ 'a b': 1, 'c.d': 2 })).toBe(false)
  })
  it('returns false if a key contains comma', () => {
    expect(shouldUnflatten({ 'a,b': 1, 'c.d': 2 })).toBe(false)
  })
  it('returns false if a key contains question mark', () => {
    expect(shouldUnflatten({ 'a?b': 1, 'c.d': 2 })).toBe(false)
  })
  it('returns false if a parent key exists for a dotted key', () => {
    expect(shouldUnflatten({ a: 1, 'a.b': 2 })).toBe(false)
  })
})
