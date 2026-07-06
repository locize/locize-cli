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

  it('restores inline-element tokens as real elements in xliff 1.2 exports', async () => {
    const opt = {
      format: 'xliff12',
      referenceLanguage: 'en',
      getNamespace: async () => ({ welcome: 'Welcome (<x id="INTERPOLATION" equiv-text="{{ count }}"/>)' })
    }
    const data = { welcome: 'Willkommen (<x id="INTERPOLATION" equiv-text="{{ count }}"/>)' }
    const result = await convertToDesiredFormat(opt, 'ng2.template', 'de', data)
    expect(result).toContain('<x id="INTERPOLATION" equiv-text="{{ count }}"/>')
    expect(result).not.toContain('&lt;x')
  })

  it('exports xliff 2.1 and 2.2 with the matching version attribute', async () => {
    const opt = {
      referenceLanguage: 'en',
      getNamespace: async () => ({ welcome: 'Welcome' })
    }
    const data = { welcome: 'Willkommen' }
    const res21 = await convertToDesiredFormat({ ...opt, format: 'xliff21' }, 'ns', 'de', data)
    expect(res21).toContain('version="2.1"')
    const res22 = await convertToDesiredFormat({ ...opt, format: 'xlf22' }, 'ns', 'de', data)
    expect(res22).toContain('version="2.2"')
    const res20 = await convertToDesiredFormat({ ...opt, format: 'xliff2' }, 'ns', 'de', data)
    expect(res20).toContain('version="2.0"')
  })
})
