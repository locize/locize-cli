import { describe, it, expect } from 'vitest'
import convertToFlatFormat from '../src/convertToFlatFormat.js'

const jsonOpt = { format: 'json' }

describe('convertToFlatFormat', () => {
  it('should flatten a simple JSON object', async () => {
    const data = Buffer.from('{"a": {"b": 1}}')
    const result = await convertToFlatFormat(jsonOpt, data)
    expect(result).toEqual({ 'a.b': 1 })
  })

  it('should throw on invalid JSON', async () => {
    const data = Buffer.from('not json')
    await expect(convertToFlatFormat(jsonOpt, data)).rejects.toThrow()
  })
})
