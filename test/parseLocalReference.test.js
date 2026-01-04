import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import parseLocalReference from '../src/parseLocalReference.js'

// Only uses filesystem, no fetch

describe('parseLocalReference (temp dir)', () => {
  let tempDir
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-parseLocalReference-test-'))
    // Write a minimal local file for reference language
    const lngDir = path.join(tempDir, 'en')
    fs.mkdirSync(lngDir)
    fs.writeFileSync(path.join(lngDir, 'common.json'), JSON.stringify({ hello: 'world' }))
  })
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('parses a local reference language and returns expected structure', async () => {
    const opt = {
      path: tempDir,
      pathMask: '{{language}}/{{namespace}}',
      pathMaskInterpolationPrefix: '{{',
      pathMaskInterpolationSuffix: '}}',
      format: 'json',
      referenceLanguage: 'en'
    }
    const result = await parseLocalReference(opt)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(1)
    expect(result[0].language).toBe('en')
    expect(result[0].namespace).toBe('common')
    expect(result[0].path).toContain(path.join('en', 'common.json'))
    expect(result[0].content).toEqual({ hello: 'world' })
  })
})
