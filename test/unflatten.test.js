import { describe, it, expect } from 'vitest'
import unflatten from '../src/unflatten.js'

describe('unflatten', () => {
  it('unflattens a simple object', () => {
    const flat = { 'a.b': 1, 'a.c': 2 }
    const result = unflatten(flat)
    expect(result).toEqual({ a: { b: 1, c: 2 } })
  })
  it('handles arrays if keys are numeric', () => {
    const flat = { 'arr.0': 'a', 'arr.1': 'b' }
    const result = unflatten(flat)
    expect(result).toEqual({ arr: ['a', 'b'] })
  })
  it('returns empty object for empty input', () => {
    expect(unflatten({})).toEqual({})
  })
})
