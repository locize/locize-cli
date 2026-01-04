import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as copyVersionModule from '../src/copyVersion.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', fromVersion: 'v1', toVersion: 'v2' }

describe('copyVersion (fetch-only mock)', () => {
  let origFetch, origSetTimeout
  beforeEach(() => {
    origFetch = global.fetch
    origSetTimeout = global.setTimeout
  })
  afterEach(() => {
    global.fetch = origFetch
    global.setTimeout = origSetTimeout
  })

  it('succeeds and polls job', async () => {
    let jobCallCount = 0
    global.fetch = createFetchSimulator([
      jsonHandler('/copy/pid/version/v1/v2', { jobId: 'jid' }),
      {
        match: (url) => url.includes('/jobs/pid/jid'),
        response: async () => {
          jobCallCount++
          if (jobCallCount === 1) return { status: 200, headers: { get: () => 'application/json' }, json: async () => undefined, statusText: 'OK' }
          return { status: 200, headers: { get: () => 'application/json' }, json: async () => ({ timeouted: false }), statusText: 'OK' }
        }
      }
    ])
    global.setTimeout = (fn) => { fn(); return 0 }
    await expect(copyVersionModule.default(opt)).resolves.toBeUndefined()
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/copy/pid/version/v1/v2', { errorMessage: 'fail' })
    ])
    await expect(copyVersionModule.default(opt)).rejects.toThrow('fail')
  })

  it('throws on missing jobId', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/copy/pid/version/v1/v2', {})
    ])
    await expect(copyVersionModule.default(opt)).rejects.toThrow('No jobId! Something went wrong!')
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/copy/pid/version/v1/v2', { jobId: 'jid' }, 400)
    ])
    await expect(copyVersionModule.default(opt)).rejects.toThrow('ERROR (400)')
  })
})
