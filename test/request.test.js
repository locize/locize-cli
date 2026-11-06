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

  describe('on 429', () => {
    let origSetTimeout, delays
    beforeEach(() => {
      origSetTimeout = global.setTimeout
      delays = []
      global.setTimeout = (fn, ms) => { delays.push(ms); fn(); return 0 }
    })
    afterEach(() => {
      global.setTimeout = origSetTimeout
    })

    const throttledThen = (n, retryAfter) => {
      let calls = 0
      const throttled = jsonHandler('http://example.com', { message: 'Too many requests' }, 429, retryAfter === undefined ? {} : { 'retry-after': retryAfter })
      const ok = jsonHandler('http://example.com', { foo: 'bar' })
      return createFetchSimulator([{ match: ok.match, response: () => (++calls <= n ? throttled : ok).response() }])
    }

    it('retries after the Retry-After seconds and returns the success', async () => {
      global.fetch = throttledThen(1, '5')
      const { res, obj } = await request('http://example.com', { method: 'get' })
      expect(global.fetch.mock.calls.length).toBe(2)
      expect(res.status).toBe(200)
      expect(obj).toEqual({ foo: 'bar' })
      expect(delays[0]).toBeGreaterThanOrEqual(5000)
      expect(delays[0]).toBeLessThanOrEqual(6000)
    })

    it('caps a long Retry-After at 30 s', async () => {
      global.fetch = throttledThen(1, '600')
      await request('http://example.com', { method: 'get' })
      expect(delays[0]).toBeGreaterThanOrEqual(30000)
      expect(delays[0]).toBeLessThanOrEqual(31000)
    })

    it('falls back to the backoff without Retry-After', async () => {
      global.fetch = throttledThen(1)
      const { obj } = await request('http://example.com', { method: 'get' })
      expect(obj).toEqual({ foo: 'bar' })
      expect(delays[0]).toBeGreaterThanOrEqual(1000)
      expect(delays[0]).toBeLessThanOrEqual(2000)
    })

    it('gives up after the bounded retries and returns the last 429', async () => {
      global.fetch = throttledThen(Infinity, '1')
      const { res, obj } = await request('http://example.com', { method: 'get' })
      expect(global.fetch.mock.calls.length).toBe(4)
      expect(res.status).toBe(429)
      expect(obj).toEqual({ message: 'Too many requests' })
    })
  })
})
