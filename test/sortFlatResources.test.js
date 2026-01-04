import { describe, it, expect } from 'vitest'
import sortFlatResources from '../src/sortFlatResources.js'

describe('sortFlatResources', () => {
  it('sorts object keys alphabetically', () => {
    const input = { b: 2, a: 1, c: 3 }
    const sorted = sortFlatResources(input)
    expect(Object.keys(sorted)).toEqual(['a', 'b', 'c'])
    expect(sorted).toEqual({ a: 1, b: 2, c: 3 })
  })
  it('returns empty object if input is empty', () => {
    expect(sortFlatResources({})).toEqual({})
  })
})
