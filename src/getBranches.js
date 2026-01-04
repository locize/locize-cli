import colors from 'colors'
import request from './request.js'

const getBranches = async (opt) => {
  const { res, obj, err } = await request(opt.apiEndpoint + '/branches/' + opt.projectId, {
    method: 'get',
    headers: {
      Authorization: opt.apiKey
    }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    console.log(colors.red('getting branches failed...'))
    if (err) {
      console.error(colors.red(err.message))
      throw err
    }
    if (obj && (obj.errorMessage || obj.message)) {
      console.error(colors.red((obj.errorMessage || obj.message)))
      throw new Error((obj.errorMessage || obj.message))
    }
  }
  if (res.status === 404) {
    console.error(colors.yellow(res.statusText + ' (' + res.status + ')'))
    return null
  }
  if (res.status >= 300) {
    console.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw new Error(res.statusText + ' (' + res.status + ')')
  }
  console.log(colors.green('getting branches successful'))
  return obj
}

export default getBranches
