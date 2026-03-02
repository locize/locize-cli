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

describe('migrate with download option', () => {
  let migrate, tempDir, origFetch, fetchSim
  beforeEach(async () => {
    origFetch = global.fetch
    fetchSim = createFetchSimulator([
      jsonHandler('/update/', {}, 200),
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }, 200),
      jsonHandler('/download/', [
        { key: 'pid/v1/en/common', size: 10, isPrivate: false }
      ], 200),
      jsonHandler('/pid/v1/en/common', { hello: 'world' }, 200)
    ])
    global.fetch = fetchSim
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-migrate-dl-test-'))
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
  it('uploads and then downloads translations when download option is true', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      apiKey: 'key',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      path: path.join(tempDir, 'en'),
      format: 'json',
      replace: true,
      download: true
    }
    await expect(migrate(opt)).resolves.toBeUndefined()
    // Check fetch was called for /update/ (migrate) and /download/ (download)
    const calledUrls = fetchSim.mock.calls.map(call => call[0])
    expect(calledUrls.some(url => url.includes('/update/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/download/'))).toBe(true)
    // Check that downloaded file was written
    const filePath = path.join(tempDir, 'en', 'en', 'common.json')
    expect(fs.existsSync(filePath)).toBe(true)
    const fileContent = fs.readFileSync(filePath, 'utf8')
    expect(JSON.parse(fileContent)).toEqual({ hello: 'world' })
  }, 15000)
  it('does not download when download option is false', async () => {
    const opt = {
      apiEndpoint: 'http://api',
      apiKey: 'key',
      projectId: 'pid',
      version: 'v1',
      language: 'en',
      path: path.join(tempDir, 'en'),
      format: 'json',
      replace: true,
      download: false
    }
    await expect(migrate(opt)).resolves.toBeUndefined()
    const calledUrls = fetchSim.mock.calls.map(call => call[0])
    expect(calledUrls.some(url => url.includes('/update/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/download/'))).toBe(false)
  })
})
