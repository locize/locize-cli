import { describe, it, expect } from 'vitest'
import convertToDesiredFormat from '../src/convertToDesiredFormat.js'
import convertToFlatFormat from '../src/convertToFlatFormat.js'

describe('xlsx format (vendored SheetJS)', () => {
  it('roundtrips flat resources through an xlsx workbook', async () => {
    const opt = {
      format: 'xlsx',
      referenceLanguage: 'en',
      getNamespace: async () => ({ 'a.b': 'Hello', c: 'World' })
    }
    const buf = await convertToDesiredFormat(opt, 'common', 'de', { 'a.b': 'Hallo', c: 'Welt' })
    expect(Buffer.isBuffer(buf)).toBe(true)

    const back = await convertToFlatFormat({ format: 'xlsx', referenceLanguage: 'de' }, buf)
    expect(back).toEqual({ 'a.b': 'Hallo', c: 'Welt' })
  })
})
