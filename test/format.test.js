import { describe, it, expect } from 'vitest'
import format from '../src/format.js'

describe('format', () => {
  it('throws if format is invalid', async () => {
    await expect(format({ format: 'not-a-real-format', fileOrDirectory: __filename })).rejects.toThrow('not-a-real-format is not a valid format!')
  })
})
