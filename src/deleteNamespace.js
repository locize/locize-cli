import colors from 'colors'
import request from './request.js'

const deleteNamespace = async (opt) => {
  const url = opt.apiEndpoint + '/delete/' + opt.projectId + '/' + opt.version + '/' + opt.namespace

  console.log(colors.yellow(`deleting ${opt.namespace} from ${opt.version}...`))

  const { res, obj, err } = await request(url, {
    method: 'delete',
    headers: {
      Authorization: opt.apiKey
    }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    console.log(colors.red(`delete failed for ${opt.namespace} from ${opt.version}...`))
    if (err) {
      console.error(colors.red(err.message))
      throw err
    }
    if (obj && (obj.errorMessage || obj.message)) {
      console.error(colors.red((obj.errorMessage || obj.message)))
      throw new Error((obj.errorMessage || obj.message))
    }
  }
  if (res.status >= 300) {
    console.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw new Error(res.statusText + ' (' + res.status + ')')
  }
  console.log(colors.green(`deleted ${opt.namespace} from ${opt.version}...`))
  // done
}

export default deleteNamespace
