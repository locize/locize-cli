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
    // Debug: print directory structure and file existence
    function printDir (dir, prefix = '') {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        if (fs.statSync(fullPath).isDirectory()) {
          console.log(prefix + file + '/')
          printDir(fullPath, prefix + '  ')
        } else {
          console.log(prefix + file)
        }
      }
    }
    printDir(tempDir)
    const enFilePath = path.join(tempDir, 'en', 'common.json')
    const deFilePath = path.join(tempDir, 'de', 'common.json')
    console.log('File exists before test (en):', fs.existsSync(enFilePath), enFilePath)
    console.log('File exists before test (de):', fs.existsSync(deFilePath), deFilePath)
    return new Promise((resolve) => setTimeout(resolve, 20))
  })
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('parses multiple local languages and returns expected structure', async () => {
    const opt = {
      path: tempDir,
      pathMask: ['{{language}}', '{{namespace}}'].join(path.sep),
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
