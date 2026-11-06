import colors from 'colors'
import request from './request.js'

// quiet: the caller prints a failure itself (getBranchJob.js); a thrown error carries the HTTP status
const getJob = async (opt, jobId, quiet) => {
  const out = quiet ? { log () {}, error () {} } : console
  const { res, obj, err } = await request(opt.apiEndpoint + '/jobs/' + opt.projectId + '/' + jobId, {
    method: 'get',
    headers: {
      Authorization: opt.apiKey
    }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    out.log(colors.red('getting job failed...'))
    if (err) {
      out.error(colors.red(err.message))
      throw err
    }
    if (obj && (obj.errorMessage || obj.message)) {
      out.error(colors.red((obj.errorMessage || obj.message)))
      throw Object.assign(new Error((obj.errorMessage || obj.message)), { status: res.status })
    }
  }
  if (res.status === 404) {
    console.error(colors.yellow(res.statusText + ' (' + res.status + ')'))
    return null
  }
  if (res.status >= 300) {
    out.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw Object.assign(new Error(res.statusText + ' (' + res.status + ')'), { status: res.status })
  }
  // console.log(colors.green('getting job successful'))
  return obj
}

export default getJob
