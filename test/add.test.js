import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

// Only mock fetch globally

describe('add (fetch-only mock, temp dir)', () => {
  let add, tempDir, origFetch, fetchSim
  beforeEach(async () => {
    origFetch = global.fetch
    fetchSim = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }),
      jsonHandler('/update/', {}, 200)
    ])
    global.fetch = fetchSim
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-add-test-'))
    const mod = await import('../src/add.js')
    add = mod.default
  })
  afterEach(() => {
    global.fetch = origFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('adds a key to a language using only fetch mock', async () => {
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1', namespace: 'common', key: 'hello', value: 'world', path: tempDir }
    await expect(add(opt)).resolves.toBeUndefined()
    // Check fetch was called for both endpoints with correct arguments
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    const expectedUserAgent = `${pkg.name}/v${pkg.version} (node/${process.version}; ${process.platform} ${process.arch})`
    const placeholderUserAgent = `__packageName__/__v_packageVersion__ (node/${process.version}; ${process.platform} ${process.arch})`
    // First call: /languages/ endpoint
    const call1 = fetchSim.mock.calls[0]
    expect(call1[0]).toContain('/languages/')
    // Second call: /update/ endpoint
    const call2 = fetchSim.mock.calls[1]
    expect(call2[0]).toContain('/update/')
    expect(call2[1]).toMatchObject({
      method: 'post',
      headers: expect.objectContaining({
        Authorization: 'key',
      })
    })
    // Body should be a JSON string with the correct content
    expect(call2[1].body).toBe(JSON.stringify({ hello: 'world' }))
    // User-Agent headers
    const headers = call2[1].headers
    expect([
      expectedUserAgent,
      placeholderUserAgent
    ]).toContain(headers['User-Agent'])
    expect([
      expectedUserAgent,
      placeholderUserAgent
    ]).toContain(headers['X-User-Agent'])
  })
})
