import colors from 'colors'
import request from './request.js'
import getJob from './getJob.js'

const publishVersion = async (opt) => {
  const { res, obj } = await request(opt.apiEndpoint + '/publish/' + opt.projectId + '/' + opt.version + (opt.tenants ? '?tenants=true' : ''), {
    method: 'post',
    headers: {
      Authorization: opt.apiKey
    }
  })
  if (obj && (obj.errorMessage || obj.message)) {
    console.log(colors.red(`publishing failed for ${opt.version}...`))
    throw new Error(obj.errorMessage || obj.message)
  }
  if (res.status >= 300) {
    console.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw new Error(res.statusText + ' (' + res.status + ')')
  }
  if (!obj || !obj.jobId) {
    console.error(colors.red('No jobId! Something went wrong!'))
    throw new Error('No jobId! Something went wrong!')
  }
  // Poll for job completion
  while (true) {
    const job = await getJob(opt, obj.jobId)
    if (job && !job.timeouted) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      continue
    }
    if (job && job.timeouted) {
      console.error(colors.red('Job timeouted!'))
      throw new Error('Job timeouted!')
    }
    break
  }
  console.log(colors.green(`publishing for ${opt.version} succesfully requested`))
}

export default publishVersion
