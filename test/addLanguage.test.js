import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'
import addLanguage from '../src/addLanguage.js'

describe('addLanguage', () => {
  const opt = { apiEndpoint: 'https://api.locize.app', projectId: 'pid', apiKey: 'key' }
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    global.fetch = origFetch
    vi.restoreAllMocks()
  })

  it('counts the type validationError.language.alreadyExists as success', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/language/', { name: 'ValidationError', type: 'validationError.language.alreadyExists', message: 'Bad Request: Language already exists!' }, 400)
    ])
    await expect(addLanguage(opt, 'de')).resolves.toBeUndefined()
  })

  it('throws with the status for any other 400', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/language/', { name: 'ValidationError', message: 'Bad Request: something else' }, 400)
    ])
    await expect(addLanguage(opt, 'de')).rejects.toMatchObject({ status: 400 })
  })
})
