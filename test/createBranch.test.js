import { expect } from 'vitest'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'
import createBranch from '../src/createBranch.js'

describe('createBranch (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  it('creates a new branch if not existing', async () => {
    global.fetch = createFetchSimulator([
      // getBranches returns no branches
      jsonHandler('/branches/pid', []),
      // createBranch creates new branch
      jsonHandler('/branch/create/', { name: 'feature', id: '2' }, 200)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1', branch: 'feature' }
    const result = await createBranch(opt)
    expect(result).toMatchObject({ name: 'feature', id: '2' })
  })

  it('returns existing branch if already present', async () => {
    global.fetch = createFetchSimulator([
      // getBranches returns existing branch
      jsonHandler('/branches/pid', [{ name: 'main', id: '1' }])
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1', branch: 'main' }
    const result = await createBranch(opt)
    expect(result).toMatchObject({ name: 'main', id: '1' })
  })
})
