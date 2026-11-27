import { describe, it, expect, vi } from 'vitest'
import yaml from 'yaml'
import colors from 'colors'
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

  const warnings = (warn) => warn.mock.calls.map(([message]) => colors.strip(message))

  it.each(['json', 'nested'])('warns about the keys %s loses, without changing the output', async (format) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { button: 'Button', 'button.tooltip': 'Tooltip', 'Saved.': 'Saved', 'errors..required': 'Required', 'offset.-1': 'Offset', 'size.1e3': 'Size', 'menu.title': 'Title' }
      const result = await convertToDesiredFormat({ format }, 'common', 'en', data)
      expect(JSON.parse(result)).toEqual({ button: 'Button', Saved: [], errors: [], offset: [], size: [], menu: { title: 'Title' } })
      expect(warnings(warn)).toEqual([
        `Warning: the ${format} export of namespace "common" loses 5 keys: "button.tooltip" (below "button"), "Saved.", "errors..required", "offset.-1", "size.1e3". Use --format flat to keep them.`
      ])
    } finally {
      warn.mockRestore()
    }
  })

  it('keeps natural-language keys whole in json only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { 'Saved successfully.': 'Saved', 'Loading...please wait': 'Loading', 'step. 1': 'Step' }
      expect(JSON.parse(await convertToDesiredFormat({ format: 'json' }, 'common', 'en', data))).toEqual(data)
      expect(warn).not.toHaveBeenCalled()
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', data)
      expect(warnings(warn)).toEqual([
        'Warning: the nested export of namespace "common" loses 3 keys: "Saved successfully.", "Loading...please wait", "step. 1". Use --format flat to keep them.'
      ])
    } finally {
      warn.mockRestore()
    }
  })

  it('does not warn when every value survives', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // a trailing-dot key below a string value keeps its dot once the key has three segments
      const kept = await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { 'msg.Saved': 'Saved', 'msg.Saved.': 'Saved dot' })
      expect(JSON.parse(kept)).toEqual({ msg: { Saved: 'Saved', 'Saved.': 'Saved dot' } })
      // unflatten throws on this mix, so the namespace stays flat
      const flat = await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { a: 'A', 'a.b.c.d.': 'X' })
      expect(JSON.parse(flat)).toEqual({ a: 'A', 'a.b.c.d.': 'X' })
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { 'menu.title': 'T', 'menu.close': 'C', 'list.0': 'a', '.leading': 'L' })
      // `flat` keeps an empty object or array in the input as a value
      const empty = await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { group: {}, list: [], title: 'T' })
      expect(JSON.parse(empty)).toEqual({ group: {}, list: [], title: 'T' })
      await convertToDesiredFormat({ format: 'flat' }, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip', 'Saved.': 'Saved' })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('reports a key once per namespace in one run, not again for every language', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const opt = { format: 'nested' }
      await convertToDesiredFormat(opt, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      await convertToDesiredFormat(opt, 'common', 'de', { button: 'Knopf', 'button.tooltip': 'Hinweis' })
      expect(warn).toHaveBeenCalledOnce()
      await convertToDesiredFormat(opt, 'common', 'fr', { button: 'Bouton', 'button.tooltip': 'Info', 'Saved.': 'Enregistré' })
      await convertToDesiredFormat(opt, 'other', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      expect(warnings(warn).slice(1)).toEqual([
        'Warning: the nested export of namespace "common" loses 1 key: "Saved.". Use --format flat to keep it.',
        'Warning: the nested export of namespace "other" loses 1 key: "button.tooltip" (below "button"). Use --format flat to keep it.'
      ])
      warn.mockClear()

      // a new run (another opt) reports again
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      expect(warn).toHaveBeenCalledOnce()
    } finally {
      warn.mockRestore()
    }
  })

  it('lists at most ten keys in one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`Step ${i + 1}.`, 'x']))
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', data)
      expect(warnings(warn)[0]).toContain('loses 12 keys: "Step 1."')
      expect(warnings(warn)[0]).toContain('"Step 10.", and 2 more. Use --format flat')
      expect(warnings(warn)[0]).not.toContain('Step 11.')
    } finally {
      warn.mockRestore()
    }
  })

  it.each(['yaml-nested', 'yml-nested', 'yaml-rails', 'yml-rails', 'yaml-rails-ns', 'yml-rails-ns'])('warns about the keys %s loses and points to its flat format', async (format) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unwrap = (result) => {
      const parsed = yaml.parse(result)
      if (format.endsWith('-rails-ns')) return parsed.en.common
      if (format.endsWith('-rails')) return parsed.en
      return parsed
    }
    try {
      // a direct parent keeps the namespace flat, nothing is lost
      const conflicting = { button: 'Button', 'button.tooltip': 'Tooltip', 'Saved.': 'Saved' }
      expect(unwrap(await convertToDesiredFormat({ format }, 'common', 'en', conflicting))).toEqual(conflicting)
      expect(warn).not.toHaveBeenCalled()

      const result = await convertToDesiredFormat({ format }, 'common', 'en', { a: 'Parent', 'a.b.c': 'Child', 'Saved.': 'Saved' })
      expect(unwrap(result)).toEqual({ a: 'Parent', Saved: [] })
      expect(warnings(warn)).toEqual([
        `Warning: the ${format} export of namespace "common" loses 2 keys: "a.b.c" (below "a"), "Saved.". Use --format ${format.split('-')[0]} to keep them.`
      ])
    } finally {
      warn.mockRestore()
    }
  })

  it.each(['yaml', 'yml'])('keeps problematic keys without warnings in flat %s', async (format) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { a: 'Parent', 'a.b.c': 'Child', 'Saved.': 'Saved' }
      const result = await convertToDesiredFormat({ format }, 'common', 'en', data)
      expect(yaml.parse(result)).toEqual(data)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('does not warn laravel about keys it writes as PHP array keys', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await convertToDesiredFormat({ format: 'laravel' }, 'common', 'en', { 'offset.-1': 'Offset', 'Saved.': 'Saved' })
      expect(result).toContain("'-1' => 'Offset'")
      expect(result).toContain("'' => 'Saved'")
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it.each([['laravel', "'button' => 'Button'"], ['fluent', 'button = Button']])('warns about the keys %s loses and asks to rename them', async (format, kept) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await convertToDesiredFormat({ format }, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      expect(result).toContain(kept)
      expect(result).not.toContain('Tooltip')
      expect(warnings(warn)).toEqual([
        `Warning: the ${format} export of namespace "common" loses 1 key: "button.tooltip" (below "button"). Rename it to keep it.`
      ])
    } finally {
      warn.mockRestore()
    }
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

  it('leaves empty values out of a fluent export', async () => {
    const data = { title: 'Title', empty: '', missing: null }
    const result = await convertToDesiredFormat({ format: 'fluent' }, 'common', 'en', data)
    expect(result).toBe('title = Title\n\n')
  })

  it('exports a fluent message with attributes only', async () => {
    const data = { 'login-input.val': '', 'login-input.placeholder': 'email@example.com' }
    const result = await convertToDesiredFormat({ format: 'fluent' }, 'common', 'en', data)
    expect(result).toBe('login-input =\n  .placeholder = email@example.com\n\n')
  })

  it('writes a key with U+0004 back as msgctxt in .po', async () => {
    const result = await convertToDesiredFormat({ format: 'po' }, 'common', 'de', { Open: 'Öffnen (ohne)', 'Open\u0004menu': 'Öffnen' })
    expect(result).toContain('msgctxt "menu"\nmsgid "Open"\nmsgstr "Öffnen"')
    expect(result).toContain('msgid "Open"\nmsgstr "Öffnen (ohne)"')
    expect(result).not.toContain('\u0004')
  })
})
