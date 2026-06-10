import colors from 'colors'
import request from './request.js'

/**
 * Adds a language to the project via POST /language/{projectId}/{language}.
 *
 * Idempotent for bootstrap flows: an "already exists" answer counts as
 * success — the API responds 400 (ValidationError "Language already exists!"),
 * and 412 is kept for backwards compatibility with older deployments.
 *
 * Other failures throw an Error carrying `status` (e.g. 401 when the key
 * may not create languages) so callers can give role-specific guidance.
 */
const addLanguage = async (opt, l) => {
  const url = opt.apiEndpoint + '/language/' + opt.projectId + '/' + l
  try {
    const { res, obj } = await request(url, {
      method: 'post',
      headers: {
        Authorization: opt.apiKey
      }
    })
    if (res.status === 400 && ((obj && (obj.errorMessage || obj.message)) || '').indexOf('already exists') > -1) {
      console.log(colors.yellow(`language ${l} already exists...`))
      return
    }
    if (res.status >= 300 && res.status !== 412) {
      const serverMessage = obj && (obj.errorMessage || obj.message)
      const err = new Error(serverMessage ? `${res.statusText} (${res.status}) | ${serverMessage}` : `${res.statusText} (${res.status})`)
      err.status = res.status
      throw err
    }
    console.log(colors.green(`added language ${l}...`))
  } catch (err) {
    console.log(colors.red(`failed to add language ${l}...`))
    throw err
  }
}

export default addLanguage
