import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import xlsx from '../src/vendor/xlsx/xlsx.mjs'
import format from '../src/format.js'

const writeFixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-format-xlsx-'))
  fs.mkdirSync(path.join(dir, 'en'))
  const worksheet = xlsx.utils.json_to_sheet([{ key: 'a.b', en: 'Hello' }])
  const workbook = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(workbook, worksheet, 'common')
  fs.writeFileSync(path.join(dir, 'en', 'common.xlsx'), xlsx.write(workbook, { type: 'buffer' }))
  return dir
}

describe('format xlsx', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reformats a binary xlsx file instead of crashing in the diff', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const dir = writeFixture()
    const file = path.join(dir, 'en', 'common.xlsx')

    await expect(format({ format: 'xlsx', referenceLanguage: 'en', fileOrDirectory: dir })).resolves.toBeUndefined()

    const wb = xlsx.read(fs.readFileSync(file), { type: 'buffer' })
    expect(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).toEqual([{ key: 'a.b', en: 'Hello' }])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
