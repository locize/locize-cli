const colors = require('colors')
const request = require('./request')
const getBranches = require('./getBranches')
const getJob = require('./getJob')
const isValidUuid = require('./isValidUuid')

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.stack))
    process.exit(1)
  }
  if (cb) cb(err)
}

const deleteBranch = (opt, cb) => {
  request(opt.apiEndpoint + '/branch/' + opt.branch, {
    method: 'delete',
    headers: {
      Authorization: opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red('deleting branch failed...'))

      if (err) {
        if (!cb) { console.error(colors.red(err.message)); process.exit(1) }
        if (cb) cb(err)
        return
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (!cb) { console.error(colors.red((obj.errorMessage || obj.message))); process.exit(1) }
        if (cb) cb(new Error((obj.errorMessage || obj.message)))
        return
      }
    }
    if (res.status === 404) {
      if (!cb) { console.error(colors.yellow(res.statusText + ' (' + res.status + ')')); process.exit(1) }
      if (cb) cb(null, null)
      return
    }
    if (res.status >= 300) {
      if (!cb) { console.error(colors.red(res.statusText + ' (' + res.status + ')')); process.exit(1) }
      if (cb) cb(new Error(res.statusText + ' (' + res.status + ')'))
      return
    }

    if (!obj || !obj.jobId) {
      if (!cb) { console.error(colors.red('No jobId! Something went wrong!')); process.exit(1) }
      if (cb) cb(new Error('No jobId! Something went wrong!'))
      return
    }

    (function waitForJob () {
      getJob({
        apiEndpoint: opt.apiEndpoint,
        apiKey: opt.apiKey,
        projectId: opt.branch
      }, obj.jobId, (err, job) => {
        if (err) {
          if (!cb) { console.error(colors.red(err.message)); process.exit(1) }
          if (cb) cb(err)
          return
        }

        if (job && !job.timeouted) {
          setTimeout(waitForJob, 2000)
          return
        }

        if (job && job.timeouted) {
          if (!cb) { console.error(colors.red('Job timeouted!')); process.exit(1) }
          if (cb) cb(new Error('Job timeouted!'))
          return
        }

        if (!cb) console.log(colors.green(`deleting branch "${opt.branch}" succesfully requested`))
        if (cb) cb(null)
      })
    })()
  })
}

module.exports = (opt, cb) => {
  getBranches(opt, (err, branches) => {
    if (err) return handleError(err, cb)

    let b
    if (isValidUuid(opt.branch)) b = branches.find((br) => br.id === opt.branch)
    if (!b) b = branches.find((br) => br.name === opt.branch)
    if (!b) {
      return handleError(new Error(`Branch ${opt.branch} not found!`), cb)
    }
    opt.branch = b.id

    deleteBranch(opt, cb)
  })
}
