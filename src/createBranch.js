import colors from 'colors'
import request from './request.js'
import getBranches from './getBranches.js'

const handleError = (err) => {
  if (err) {
    console.error(colors.red(err.stack))
    process.exit(1)
  }
}

const createBranch = async (opt) => {
  let branches
  try {
    branches = await getBranches(opt)
  } catch (err) {
    handleError(err)
  }

  const b = branches && branches.find((br) => br.name === opt.branch)
  if (b) {
    console.log(colors.green('creating branch "' + b.name + '" (' + b.id + ') not necessary, because already existing'))
    return b
  }

  const { res, obj, err } = await request(opt.apiEndpoint + '/branch/create/' + opt.projectId + '/' + opt.version, {
    method: 'post',
    headers: {
      Authorization: opt.apiKey
    },
    body: { name: opt.branch }
  })

  if (err || (obj && (obj.errorMessage || obj.message))) {
    console.log(colors.red('creating branch failed...'))
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
  console.log(colors.green('creating branch "' + obj.name + '" (' + obj.id + ') successful'))
  return obj
}

export default createBranch
