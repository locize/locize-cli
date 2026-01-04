import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import deleteNamespace from '../src/deleteNamespace.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1', namespace: 'ns' }

describe('deleteNamespace (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  it('resolves on success', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/delete/pid/v1/ns', {})
    ])
    await expect(deleteNamespace(opt)).resolves.toBeUndefined()
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/delete/pid/v1/ns', { errorMessage: 'fail' })
    ])
    await expect(deleteNamespace(opt)).rejects.toThrow('fail')
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/delete/pid/v1/ns', {}, 400)
    ])
    await expect(deleteNamespace(opt)).rejects.toThrow('ERROR (400)')
  })
})
