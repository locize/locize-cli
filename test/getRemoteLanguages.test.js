import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import getRemoteLanguages from '../src/getRemoteLanguages.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('getRemoteLanguages (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }

  it('returns languages with reference first', async () => {
    const obj = {
      de: { isReferenceLanguage: true },
      en: {},
      fr: {}
    }
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', obj)
    ])
    const result = await getRemoteLanguages(opt)
    expect(result).toEqual(['de', 'en', 'fr'])
    expect(opt.referenceLanguage).toBe('de')
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', { errorMessage: 'fail' }, 200, {}, 'OK')
    ])
    await expect(getRemoteLanguages(opt)).rejects.toThrow('OK (200) | fail')
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', {}, 400, {}, 'Bad Request')
    ])
    await expect(getRemoteLanguages(opt)).rejects.toThrow('Bad Request (400)')
  })

  it('throws a coded EMPTY_LANGUAGES error if no languages found', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', {})
    ])
    let thrown
    try {
      await getRemoteLanguages(opt)
    } catch (err) {
      thrown = err
    }
    expect(thrown.message).toContain('Project with id "pid" not found — or it has no languages yet!')
    expect(thrown.code).toBe('EMPTY_LANGUAGES')
  })

  it('appends the cdnType hint (coded WRONG_CDN_TYPE) when the other endpoint has the project', async () => {
    const locizeOpt = { ...opt, apiEndpoint: 'https://api.locize.app', cdnType: 'standard' }
    global.fetch = createFetchSimulator([
      {
        match: (url) => url.includes('api.lite.locize.app'),
        response: async () => ({
          status: 200,
          headers: { get: (n) => (n.toLowerCase() === 'content-type' ? 'application/json' : undefined) },
          json: async () => ({ en: { isReferenceLanguage: true } }),
          statusText: 'OK'
        })
      },
      jsonHandler('/languages/pid', {})
    ])
    let thrown
    try {
      await getRemoteLanguages(locizeOpt)
    } catch (err) {
      thrown = err
    }
    expect(thrown.message).toContain('wrong cdnType')
    expect(thrown.code).toBe('WRONG_CDN_TYPE')
  })

  it('does not crash (and adds no hint) when the other endpoint answers with non-JSON', async () => {
    const locizeOpt = { ...opt, apiEndpoint: 'https://api.locize.app', cdnType: 'standard' }
    global.fetch = createFetchSimulator([
      {
        match: (url) => url.includes('api.lite.locize.app'),
        response: async () => ({
          status: 200,
          headers: { get: (n) => (n.toLowerCase() === 'content-type' ? 'text/html' : undefined) },
          json: async () => { throw new Error('not json') },
          statusText: 'OK'
        })
      },
      jsonHandler('/languages/pid', {})
    ])
    let thrown
    try {
      await getRemoteLanguages(locizeOpt)
    } catch (err) {
      thrown = err
    }
    expect(thrown.code).toBe('EMPTY_LANGUAGES')
    expect(thrown.message).not.toContain('wrong cdnType')
  })

  it('throws if no reference language', async () => {
    const obj = {
      en: {},
      fr: {}
    }
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', obj)
    ])
    await expect(getRemoteLanguages(opt)).rejects.toThrow('Reference language for project with id "pid" not found!')
  })
})
