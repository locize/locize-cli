import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// This module does not use fetch, but we test with a temp dir

describe('parseLocalLanguage (temp dir)', () => {
  let parseLocalLanguage, tempDir
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-parseLocalLanguage-test-'))
    // Write a minimal local file
    const lngDir = path.join(tempDir, 'en')
    fs.mkdirSync(lngDir)
    fs.writeFileSync(path.join(lngDir, 'common.json'), JSON.stringify({ hello: 'world' }))
    const mod = await import('../src/parseLocalLanguage.js')
    parseLocalLanguage = mod.default
  })
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('parses a local language directory and returns expected structure', async () => {
    const opt = {
      path: tempDir,
      pathMask: '{{language}}/{{namespace}}',
      pathMaskInterpolationPrefix: '{{',
      pathMaskInterpolationSuffix: '}}',
      format: 'json'
    }
    const result = await parseLocalLanguage(opt, 'en')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(1)
    expect(result[0].language).toBe('en')
    expect(result[0].namespace).toBe('common')
    expect(result[0].path).toContain('common.json')
    expect(result[0].content).toEqual({ hello: 'world' })
  })
})
