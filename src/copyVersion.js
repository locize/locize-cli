import colors from 'colors'
import request from './request.js'
import getJob from './getJob.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const copyVersion = async (opt) => {
  const queryParams = new URLSearchParams()
  if (opt.ignoreIfVersionExists) {
    queryParams.append('ignoreIfVersionExists', 'true')
  }
  const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : ''
  const { res, obj, err } = await request(opt.apiEndpoint + '/copy/' + opt.projectId + '/version/' + opt.fromVersion + '/' + opt.toVersion + queryString, {
    method: 'post',
    headers: {
      Authorization: opt.apiKey
    }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    console.log(colors.red(`copy failed from ${opt.fromVersion} to ${opt.toVersion}...`))
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

  if (!obj || !obj.jobId) {
    console.error(colors.red('No jobId! Something went wrong!'))
    throw new Error('No jobId! Something went wrong!')
  }

  let job
  while (true) {
    job = await getJob(opt, obj.jobId)
    if (job && !job.timeouted) {
      await sleep(2000)
      continue
    }
    if (job && job.timeouted) {
      console.error(colors.red('Job timeouted!'))
      throw new Error('Job timeouted!')
    }
    break
  }
  console.log(colors.green(`copy from ${opt.fromVersion} to ${opt.toVersion} succesfully requested`))
  // done
}

export default copyVersion
