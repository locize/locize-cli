import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('get (fetch-only mock)', () => {
  let get, tempDir, origFetch, fetchSim

  beforeAll(async () => {
    const mod = await import('../src/get.js')
    get = mod.default
  })

  beforeEach(() => {
    origFetch = global.fetch
    fetchSim = createFetchSimulator([
      jsonHandler('/pid/v1/en/common', { hello: 'world' }, 200),
      jsonHandler('/pid/v1/en/common', { foo: 'bar' }, 200)
    ])
    global.fetch = fetchSim
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-get-test-'))
  })

  afterEach(() => {
    global.fetch = origFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('fetches and logs a key (happy path)', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      namespace: 'common',
      key: 'hello',
    }
    // Suppress console.log output
    const logSpy = { mockImplementation: () => {} }
    await expect(get(opt)).resolves.toBeUndefined()
    const expectedUrl = 'http://api/pid/v1/en/common'
    const expectedUserAgent = `${pkg.name}/v${pkg.version} (node/${process.version}; ${process.platform} ${process.arch})`
    const placeholderUserAgent = `__packageName__/v__packageVersion__ (node/${process.version}; ${process.platform} ${process.arch})`
    const call = fetchSim.mock.calls[0]
    expect(call[0]).toBe(expectedUrl)
    expect(call[1]).toMatchObject({ method: 'get' })
    const headers = call[1].headers
    expect([
      expectedUserAgent,
      placeholderUserAgent
    ]).toContain(headers['User-Agent'])
    expect([
      expectedUserAgent,
      placeholderUserAgent
    ]).toContain(headers['X-User-Agent'])
    logSpy.mockRestore && logSpy.mockRestore()
  })

  it('throws if key not found', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      namespace: 'common',
      key: 'hello',
    }
    // Use a new fetch simulator for the error case
    const errorFetchSim = createFetchSimulator([
      jsonHandler('/pid/v1/en/common', { foo: 'bar' }, 200)
    ])
    global.fetch = errorFetchSim
    await expect(get(opt)).rejects.toThrow('hello not found')
    global.fetch = fetchSim
  })
})
