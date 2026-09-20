import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import format from '../src/format.js'

const writeFixture = (contents) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-format-'))
  fs.mkdirSync(path.join(dir, 'en'))
  fs.writeFileSync(path.join(dir, 'en', 'common.json'), contents)
  return dir
}

describe('format', () => {
  afterEach(() => vi.restoreAllMocks())
  it('throws if format is invalid', async () => {
    await expect(format({ format: 'not-a-real-format', fileOrDirectory: __filename })).rejects.toThrow('not-a-real-format is not a valid format!')
  })

  it('prints a line diff when reformatting a text file', async () => {
    const logs = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')))
    const dir = writeFixture('{\n    "a.key": "Ay"\n}\n')
    await expect(format({ format: 'json', referenceLanguage: 'en', fileOrDirectory: dir })).resolves.toBeUndefined()
    expect(logs.some((l) => l.includes('"a.key": "Ay"'))).toBe(true)
    expect(logs.some((l) => l.includes('"key": "Ay"'))).toBe(true)
    expect(logs.some((l) => l.includes('reformatting'))).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'en', 'common.json'), 'utf8'))
      .toBe('{\n  "a": {\n    "key": "Ay"\n  }\n}\n')

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('skips the diff for an already formatted file', async () => {
    const logs = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')))
    const dir = writeFixture('{\n  "a": {\n    "key": "Ay"\n  }\n}\n')
    await expect(format({ format: 'json', referenceLanguage: 'en', fileOrDirectory: dir })).resolves.toBeUndefined()
    expect(logs.some((l) => l.includes('unchanged'))).toBe(true)
    expect(logs.some((l) => l.includes('reformatting'))).toBe(false)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
