import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from '../src/request.js'
import { createFetchSimulator, jsonHandler } from './helpers/fetchSimulator.js'

describe('request (fetch-only mock)', () => {
  let origFetch
  beforeEach(() => {
    origFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = origFetch
  })

  it('returns parsed JSON for JSON response', async () => {
    global.fetch = createFetchSimulator([
      jsonHandler('http://example.com', { foo: 'bar' })
    ])
    const { res, obj } = await request('http://example.com', { method: 'get' })
    expect(obj).toEqual({ foo: 'bar' })
    expect(res).toBeDefined()
  })
})
