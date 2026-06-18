import { HttpsProxyAgent } from 'https-proxy-agent'
import https from 'https'
import CacheableLookup from 'cacheable-lookup'

const cacheable = new CacheableLookup()
cacheable.install(https.globalAgent)

const RETRY_MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 2000
const RETRY_MAX_DELAY_MS = 30000

const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY || process.env.https_proxy || process.env.HTTPS_PROXY
const isRetriableError = (err) => {
  return err && err.message && (
    err.message.indexOf('ETIMEDOUT') > -1 || // on timeout retry
    err.message.indexOf('FetchError') > -1 ||
    err.code === 'ETIMEDOUT' ||
    // on dns errors
    err.message.indexOf('ENOTFOUND') > -1 ||
    err.message.indexOf('ENODATA') > -1 ||
    err.message.indexOf('ENOENT') > -1 // Windows: name exists, but not this record type
  )
}

const isJSONResponse = (res) => res.headers.get('content-type') && res.headers.get('content-type').indexOf('json') > 0
const isOctetStream = (res) => res.headers.get('content-type') && res.headers.get('content-type').indexOf('octet-stream') > 0

const handleResponse = (res) => {
  if (isJSONResponse(res) || isOctetStream(res)) {
    return new Promise((resolve, reject) => res.json().then((obj) => resolve({ res, obj })).catch(reject))
  } else {
    return { res }
  }
}

async function request (url, options) {
  if (httpProxy) {
    const httpsProxyAgent = new HttpsProxyAgent(httpProxy)
    cacheable.install(httpsProxyAgent)
    options.agent = httpsProxyAgent
  }

  options.headers = options.headers || {}
  options.headers['User-Agent'] = `__packageName__/__v_packageVersion__ (node/${process.version}; ${process.platform} ${process.arch})` // This string is replaced with the actual version at build time by rollup
  options.headers['X-User-Agent'] = options.headers['User-Agent']
  if (options.body || options.method !== 'get') options.headers['Content-Type'] = 'application/json'
  if (options.body) {
    if (typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body)
    }
  }
  if (options.headers['Authorization'] === undefined) delete options.headers['Authorization']

  async function retriableFetch (retriesLeft, attempt = 0) {
    try {
      const response = await fetch(url, options)
      const result = await handleResponse(response)
      return result
    } catch (err) {
      if (retriesLeft < 1) throw err
      if (!isRetriableError(err)) throw err
      // Exponential backoff with equal jitter: spreads retries so a burst of
      // concurrent CLI runs (e.g. CI) doesn't all retry in lockstep and
      // hammer the API at the same instant.
      const expDelay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** attempt))
      const delay = Math.round(expDelay / 2 + Math.random() * (expDelay / 2))
      await new Promise(resolve => setTimeout(resolve, delay))
      return retriableFetch(retriesLeft - 1, attempt + 1)
    }
  }
  return retriableFetch(RETRY_MAX_ATTEMPTS)
}
export default request
