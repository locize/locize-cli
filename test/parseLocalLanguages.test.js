import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import parseLocalLanguages from '../src/parseLocalLanguages.js'

// Only uses filesystem, no fetch

describe('parseLocalLanguages (temp dir)', () => {
  let tempDir
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-parseLocalLanguages-test-'))
    // Write minimal local files for two languages
    const enDir = path.join(tempDir, 'en')
    const deDir = path.join(tempDir, 'de')
    fs.mkdirSync(enDir)
    fs.mkdirSync(deDir)
    fs.writeFileSync(path.join(enDir, 'common.json'), JSON.stringify({ hello: 'world' }))
    fs.writeFileSync(path.join(deDir, 'common.json'), JSON.stringify({ hallo: 'welt' }))
  })
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('parses multiple local languages and returns expected structure', async () => {
    const opt = {
      path: tempDir,
      pathMask: '{{language}}/{{namespace}}',
      pathMaskInterpolationPrefix: '{{',
      pathMaskInterpolationSuffix: '}}',
      format: 'json'
    }
    const result = await parseLocalLanguages(opt, ['en', 'de'])
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    const en = result.find(r => r.language === 'en')
    const de = result.find(r => r.language === 'de')
    expect(en.namespace).toBe('common')
    expect(en.path).toContain(path.join('en', 'common.json'))
    expect(en.content).toEqual({ hello: 'world' })
    expect(de.namespace).toBe('common')
    expect(de.path).toContain(path.join('de', 'common.json'))
    expect(de.content).toEqual({ hallo: 'welt' })
  })
})
