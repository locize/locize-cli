import { expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'
import missing from '../src/missing.js'
import * as missingModule from '../src/missing.js'

describe('missing (fetch-only mock)', () => {
  let origFetch
  let origExit
  beforeEach(() => {
    origFetch = global.fetch
    origExit = process.exit
    process.exit = (code) => { throw new Error(`process.exit called with ${code}`) }
  })
  afterEach(() => {
    global.fetch = origFetch
    process.exit = origExit
  })

  it('default export runs without error (minimal happy path)', async () => {
    // Create a temp dir and minimal en/common.json file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-missing-test-'))
    const enDir = path.join(tempDir, 'en')
    fs.mkdirSync(enDir)
    fs.writeFileSync(path.join(enDir, 'common.json'), JSON.stringify({ a: 1 }))
    global.fetch = createFetchSimulator([
      // getRemoteLanguages
      jsonHandler('/languages/pid', { en: { isReferenceLanguage: true } }),
      // getRemoteNamespace
      jsonHandler('/pid/v1/en/common', { result: { a: 1 } }),
      // request (final call)
      jsonHandler('/missing/pid/v1/en/common', {})
    ])
    const opt = {
      format: 'json',
      apiEndpoint: 'http://api',
      apiKey: 'key',
      projectId: 'pid',
      version: 'v1',
      path: tempDir,
      pathMask: ['{{language}}', '{{namespace}}'].join(path.sep),
      pathMaskInterpolationPrefix: '{{',
      pathMaskInterpolationSuffix: '}}'
    }
    // Debug: check file existence and add a short delay
    const filePath = path.join(enDir, 'common.json')
    console.log('File exists before CLI:', fs.existsSync(filePath), filePath)
    await new Promise((resolve) => setTimeout(resolve, 20))
    await expect(missing(opt)).resolves.toBeUndefined()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('compareNamespace returns keys to add', () => {
    const { compareNamespace } = missingModule
    const local = { a: 1, b: 2 }
    const remote = { a: 1 }
    const diff = compareNamespace(local, remote)
    expect(diff.toAdd).toEqual(['b'])
  })

  it('compareNamespace ignores empty string keys', () => {
    const { compareNamespace } = missingModule
    const local = { a: '', b: 2 }
    const remote = { a: '' }
    const diff = compareNamespace(local, remote)
    expect(diff.toAdd).toEqual(['b'])
  })
})
