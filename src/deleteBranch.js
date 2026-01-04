import colors from 'colors'
import request from './request.js'
import getBranches from './getBranches.js'
import getJob from './getJob.js'
import isValidUuid from './isValidUuid.js'

const handleError = (err) => {
  if (err) {
    console.error(colors.red(err.stack))
    process.exit(1)
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const deleteBranch = async (opt) => {
  const { res, obj, err } = await request(opt.apiEndpoint + '/branch/' + opt.branch, {
    method: 'delete',
    headers: {
      Authorization: opt.apiKey
    }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    console.log(colors.red('deleting branch failed...'))
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

  if (!obj || !obj.jobId) {
    console.error(colors.red('No jobId! Something went wrong!'))
    throw new Error('No jobId! Something went wrong!')
  }

  let job
  while (true) {
    job = await getJob({
      apiEndpoint: opt.apiEndpoint,
      apiKey: opt.apiKey,
      projectId: opt.branch
    }, obj.jobId)
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
  console.log(colors.green(`deleting branch "${opt.branch}" succesfully requested`))
  // done
}

const deleteBranchEntry = async (opt) => {
  let branches
  try {
    branches = await getBranches(opt)
  } catch (err) {
    handleError(err)
  }
  let b
  if (isValidUuid(opt.branch)) b = branches.find((br) => br.id === opt.branch)
  if (!b) b = branches.find((br) => br.name === opt.branch)
  if (!b) {
    handleError(new Error(`Branch ${opt.branch} not found!`))
  }
  opt.branch = b.id
  await deleteBranch(opt)
}
export default deleteBranchEntry
