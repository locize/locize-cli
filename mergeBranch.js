const colors = require('colors');
const request = require('./request');
const getBranches = require('./getBranches');
const isValidUuid = require('./isValidUuid');
const getJob = require('./getJob');

const mergeBranch = (opt, cb) => {
  const queryParams = new URLSearchParams();
  if (opt.delete) {
    queryParams.append('delete', 'true');
  }
  const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : '';
  request(opt.apiPath + '/branch/merge/' + opt.branch + queryString, {
    method: 'post',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red('merging branch failed...'));

      if (err) {
        if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
        if (cb) cb(err);
        return;
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (!cb) { console.error(colors.red((obj.errorMessage || obj.message))); process.exit(1); }
        if (cb) cb(new Error((obj.errorMessage || obj.message)));
        return;
      }
    }
    if (res.status === 404) {
      if (!cb) { console.error(colors.yellow(res.statusText + ' (' + res.status + ')')); process.exit(1); }
      if (cb) cb(null, null);
      return;
    }
    if (res.status >= 300) {
      if (!cb) { console.error(colors.red(res.statusText + ' (' + res.status + ')')); process.exit(1); }
      if (cb) cb(new Error(res.statusText + ' (' + res.status + ')'));
      return;
    }

    if (!obj || !obj.jobId) {
      if (!cb) { console.error(colors.red('No jobId! Something went wrong!')); process.exit(1); }
      if (cb) cb(new Error('No jobId! Something went wrong!'));
      return;
    }

    (function waitForJob() {
      getJob(opt, obj.jobId, (err, job) => {
        if (err) {
          if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
          if (cb) cb(err);
          return;
        }

        if (job && !job.timeouted) {
          setTimeout(waitForJob, 2000);
          return;
        }

        if (job && job.timeouted) {
          if (!cb) { console.error(colors.red('Job timeouted!')); process.exit(1); }
          if (cb) cb(new Error('Job timeouted!'));
          return;
        }

        if (!cb) console.log(colors.green('merging branch successful'));
        if (cb) cb(null);
      });
    })();
  });
};

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.stack));
    process.exit(1);
  }
  if (cb) cb(err);
};

module.exports = (opt, cb) => {
  getBranches(opt, (err, branches) => {
    if (err) return handleError(err, cb);

    let b;
    if (isValidUuid(opt.branch)) b = branches.find((br) => br.id === opt.branch);
    if (!b) b = branches.find((br) => br.name === opt.branch);
    if (!b) {
      return handleError(new Error(`Branch ${opt.branch} not found!`), cb);
    }
    opt.branch = b.id;

    mergeBranch(opt, cb);
  });
};
