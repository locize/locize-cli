import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import getRemoteNamespace from '../src/getRemoteNamespace.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('getRemoteNamespace (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  it('returns flattened resources for a namespace', async () => {
    const resources = { hello: { world: 'test' }, foo: 'bar' }
    global.fetch = createFetchSimulator([
      jsonHandler('/pid/v1/en/common', resources)
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1' }
    const result = await getRemoteNamespace(opt, 'en', 'common')
    expect(result.result).toEqual({ 'hello.world': 'test', foo: 'bar' })
    expect(result.lastModified).toBeUndefined()
  })

  it('throws on error status', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('/pid/v1/en/common', {}, 500, {}, 'Server Error')
    ])
    const opt = { apiEndpoint: 'http://api', apiKey: 'key', projectId: 'pid', version: 'v1' }
    await expect(getRemoteNamespace(opt, 'en', 'common')).rejects.toThrow()
  })
})
