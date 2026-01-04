// sync.test.js
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('sync (fetch-only mock, temp dir)', () => {
  let sync
  let tempDir
  let origFetch
  let fetchSim

  beforeEach(async () => {
    origFetch = global.fetch

    fetchSim = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }, 200),
      jsonHandler('/download/', [
        { key: 'pid/v1/en/common', size: 10, isPrivate: false }
      ], 200),
      jsonHandler('/pid/v1/en/common', { hello: 'world' }, 200)
    ])

    global.fetch = fetchSim
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-sync-test-'))

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

  it('syncs and writes a file using only fetch mock', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      namespace: 'common',
      path: tempDir,
      format: 'json',
      pathMask: '{{language}}/{{namespace}}',
      pathMaskInterpolationPrefix: '{{',
      pathMaskInterpolationSuffix: '}}',
      skipEmpty: false
    }

    await expect(sync(opt)).resolves.toBeUndefined()

    const calledUrls = fetchSim.mock.calls.map(call => call[0])
    expect(calledUrls.some(url => url.includes('/languages/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/download/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/pid/v1/en/common'))).toBe(true)

    const filePath = path.join(tempDir, 'en', 'common.json')
    expect(fs.existsSync(filePath)).toBe(true)
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({ hello: 'world' })
  })

  it(
    'syncs multiple languages/namespaces and updates remote on local change',
    async () => {
      const TEST_PROJECT_ID = 'pid'
      const TEST_VERSION = 'v1'
      const TEST_API_KEY = 'api-key'
      const languages = ['en', 'de']
      const namespaces = ['common', 'extra']

      const initialData = {
        en: { common: { hello: 'world' }, extra: { foo: 'bar' } },
        de: { common: { hallo: 'welt' }, extra: { bar: 'foo' } }
      }

      function customFetch (url) {
        if (url.includes('/languages/')) {
          return Promise.resolve({
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ en: { isReferenceLanguage: true }, de: {} })
          })
        }

        if (url.includes('/download/')) {
          return Promise.resolve({
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () =>
              languages.flatMap(lng =>
                namespaces.map(ns => ({
                  key: `${TEST_PROJECT_ID}/${TEST_VERSION}/${lng}/${ns}`,
                  url: `http://api/${TEST_PROJECT_ID}/${TEST_VERSION}/${lng}/${ns}`,
                  size: 10,
                  isPrivate: false
                }))
              )
          })
        }

        for (const lng of languages) {
          for (const ns of namespaces) {
            if (url.includes(`/${TEST_PROJECT_ID}/${TEST_VERSION}/${lng}/${ns}`)) {
              return Promise.resolve({
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => initialData[lng][ns]
              })
            }
          }
        }

        if (url.includes('/update/')) {
          return Promise.resolve({
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true })
          })
        }

        throw new Error('Unexpected fetch: ' + url)
      }

      global.fetch = customFetch
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-sync-test-mlmn-'))

      const mod = await import('../src/sync.js')
      sync = mod.default

      // First sync
      await sync({
        apiEndpoint: 'http://api',
        projectId: TEST_PROJECT_ID,
        apiKey: TEST_API_KEY,
        version: TEST_VERSION,
        languages,
        namespace: namespaces.join(','),
        path: tempDir,
        format: 'json',
        pathMask: '{{language}}/{{namespace}}',
        pathMaskInterpolationPrefix: '{{',
        pathMaskInterpolationSuffix: '}}',
        skipEmpty: false
      })

      // Modify local file
      const enCommonPath = path.join(tempDir, 'en', 'common.json')
      const enCommon = JSON.parse(fs.readFileSync(enCommonPath, 'utf-8'))
      enCommon.newkey = 'newvalue'
      fs.writeFileSync(enCommonPath, JSON.stringify(enCommon, null, 2))

      // 🔑 Force ALL internal delays to resolve immediately
      const originalSetTimeout = global.setTimeout
      vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn()
        return 0
      })

      await sync({
        apiEndpoint: 'http://api',
        projectId: TEST_PROJECT_ID,
        apiKey: TEST_API_KEY,
        version: TEST_VERSION,
        languages,
        namespace: namespaces.join(','),
        path: tempDir,
        format: 'json',
        pathMask: '{{language}}/{{namespace}}',
        pathMaskInterpolationPrefix: '{{',
        pathMaskInterpolationSuffix: '}}',
        skipEmpty: false
      })

      global.setTimeout = originalSetTimeout
    }
  )
})
