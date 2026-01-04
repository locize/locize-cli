// fetchSimulator.js
// Utility to simulate fetch API for tests

/**
 * Creates a fetch simulator for use in tests.
 * @param {Array<{ match: (url, options) => boolean, response: (url, options) => any }>} handlers
 * @returns {Function} fetch simulator function
 */
export function createFetchSimulator (handlers = []) {
  const calls = []
  const fetchSim = async (url, options = {}) => {
    calls.push([url, options])
    const baseUrl = typeof url === 'string' ? url.split('?')[0] : url
    for (const { match, response } of handlers) {
      if (match(baseUrl, options)) {
        return await response(baseUrl, options)
      }
    }
    throw new Error('Unexpected fetch: ' + url)
  }
  fetchSim.mock = { calls }
  return fetchSim
}

/**
 * Improved handler for a JSON endpoint
 * @param {string|RegExp} urlPattern
 * @param {any} jsonResponse
 * @param {number} status
 * @param {object} headers
 * @param {string} statusText
 */
export function jsonHandler (urlPattern, jsonResponse, status = 200, headers = {}, statusText) {
  return {
    match: (url) => {
      const baseUrl = typeof url === 'string' ? url.split('?')[0] : url
      return typeof urlPattern === 'string' ? baseUrl.includes(urlPattern) : urlPattern.test(baseUrl)
    },
    response: async () => ({
      status,
      headers: {
        get: (name) => {
          if (name.toLowerCase() === 'content-type') return headers['content-type'] || 'application/json'
          return headers[name.toLowerCase()]
        }
      },
      json: async () => jsonResponse,
      statusText: statusText || (status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'ERROR')
    })
  }
}
