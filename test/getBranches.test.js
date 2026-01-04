import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import getBranches from '../src/getBranches.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('getBranches (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }

  it('returns branches on success', async () => {
    const branches = [{ name: 'main' }]
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/pid', branches)
    ])
    await expect(getBranches(opt)).resolves.toEqual(branches)
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/pid', { errorMessage: 'fail' })
    ])
    await expect(getBranches(opt)).rejects.toThrow('fail')
  })

  it('returns null on 404', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/pid', {}, 404, {}, 'Not Found')
    ])
    await expect(getBranches(opt)).resolves.toBeNull()
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/branches/pid', {}, 400, {}, 'Bad Request')
    ])
    await expect(getBranches(opt)).rejects.toThrow('Bad Request (400)')
  })
})
