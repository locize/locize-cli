import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

// Minimal happy path: download calls fetch for /download/ endpoint and writes a file

describe('download (fetch-only mock, temp dir)', () => {
  let download, tempDir, origFetch, fetchSim
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-download-test-'))
    const mod = await import('../src/download.js')
    download = mod.default
  })
  afterEach(() => {
    global.fetch = origFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('downloads and writes a file using only fetch mock', async () => {
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
    await expect(download(opt)).resolves.toBeUndefined()
    // Check fetch was called for /languages/, /download/, and for the namespace
    const calledUrls = fetchSim.mock.calls.map(call => call[0])
    expect(calledUrls.some(url => url.includes('/languages/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/download/'))).toBe(true)
    expect(calledUrls.some(url => url.includes('/pid/v1/en/common'))).toBe(true)
    // Check file was written
    const filePath = path.join(tempDir, 'en', 'common.json')
    expect(fs.existsSync(filePath)).toBe(true)
    const fileContent = fs.readFileSync(filePath, 'utf8')
    expect(JSON.parse(fileContent)).toEqual({ hello: 'world' })
  })
})

// Wide argument scenarios from download.wide.fetch.mocked.test.js
const TEST_PROJECT_ID = 'test-project-id'
const TEST_API_KEY = 'test-api-key'
const TEST_NAMESPACE = 'common'
const TEST_LANGUAGE = 'en'
const TEST_VERSION = 'latest'

function createTempDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'locize-download-test-'))
}

describe('download wide argument scenarios', () => {
  let tempDir, origFetch

  beforeEach(() => {
    tempDir = createTempDir()
    origFetch = global.fetch
    global.fetch = createFetchSimulator([
      // Mock the languages endpoint (multiple languages)
      jsonHandler(
        `/languages/${TEST_PROJECT_ID}`,
        { en: { isReferenceLanguage: true }, de: {}, fr: {} }
      ),
      // Mock the download endpoint (multiple languages, multiple namespaces)
      jsonHandler(
        `/download/${TEST_PROJECT_ID}/${TEST_VERSION}`,
        [
          { key: `${TEST_PROJECT_ID}/${TEST_VERSION}/en/common`, size: 10, isPrivate: false },
          { key: `${TEST_PROJECT_ID}/${TEST_VERSION}/en/extra`, size: 10, isPrivate: false },
          { key: `${TEST_PROJECT_ID}/${TEST_VERSION}/de/common`, size: 10, isPrivate: false },
          { key: `${TEST_PROJECT_ID}/${TEST_VERSION}/fr/common`, size: 10, isPrivate: false }
        ]
      ),
      // Mock the namespace data endpoint for all combinations
      jsonHandler(
        new RegExp(`/${TEST_PROJECT_ID}/${TEST_VERSION}/en/common`),
        { title: 'Hello', foo: 'bar' }
      ),
      jsonHandler(
        new RegExp(`/${TEST_PROJECT_ID}/${TEST_VERSION}/en/extra`),
        { extra: 'value' }
      ),
      jsonHandler(
        new RegExp(`/${TEST_PROJECT_ID}/${TEST_VERSION}/de/common`),
        { title: 'Hallo', foo: 'bär' }
      ),
      jsonHandler(
        new RegExp(`/${TEST_PROJECT_ID}/${TEST_VERSION}/fr/common`),
        { title: 'Bonjour', foo: 'barre' }
      )
    ])
  })

  afterEach(() => {
    global.fetch = origFetch
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should error if project-id is missing', async () => {
    let error
    try {
      await (await import('../src/download.js')).default({
        // projectId missing
        apiKey: TEST_API_KEY,
        language: TEST_LANGUAGE,
        namespace: TEST_NAMESPACE,
        path: tempDir
      })
    } catch (e) {
      error = e
    }
    expect(error).toBeTruthy()
  })

  it('should download a namespace for a single language', async () => {
    await (await import('../src/download.js')).default({
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      language: TEST_LANGUAGE,
      namespace: TEST_NAMESPACE,
      path: tempDir,
      version: TEST_VERSION
    })
    // Should write file to tempDir/en/common.json
    const outFile = path.join(tempDir, TEST_LANGUAGE, `${TEST_NAMESPACE}.json`)
    expect(fs.existsSync(outFile)).toBe(true)
    const content = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
    expect(content).toEqual({ title: 'Hello', foo: 'bar' })
  })

  it('should download multiple languages and multiple namespaces', async () => {
    await (await import('../src/download.js')).default({
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      languages: ['en', 'de', 'fr'],
      namespace: 'common',
      path: tempDir,
      version: TEST_VERSION
    })
    // Should write files for each language
    for (const lng of ['en', 'de', 'fr']) {
      const outFile = path.join(tempDir, lng, 'common.json')
      expect(fs.existsSync(outFile)).toBe(true)
      const content = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
      expect(content).toHaveProperty('title')
    }
  })

  it('should download multiple namespaces for a single language', async () => {
    await (await import('../src/download.js')).default({
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      language: 'en',
      namespace: 'common,extra',
      path: tempDir,
      version: TEST_VERSION
    })
    // Should write files for each namespace
    for (const ns of ['common', 'extra']) {
      const outFile = path.join(tempDir, 'en', `${ns}.json`)
      expect(fs.existsSync(outFile)).toBe(true)
      const content = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
      expect(typeof content).toBe('object')
    }
  })

  it('should download in flat format', async () => {
    await (await import('../src/download.js')).default({
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      language: 'en',
      namespace: 'common',
      path: tempDir,
      version: TEST_VERSION,
      format: 'flat'
    })
    const outFile = path.join(tempDir, 'en', 'common.json')
    expect(fs.existsSync(outFile)).toBe(true)
    const content = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
    expect(content).toHaveProperty('title')
    expect(content).toHaveProperty('foo')
  })

  it('should download in yaml format', async () => {
    await (await import('../src/download.js')).default({
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      language: 'en',
      namespace: 'common',
      path: tempDir,
      version: TEST_VERSION,
      format: 'yaml'
    })
    const outFile = path.join(tempDir, 'en', 'common.yaml')
    expect(fs.existsSync(outFile)).toBe(true)
    const content = fs.readFileSync(outFile, 'utf-8')
    // Basic YAML parse and key check
    const parsed = require('yaml').parse(content)
    expect(parsed).toHaveProperty('title')
    expect(parsed).toHaveProperty('foo')
  })
})
