import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

// The keys of the API's /download listing are read by name, not by position (2026-11-08): a legacy namespace with
// '/' was read as the part before the '/' (its content written over that namespace), and sync compared the URL's
// encoded names ('my%20ns'), so --delete-remote-namespace deleted 'my ns' on every run.
const cdn = (file, body) => jsonHandler(new RegExp(`//api/${file}$`), body) // a published file, raw path as stored
const opt = (dir, more) => ({
  apiEndpoint: 'http://api',
  apiKey: 'key',
  projectId: 'pid',
  version: 'v1',
  path: dir,
  format: 'json',
  pathMask: '{{language}}/{{namespace}}',
  pathMaskInterpolationPrefix: '{{',
  pathMaskInterpolationSuffix: '}}',
  ...more
})
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'))

describe('keys of the /download listing', () => {
  let dir, origFetch
  beforeEach(() => {
    origFetch = global.fetch
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-keys-test-'))
  })
  afterEach(() => {
    global.fetch = origFetch
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('download writes a slashed namespace into its own folder, beside the namespace before the slash', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true }, de: {} }),
      jsonHandler('/download/', [
        { key: 'pid/v1/en/legacy', size: 10 },
        { key: 'private/pid/v1/en/legacy/ns', size: 10, isPrivate: true },
        { key: 'pid/v1/de/legacy', size: 10 },
        { key: 'pid/v1/en/../../escape', size: 10 }, // a name from before the API refused '..': skipped, never fetched
        { key: 'pid/v1/en/..\\..\\escape', size: 10 } // the same with Windows separators
      ]),
      cdn('private/pid/v1/en/legacy/ns', { nested: 'yes' }),
      cdn('pid/v1/en/legacy', { top: 'yes' })
    ])
    const download = (await import('../src/download.js')).default
    await download(opt(dir, { languages: ['en'] }))
    expect(readJson(dir, 'en', 'legacy.json')).toEqual({ top: 'yes' })
    expect(readJson(dir, 'en', 'legacy', 'ns.json')).toEqual({ nested: 'yes' })
    expect(fs.existsSync(path.join(dir, 'de'))).toBe(false)
    expect(fs.existsSync(path.join(dir, '..', 'escape.json'))).toBe(false)
  })

  it('sync --delete-remote-namespace deletes only a namespace the local files lack, by its encoded name', async () => {
    fs.mkdirSync(path.join(dir, 'en'))
    fs.writeFileSync(path.join(dir, 'en', 'common.json'), '{"hello":"world"}')
    fs.writeFileSync(path.join(dir, 'en', 'my ns.json'), '{"a":"b"}')
    const fetchSim = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }),
      jsonHandler('/download/', [ // as the API sends them: the key as stored, the URL's namespace encoded
        { key: 'pid/v1/en/common', url: 'http://api/pid/v1/en/common', size: 10 },
        { key: 'pid/v1/en/my ns', url: 'http://api/pid/v1/en/my%20ns', size: 10 },
        { key: 'pid/v1/en/legacy/ns', url: 'http://api/pid/v1/en/legacy/ns', size: 10 }, // no local file can hold it
        { key: 'pid/v1/en/gone#1', url: 'http://api/pid/v1/en/gone%231', size: 10 } // missing locally
      ]),
      cdn('pid/v1/en/common', { hello: 'world' }),
      cdn('pid/v1/en/my ns', { a: 'b' }),
      cdn('pid/v1/en/legacy/ns', { c: 'd' }),
      cdn('pid/v1/en/gone#1', { e: 'f' }),
      jsonHandler(/\/delete\/pid\/v1\/gone%231$/, {})
    ])
    global.fetch = fetchSim
    const sync = (await import('../src/sync.js')).default
    await sync(opt(dir, { deleteRemoteNamespace: true }))
    expect(fetchSim.mock.calls.filter(([url]) => url.includes('/delete/')).map(([url]) => url)).toEqual(['http://api/delete/pid/v1/gone%231'])
  }, 15000) // sync waits 5 s after a remote change

  it('download --unpublished skips a stats name that would write outside the target folder', async () => {
    const fetchSim = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }),
      jsonHandler('/stats/project/', { v1: { en: { common: { segmentsTranslated: 1 }, '../../escape': { segmentsTranslated: 1 } } } }),
      jsonHandler(/\/pull\/pid\/v1\/en\/common$/, { hello: 'world' })
    ])
    global.fetch = fetchSim
    const download = (await import('../src/download.js')).default
    await download(opt(dir, { unpublished: true }))
    expect(readJson(dir, 'en', 'common.json')).toEqual({ hello: 'world' })
    expect(fetchSim.mock.calls.some(([url]) => url.includes('escape'))).toBe(false)
    expect(fs.existsSync(path.join(dir, '..', 'escape.json'))).toBe(false)
  })

  it('sync --unpublished skips a stats name that would write outside the target folder', async () => {
    const fetchSim = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true } }),
      jsonHandler('/stats/project/', { v1: { en: { common: { segmentsTranslated: 1 }, '../../escape': { segmentsTranslated: 1 } } } }),
      jsonHandler(/\/pull\/pid\/v1\/en\/common$/, { hello: 'world' })
    ])
    global.fetch = fetchSim
    const sync = (await import('../src/sync.js')).default
    await sync(opt(dir, { unpublished: true }))
    expect(readJson(dir, 'en', 'common.json')).toEqual({ hello: 'world' })
    expect(fetchSim.mock.calls.some(([url]) => url.includes('escape'))).toBe(false)
  })

  // a placeholder for a language is fetched on the public path, where a private version's files are not
  it('sync of a private version fills no language from the public path', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/', { en: { isReferenceLanguage: true }, de: {} }),
      jsonHandler('/download/', [
        { key: 'private/pid/v1/en/common', size: 10, isPrivate: true },
        { key: 'private/pid/v1/de/common', size: 2, isPrivate: true } // empty, dropped by --skip-empty
      ]),
      cdn('private/pid/v1/en/common', { hello: 'world' })
    ])
    const sync = (await import('../src/sync.js')).default
    await sync(opt(dir, { skipEmpty: true }))
    expect(readJson(dir, 'en', 'common.json')).toEqual({ hello: 'world' })
  })
})
