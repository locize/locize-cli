import { describe, it, expect } from 'vitest'
import convertToDesiredFormat from '../src/convertToDesiredFormat.js'

// Only test a simple JSON conversion, no fetch or fs needed

describe('convertToDesiredFormat', () => {
  it('converts flat JSON to pretty JSON string', async () => {
    const opt = { format: 'json' }
    const namespace = 'common'
    const lng = 'en'
    const data = { 'hello.world': 'test', foo: 'bar' }
    const result = await convertToDesiredFormat(opt, namespace, lng, data)
    expect(result).toBe(
      `{
  "hello": {
    "world": "test"
  },
  "foo": "bar"
}`
    )
  })
})
