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

  it('should parse fluent messages with attributes only and term arguments', async () => {
    const ftl = [
      'login-input =',
      '    .placeholder = email@example.com',
      'hint = Type { login-input.placeholder } into { -brand(case: "accusative") }',
      'answer = { NUMBER(42, minimumFractionDigits: 2) }',
      ''
    ].join('\n')
    const result = await convertToFlatFormat({ format: 'fluent' }, Buffer.from(ftl), 'en')
    expect(result).toEqual({
      'login-input.placeholder': 'email@example.com',
      hint: 'Type { login-input.placeholder } into { -brand(case: "accusative") }',
      answer: '{ NUMBER(42, minimumFractionDigits: 2) }'
    })
  })

  // gettext tells entries apart by (msgctxt, msgid): the key joins both with U+0004, so
  // "Open" in a menu and "Open" for a door no longer merge into one key
  it('keeps .po entries that differ only by their msgctxt apart, as plain values', async () => {
    const po = Buffer.from([
      'msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '',
      'msgctxt "menu"', 'msgid "Open"', 'msgstr "Öffnen"', '',
      'msgid "Open"', 'msgstr "Öffnen (ohne)"', '',
      'msgctxt "door state"', 'msgid "Open"', 'msgstr "Offen"', ''
    ].join('\n'))
    const result = await convertToFlatFormat({ format: 'po' }, po)
    // plain strings: only sync adds the msgctxt as context (to keys it creates), migrate sends none
    expect(result).toEqual({ Open: 'Öffnen (ohne)', 'Open\u0004menu': 'Öffnen', 'Open\u0004door state': 'Offen' })
  })
})
