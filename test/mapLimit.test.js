import { describe, it, expect } from 'vitest'
import mapLimit from '../src/mapLimit.js'

describe('mapLimit', () => {
  it('maps array with concurrency limit', async () => {
    const arr = [1, 2, 3, 4, 5]
    const results = await mapLimit(arr, 2, async (x) => x * 2)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })
  it('handles empty array', async () => {
    const results = await mapLimit([], 2, async (x) => x * 2)
    expect(results).toEqual([])
  })
})
