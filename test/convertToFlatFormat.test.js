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

  it('should flatten xliff 1.2 inline elements (Angular) to token strings', async () => {
    const xlf = `<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">
  <file original="ng2.template" datatype="html" source-language="en" target-language="de">
    <body>
      <trans-unit id="welcome" datatype="html">
        <source>Welcome (<x id="INTERPOLATION" equiv-text="{{ count }}"/>)</source>
        <target>Willkommen (<x id="INTERPOLATION" equiv-text="{{ count }}"/>)</target>
      </trans-unit>
    </body>
  </file>
</xliff>`
    const result = await convertToFlatFormat({ format: 'xliff12', referenceLanguage: 'en' }, Buffer.from(xlf), 'de')
    expect(result).toEqual({ welcome: 'Willkommen (<x id="INTERPOLATION" equiv-text="{{ count }}"/>)' })
  })

  it('should parse xliff 2.2 files via the xliff22 format', async () => {
    const xlf = `<xliff xmlns="urn:oasis:names:tc:xliff:document:2.2" version="2.2" srcLang="en" trgLang="de">
  <file id="translations">
    <unit id="welcome">
      <segment>
        <source>Welcome <ph id="INTERPOLATION" equiv-text="{{ count }}"/></source>
        <target>Willkommen <ph id="INTERPOLATION" equiv-text="{{ count }}"/></target>
      </segment>
    </unit>
  </file>
</xliff>`
    const result = await convertToFlatFormat({ format: 'xliff22', referenceLanguage: 'en' }, Buffer.from(xlf), 'de')
    expect(result).toEqual({ welcome: 'Willkommen <ph id="INTERPOLATION" equiv-text="{{ count }}"/>' })
  })
})
