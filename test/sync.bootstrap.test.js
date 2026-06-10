// sync.bootstrap.test.js — sync creates missing remote languages on the fly
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator } from './helpers/fetchSimulator.js'

const jsonResponse = (json, status = 200, contentType = 'application/json') => ({
  status,
  headers: {
    get: (name) => (name.toLowerCase() === 'content-type' ? contentType : undefined)
  },
  json: async () => json,
  statusText: status === 200 ? 'OK' : 'ERROR'
})

describe('sync language bootstrap (fetch-only mock, temp dir)', () => {
  let sync
  let tempDir
  let origFetch
  let exitSpy

  const writeLocalFiles = (languages) => {
    for (const lng of languages) {
      fs.mkdirSync(path.join(tempDir, lng), { recursive: true })
      fs.writeFileSync(path.join(tempDir, lng, 'common.json'), JSON.stringify({ hello: lng === 'en' ? 'world' : '' }))
    }
  }

  const baseOpt = () => ({
    apiEndpoint: 'http://api',
    projectId: 'pid',
    version: 'v1',
    apiKey: 'key',
    path: tempDir,
    format: 'json',
    pathMask: '{{language}}/{{namespace}}',
    pathMaskInterpolationPrefix: '{{',
    pathMaskInterpolationSuffix: '}}',
    skipEmpty: false
  })

  beforeEach(async () => {
    origFetch = global.fetch
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-sync-bootstrap-'))
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined)
    // Force ALL internal delays (languages-file regeneration retry, post-update
    // wait) to resolve immediately — same pattern as sync.test.js.
    vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn()
      return 0
    })

    const mod = await import('../src/sync.js')
    sync = mod.default
  })

  afterEach(() => {
    if (origFetch) global.fetch = origFetch
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
  })

  afterAll(() => {
    setTimeout(() => process.exit(0), 100)
  })

  it('creates the local languages when the project has none yet, then syncs', async () => {
    writeLocalFiles(['en', 'de'])
    const added = []
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async (url) => {
          added.push(url.split('/').pop())
          return jsonResponse({})
        }
      },
      {
        // empty until both languages were created, then a normal languages file
        match: (url) => url.includes('/languages/'),
        response: async () => jsonResponse(added.length >= 2 ? { en: { isReferenceLanguage: true }, de: {} } : {})
      },
      { match: (url) => url.includes('/stats/project/'), response: async () => jsonResponse({ v1: { en: { common: { segmentsTranslated: 1, segmentsTotal: 1 } }, de: { common: { segmentsTranslated: 0, segmentsTotal: 1 } } } }) },
      { match: (url) => url.includes('/download/'), response: async () => jsonResponse([]) },
      { match: (url) => url.includes('/missing/') || url.includes('/update/'), response: async () => jsonResponse({}) },
      { match: (url) => url.includes('/pid/v1/'), response: async () => jsonResponse({}) }
    ])

    await expect(sync(baseOpt())).resolves.toBeUndefined()
    expect(added.sort()).toEqual(['de', 'en'])
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('fails with guidance instead of creating languages when no api-key is set', async () => {
    writeLocalFiles(['en'])
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const added = []
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async () => { added.push(1); return jsonResponse({}) }
      },
      { match: (url) => url.includes('/languages/'), response: async () => jsonResponse({}) }
    ])

    const opt = baseOpt()
    delete opt.apiKey
    await sync(opt)
    expect(added).toHaveLength(0)
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy.mock.calls.join('\n')).toContain('no languages yet')
  })

  it('does not create languages on a dry run', async () => {
    writeLocalFiles(['en'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const added = []
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async () => { added.push(1); return jsonResponse({}) }
      },
      { match: (url) => url.includes('/languages/'), response: async () => jsonResponse({}) }
    ])

    const opt = baseOpt()
    opt.dry = true
    await sync(opt)
    expect(added).toHaveLength(0)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('explains the role requirement when language creation is rejected on an empty project', async () => {
    writeLocalFiles(['en', 'de'])
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async () => jsonResponse({ message: 'Unauthorized: not authorized with role (readonly)' }, 401)
      },
      { match: (url) => url.includes('/languages/'), response: async () => jsonResponse({}) }
    ])

    await sync(baseOpt())
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy.mock.calls.join('\n')).toContain('may not create them')
  })

  it('creates a locally added language on an already prepared project', async () => {
    writeLocalFiles(['en', 'de'])
    const added = []
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async (url) => {
          added.push(url.split('/').pop())
          return jsonResponse({})
        }
      },
      { match: (url) => url.includes('/languages/'), response: async () => jsonResponse({ en: { isReferenceLanguage: true } }) },
      { match: (url) => url.includes('/stats/project/'), response: async () => jsonResponse({ v1: { en: { common: { segmentsTranslated: 1, segmentsTotal: 1 } }, de: { common: { segmentsTranslated: 0, segmentsTotal: 1 } } } }) },
      { match: (url) => url.includes('/download/'), response: async () => jsonResponse([]) },
      { match: (url) => url.includes('/missing/') || url.includes('/update/'), response: async () => jsonResponse({}) },
      { match: (url) => url.includes('/pid/v1/'), response: async () => jsonResponse({}) }
    ])

    await expect(sync(baseOpt())).resolves.toBeUndefined()
    expect(added).toEqual(['de'])
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('warns and continues when creating an extra language is rejected on a prepared project', async () => {
    writeLocalFiles(['en', 'de'])
    const logSpy = vi.spyOn(console, 'log')
    global.fetch = createFetchSimulator([
      {
        match: (url, options) => url.includes('/language/') && (options.method || '').toLowerCase() === 'post',
        response: async () => jsonResponse({ message: 'Unauthorized: project already has content' }, 401)
      },
      { match: (url) => url.includes('/languages/'), response: async () => jsonResponse({ en: { isReferenceLanguage: true } }) },
      { match: (url) => url.includes('/stats/project/'), response: async () => jsonResponse({ v1: { en: { common: { segmentsTranslated: 1, segmentsTotal: 1 } }, de: { common: { segmentsTranslated: 0, segmentsTotal: 1 } } } }) },
      { match: (url) => url.includes('/download/'), response: async () => jsonResponse([]) },
      { match: (url) => url.includes('/missing/') || url.includes('/update/'), response: async () => jsonResponse({}) },
      { match: (url) => url.includes('/pid/v1/'), response: async () => jsonResponse({}) }
    ])

    await expect(sync(baseOpt())).resolves.toBeUndefined()
    expect(exitSpy).not.toHaveBeenCalled()
    expect(logSpy.mock.calls.join('\n')).toContain('may not create it')
  })
})
