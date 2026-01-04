import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

// Minimal happy path: migrate uploads a local file using fetch

describe('migrate (fetch-only mock, temp dir)', () => {
  let migrate, tempDir, origFetch, fetchSim
  beforeEach(async () => {
    origFetch = global.fetch
    fetchSim = createFetchSimulator([
      jsonHandler('/update/', {}, 200)
    ])
    global.fetch = fetchSim
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-migrate-test-'))
    // Write a minimal local file to migrate
    const lngDir = path.join(tempDir, 'en')
    fs.mkdirSync(lngDir)
    fs.writeFileSync(path.join(lngDir, 'common.json'), JSON.stringify({ hello: 'world' }))
    const mod = await import('../src/migrate.js')
    migrate = mod.default
  })
  afterEach(() => {
    global.fetch = origFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('uploads a local file using only fetch mock', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      apiKey: 'key',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      path: path.join(tempDir, 'en'),
      format: 'json',
      replace: true
    }
    await expect(migrate(opt)).resolves.toBeUndefined()
    // Check fetch was called for /update/
    expect(fetchSim.mock.calls.some(call => call[0].includes('/update/'))).toBe(true)
  })
})
