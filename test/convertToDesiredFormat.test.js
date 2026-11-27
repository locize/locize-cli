import { describe, it, expect, vi } from 'vitest'
import yaml from 'yaml'
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

  it.each(['json', 'nested'])('warns about conflicting paths and trailing dots in %s without changing output', async (format) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { 'button.tooltip': 'Tooltip', button: 'Button', 'Saved.': 'Saved', 'Loading...': 'Loading' }
      const result = await convertToDesiredFormat({ format }, 'common', 'en', data)
      expect(JSON.parse(result)).toEqual({ button: { tooltip: 'Tooltip' }, Saved: [], Loading: [] })
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('namespace "common"')
      expect(warn.mock.calls[0][0]).toContain('keys "button" and "button.tooltip" conflict')
      expect(warn.mock.calls[0][0]).toContain('key "Saved." ends with a dot')
      expect(warn.mock.calls[0][0]).toContain('key "Loading..." ends with a dot')
      expect(warn.mock.calls[0][0]).toContain('Values may be lost')
      expect(warn.mock.calls[0][0]).toContain('--format flat')
    } finally {
      warn.mockRestore()
    }
  })

  it('warns about ".." inside a key, which unflatten turns into a dropped array index', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { 'errors..required': 'Required', 'Loading...please wait': 'Loading', '.leading': 'Kept' }
      const nested = await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', data)
      expect(JSON.parse(nested)).toEqual({ errors: [], Loading: [], '': { leading: 'Kept' } })
      expect(warn.mock.calls[0][0]).toContain('key "errors..required" contains ".."')
      expect(warn.mock.calls[0][0]).toContain('key "Loading...please wait" contains ".."')
      expect(warn.mock.calls[0][0]).not.toContain('.leading')
      warn.mockClear()

      // json keeps a key with a space whole, so only the dotted path loses its value
      const json = await convertToDesiredFormat({ format: 'json' }, 'common', 'en', data)
      expect(JSON.parse(json)).toEqual({ errors: [], 'Loading...please wait': 'Loading', '': { leading: 'Kept' } })
      expect(warn.mock.calls[0][0]).toContain('key "errors..required" contains ".."')
      expect(warn.mock.calls[0][0]).not.toContain('Loading')
    } finally {
      warn.mockRestore()
    }
  })

  it('reports an issue once per namespace in one run, not again for every language', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const opt = { format: 'nested' }
      await convertToDesiredFormat(opt, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      await convertToDesiredFormat(opt, 'common', 'de', { button: 'Knopf', 'button.tooltip': 'Hinweis' })
      expect(warn).toHaveBeenCalledOnce()
      await convertToDesiredFormat(opt, 'common', 'fr', { button: 'Bouton', 'button.tooltip': 'Info', 'Saved.': 'Enregistré' })
      await convertToDesiredFormat(opt, 'other', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      expect(warn).toHaveBeenCalledTimes(3)
      expect(warn.mock.calls[1][0]).toContain('key "Saved." ends with a dot')
      expect(warn.mock.calls[1][0]).not.toContain('button')
      expect(warn.mock.calls[2][0]).toContain('namespace "other"')
      warn.mockClear()

      // a new run (another opt) reports again
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { button: 'Button', 'button.tooltip': 'Tooltip' })
      expect(warn).toHaveBeenCalledOnce()
    } finally {
      warn.mockRestore()
    }
  })

  it('lists at most ten issues in one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`Step ${i + 1}.`, 'x']))
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', data)
      expect(warn.mock.calls[0][0]).toContain('key "Step 10." ends with a dot')
      expect(warn.mock.calls[0][0]).not.toContain('Step 11.')
      expect(warn.mock.calls[0][0]).toContain('; and 2 more.')
    } finally {
      warn.mockRestore()
    }
  })

  it('respects natural keys in json and does not warn for flat exports', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const data = { 'Saved successfully.': 'Saved', button: 'Button', 'button.tooltip': 'Tooltip' }
      await convertToDesiredFormat({ format: 'json' }, 'common', 'en', { 'Saved successfully.': 'Saved' })
      await convertToDesiredFormat({ format: 'flat' }, 'common', 'en', data)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('detects parent-first conflicts and leaves ordinary paths alone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'de', { button: 'Button', 'button.tooltip': 'Tooltip', 'menu.title': 'Title' })
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('keys "button" and "button.tooltip" conflict')
      expect(warn.mock.calls[0][0]).not.toContain('menu.title')
      warn.mockClear()
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'de', { 'menu.title': 'Title', 'menu.close': 'Close' })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('treats a natural key with a trailing dot as a path in nested format', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await convertToDesiredFormat({ format: 'nested' }, 'common', 'en', { 'Saved successfully.': 'Saved' })
      expect(warn.mock.calls[0][0]).toContain('key "Saved successfully." ends with a dot')
    } finally {
      warn.mockRestore()
    }
  })

  it.each(['yaml-nested', 'yml-nested', 'yaml-rails', 'yml-rails', 'yaml-rails-ns', 'yml-rails-ns'])('warns accurately about key issues in %s', async (format) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unwrap = (result) => {
      const parsed = yaml.parse(result)
      if (format.endsWith('-rails-ns')) return parsed.en.common
      if (format.endsWith('-rails')) return parsed.en
      return parsed
    }
    try {
      const conflicting = { button: 'Button', 'button.tooltip': 'Tooltip', 'Saved.': 'Saved' }
      const flatResult = await convertToDesiredFormat({ format }, 'common', 'en', conflicting)
      expect(unwrap(flatResult)).toEqual(conflicting)
      expect(warn.mock.calls[0][0]).toContain('keys "button" and "button.tooltip" conflict')
      expect(warn.mock.calls[0][0]).toContain('Keys are kept flat')
      expect(warn.mock.calls[0][0]).not.toContain('Values may be lost')
      expect(warn.mock.calls[0][0]).not.toContain('Saved.')
      warn.mockClear()

      const result = await convertToDesiredFormat({ format }, 'common', 'en', { a: 'Parent', 'a.b.c': 'Child', 'Saved.': 'Saved' })
      expect(unwrap(result)).toEqual({ a: 'Parent', Saved: [] })
      expect(warn.mock.calls[0][0]).toContain('keys "a" and "a.b.c" conflict')
      expect(warn.mock.calls[0][0]).toContain('key "Saved." ends with a dot')
      expect(warn.mock.calls[0][0]).toContain('Values may be lost')
      expect(warn.mock.calls[0][0]).toContain('--format yaml')
      warn.mockClear()

      await convertToDesiredFormat({ format }, 'common', 'en', { 'Saved successfully.': 'Saved', 'menu.title': 'Title' })
      await convertToDesiredFormat({ format }, 'common', 'en', { 'menu.title': 'Title' })
      expect(warn).not.toHaveBeenCalled()
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
