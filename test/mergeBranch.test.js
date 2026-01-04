import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import mergeBranch from '../src/mergeBranch.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('mergeBranch (fetch-only mock)', () => {
  let origFetch, origSetTimeout
  beforeEach(() => {
    origFetch = global.fetch
    origSetTimeout = global.setTimeout
  })
  afterEach(() => {
    global.fetch = origFetch
    global.setTimeout = origSetTimeout
  })

  it('runs without error for minimal happy path', async () => {
    let jobCallCount = 0
    global.fetch = createFetchSimulator([
      // getBranches
      jsonHandler('/branches/', [{ id: 'bid', name: 'main', version: 'v1' }]),
      // merge
      jsonHandler('/branch/merge/bid', { jobId: 'jid' }, 200),
      // getJob polling
      {
        match: (url) => url.includes('/jobs/bid/jid'),
        response: async () => {
          jobCallCount++
          if (jobCallCount === 1) return jsonHandler('/jobs/bid/jid', { timeouted: false }).response()
          return jsonHandler('/jobs/bid/jid', undefined).response()
        }
      }
    ])
    global.setTimeout = (fn) => { fn(); return 0 }
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', branch: 'main' }
    await expect(mergeBranch(opt)).resolves.toBeUndefined()
  })
})
