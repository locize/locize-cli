import { describe, it, expect } from 'vitest'
import removeUndefinedFromArrays from '../src/removeUndefinedFromArrays.js'

// This module does not use fetch or filesystem, but we test realistic scenarios

describe('removeUndefinedFromArrays', () => {
  it('removes leading undefined from arrays in object properties', () => {
    const obj = { arr: [undefined, 'a', 'b'], nested: { arr2: [undefined, 1, 2] } }
    const result = removeUndefinedFromArrays(JSON.parse(JSON.stringify(obj)))
    expect(result.arr).toEqual([null, 'a', 'b'])
    expect(result.nested.arr2).toEqual([null, 1, 2])
  })

  it('does not remove non-leading undefined or non-array properties', () => {
    const obj = { arr: ['a', undefined, 'b'], notArr: 'x', nested: { arr2: [1, undefined, 2] } }
    const result = removeUndefinedFromArrays(JSON.parse(JSON.stringify(obj)))
    expect(result.arr).toEqual(['a', null, 'b'])
    expect(result.nested.arr2).toEqual([1, null, 2])
    expect(result.notArr).toBe('x')
  })

  it('returns the same object if nothing to remove', () => {
    const obj = { arr: ['a', 'b'], nested: { arr2: [1, 2] } }
    const result = removeUndefinedFromArrays(JSON.parse(JSON.stringify(obj)))
    expect(result).toEqual(obj)
  })

  it('handles null and undefined input gracefully', () => {
    expect(removeUndefinedFromArrays(null)).toBe(null)
    expect(removeUndefinedFromArrays(undefined)).toBe(undefined)
  })

  it('removes undefined from the start of arrays', () => {
    const obj = { arr: [undefined, 1, 2], nested: { arr: [undefined, 3, 4] } }
    const cleaned = removeUndefinedFromArrays(obj)
    expect(cleaned.arr).toEqual([1, 2])
    expect(cleaned.nested.arr).toEqual([3, 4])
  })
  it('does not change arrays without leading undefined', () => {
    const obj = { arr: [1, 2], nested: { arr: [3, 4] } }
    const cleaned = removeUndefinedFromArrays(obj)
    expect(cleaned.arr).toEqual([1, 2])
    expect(cleaned.nested.arr).toEqual([3, 4])
  })
  it('returns the same object if input is falsy', () => {
    expect(removeUndefinedFromArrays(null)).toBe(null)
    expect(removeUndefinedFromArrays(undefined)).toBe(undefined)
  })
})
