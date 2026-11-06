import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as deleteBranchModule from '../src/deleteBranch.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('deleteBranch (fetch-only mock)', () => {
  let origExit, origFetch
  beforeEach(() => {
    origExit = process.exit
    process.exit = vi.fn()
    origFetch = global.fetch
  })
  afterEach(() => {
    process.exit = origExit
    global.fetch = origFetch
  })

  it('returns undefined on 404', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/', [{ name: 'feature', id: '1' }]),
      jsonHandler('/branch/1', {}, 404)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', branch: 'feature' }
    const result = await deleteBranchModule.default(opt)
    expect(result).toBeUndefined()
  })

  it('throws on error status', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/', [{ name: 'feature', id: '1' }]),
      jsonHandler('/branch/1', {}, 500)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', branch: 'feature' }
    await expect(deleteBranchModule.default(opt)).rejects.toThrow('ERROR (500)')
  })

  it('returns undefined on success', async () => {
    let jobCallCount = 0
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/', [{ name: 'feature', id: '1' }]),
      jsonHandler('/branch/1', { jobId: '123', deleted: true }),
      {
        match: (url) => url.includes('/jobs/1/123'),
        response: async () => {
          jobCallCount++
          if (jobCallCount === 1) return jsonHandler('/jobs/1/123', { jobId: '123', deleted: true, timeouted: false }).response()
          if (jobCallCount === 2) return jsonHandler('/jobs/1/123', null).response()
          return jsonHandler('/jobs/1/123', {}).response()
        }
      }
    ])
    // Mock setTimeout to resolve immediately for sleep
    const origSetTimeout = global.setTimeout
    global.setTimeout = (fn) => { fn(); return 0 }
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', branch: 'feature' }
    const result = await deleteBranchModule.default(opt)
    global.setTimeout = origSetTimeout
    expect(result).toBeUndefined()
  })

  // the API refuses a poll on a deleted branch: done when the parent no longer lists it
  describe('when the job poll is refused', () => {
    const run = (listedAfterDelete, status = 401) => {
      let branchCalls = 0
      global.fetch = createFetchSimulator([
        {
          match: (url) => url.includes('/branches/'),
          response: () => jsonHandler('/branches/', (++branchCalls === 1 || listedAfterDelete) ? [{ name: 'feature', id: '1' }] : []).response()
        },
        jsonHandler('/branch/1', { jobId: '123' }),
        jsonHandler('/jobs/1/123', status === 401 ? { message: 'Unauthorized' } : {}, status)
      ])
      return deleteBranchModule.default({ apiEndpoint: 'http://api', apiKey: 'key', projectId: 'p', branch: 'feature' })
    }

    it('resolves once the branch is gone', async () => {
      await expect(run(false)).resolves.toBeUndefined()
    })

    it('rejects while the branch is still listed', async () => {
      await expect(run(true)).rejects.toThrow('Unauthorized')
    })

    // the parent drops the branch from its list when the deletion starts, so only a refusal means done
    it('rejects any other poll failure, even once the branch is no longer listed', async () => {
      await expect(run(false, 500)).rejects.toThrow('(500)')
    })
  })
})
