import { describe, it, expect } from 'vitest'
import { prepareExport, prepareImport } from '../src/combineSubkeyPreprocessor.js'

describe('combineSubkeyPreprocessor', () => {
  it('prepareExport combines non-matching plural keys', () => {
    // key_one and key_other only in ref, not in trg
    const ref = { key_one: 'one', key_other: 'other' }
    const trg = { }
    const { ref: refOut, trg: trgOut } = prepareExport(ref, trg)
    // Should combine into a single key with __#locize.com/combinedSubkey in refOut
    expect(Object.keys(refOut).some(k => k.includes('__#locize.com/combinedSubkey'))).toBe(true)
    // trgOut should remain empty
    expect(Object.keys(trgOut).length).toBe(0)
  })
  it('prepareImport splits combined keys', () => {
    const combined = {
      'key__#locize.com/combinedSubkey': '{one}: uno\n{other}: otro\n'
    }
    const out = prepareImport({ ...combined })
    expect(out).toHaveProperty('key_one', 'uno')
    expect(out).toHaveProperty('key_other', 'otro')
  })
})
