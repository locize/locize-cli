import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import getProjectStats from '../src/getProjectStats.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('getProjectStats (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  it('returns project stats on success', async () => {
    const stats = { keys: 10, languages: 2 }
    global.fetch = createFetchSimulator([
      jsonHandler('/stats/project/pid', stats)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }
    const result = await getProjectStats(opt)
    expect(result).toEqual(stats)
  })

  it('returns null on 404', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/stats/project/pid', {}, 404)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }
    const result = await getProjectStats(opt)
    expect(result).toBeNull()
  })

  it('throws on error status', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/stats/project/pid', {}, 500)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }
    await expect(getProjectStats(opt)).rejects.toThrow('ERROR (500)')
  })
})
