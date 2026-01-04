import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as removeVersionModule from '../src/removeVersion.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1' }

describe('removeVersion (fetch-only mock)', () => {
  let origFetch, origSetTimeout
  beforeEach(() => {
    origFetch = global.fetch
    origSetTimeout = global.setTimeout
  })
  afterEach(() => {
    global.fetch = origFetch
    global.setTimeout = origSetTimeout
  })

  it('resolves and polls job on success', async () => {
    let jobCallCount = 0
    global.fetch = createFetchSimulator([
      jsonHandler('/version/pid/v1', { jobId: 'jid' }),
      {
        match: (url) => url.includes('/jobs/pid/jid'),
        response: async () => {
          jobCallCount++
          if (jobCallCount === 1) return jsonHandler('/jobs/pid/jid', { timeouted: false }).response()
          return jsonHandler('/jobs/pid/jid', undefined).response()
        }
      }
    ])
    global.setTimeout = (fn) => { fn(); return 0 }
    await expect(removeVersionModule.default(opt)).resolves.toBeUndefined()
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/version/pid/v1', { errorMessage: 'fail' })
    ])
    await expect(removeVersionModule.default(opt)).rejects.toThrow('fail')
  })

  it('throws on missing jobId', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/version/pid/v1', {})
    ])
    await expect(removeVersionModule.default(opt)).rejects.toThrow('No jobId! Something went wrong!')
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/version/pid/v1', { jobId: 'jid' }, 400)
    ])
    await expect(removeVersionModule.default(opt)).rejects.toThrow('ERROR (400)')
  })
})
