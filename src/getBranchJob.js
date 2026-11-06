import colors from 'colors'
import getJob from './getJob.js'
import getBranches from './getBranches.js'

// Polls a job on a branch (delete-branch, merge-branch --delete). Once the branch is
// deleted, its project is gone and the API refuses the poll (401/403): if the parent no
// longer lists the branch, the job finished. Any other failure fails the run as before.
const getBranchJob = async (opt, jobId) => {
  try {
    return await getJob({ apiEndpoint: opt.apiEndpoint, apiKey: opt.apiKey, projectId: opt.branch }, jobId, true)
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      const branches = await getBranches(opt)
      if (branches && !branches.some((b) => b.id === opt.branch)) return null
    }
    console.log(colors.red('getting job failed...'))
    console.error(colors.red(err.message))
    throw err
  }
}

export default getBranchJob
