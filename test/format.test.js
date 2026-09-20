import { describe, it, expect, vi, afterEach } from 'vitest'
import colors from 'colors'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import format from '../src/format.js'

const esc = String.fromCharCode(27)
const markers = { 31: '-', 32: '+', 90: ' ' }
const asDiffLine = (line) => {
  const reset = `${esc}[39m`
  if (!line.startsWith(`${esc}[`) || !line.endsWith(reset)) return line
  const open = line.indexOf('m')
  const marker = markers[line.slice(2, open)]
  if (!marker) return line
  return marker + line.slice(open + 1, -reset.length)
}

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

  it('renders the diff one line per change, red before green', async () => {
    const logs = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')))
    const wasEnabled = colors.enabled
    colors.enable()
    const dir = writeFixture('{\n    "a.key": "Ay",\n    "b.key": "Bee"\n}\n')
    try {
      await format({ format: 'json', referenceLanguage: 'en', fileOrDirectory: dir })
    } finally {
      if (!wasEnabled) colors.disable()
      fs.rmSync(dir, { recursive: true, force: true })
    }
    const rendered = logs.slice(0, logs.findIndex((l) => l.includes('reformatting')))
    expect(rendered.map(asDiffLine)).toEqual([
      ' {',
      '+  "a": {',
      '-    "a.key": "Ay",',
      '+    "key": "Ay"',
      '+  },',
      '+  "b": {',
      '-    "b.key": "Bee"',
      '+    "key": "Bee"',
      '+  }',
      ' }',
      ' '
    ])
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
