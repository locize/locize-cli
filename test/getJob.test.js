import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import getJob from '../src/getJob.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('getJob (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid' }

  it('returns job object for successful response', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/jobs/pid/jobid', { job: 'done' })
    ])
    const result = await getJob(opt, 'jobid')
    expect(result).toEqual({ job: 'done' })
  })

  it('throws on error message in obj', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/jobs/pid/jobid', { errorMessage: 'fail' })
    ])
    await expect(getJob(opt, 'jobid')).rejects.toThrow('fail')
  })

  it('returns null on 404', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/jobs/pid/jobid', {}, 404, {}, 'Not Found')
    ])
    const result = await getJob(opt, 'jobid')
    expect(result).toBeNull()
  })

  it('throws on HTTP error', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/jobs/pid/jobid', {}, 400, {}, 'Bad Request')
    ])
    await expect(getJob(opt, 'jobid')).rejects.toThrow('Bad Request (400)')
  })
})
