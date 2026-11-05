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
  // 2026-11-05: a key with a reserved segment wrote onto Object.prototype
  it('skips keys with a __proto__ segment or a constructor.prototype pair, keeps the rest', () => {
    const res = unflatten({
      'a.__proto__.pollutedOne': 'polluted',
      '__proto__.pollutedTwo': 'polluted',
      'constructor.prototype.pollutedThree': 'polluted',
      'a.constructor.prototype.pollutedFour': 'polluted',
      'a.b': 'kept',
      'Array.prototype.map': 'kept too'
    }, true)
    for (const name of ['pollutedOne', 'pollutedTwo', 'pollutedThree', 'pollutedFour']) expect(({})[name]).toBeUndefined()
    expect(res.a.b).toBe('kept')
    expect(res.Array.prototype.map).toBe('kept too')
    expect(Object.keys(res).sort()).toEqual(['Array', 'a'])
  })
  it('keeps a key it does not split (a space) even when it names __proto__', () => {
    expect(unflatten({ 'Never write obj.__proto__ here': 'v' }, true)['Never write obj.__proto__ here']).toBe('v')
  })
})
