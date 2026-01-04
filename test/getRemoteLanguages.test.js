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

  it('throws if no languages found', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/languages/pid', {})
    ])
    await expect(getRemoteLanguages(opt)).rejects.toThrow('Project with id "pid" not found!')
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
