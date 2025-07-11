const colors = require('colors');
const request = require('./request');
const getJob = require('./getJob');

const copyVersion = (opt, cb) => {
  const queryParams = new URLSearchParams();
  if (opt.ignoreIfVersionExists) {
    queryParams.append('ignoreIfVersionExists', 'true');
  }
  const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : '';
  request(opt.apiPath + '/copy/' + opt.projectId + '/version/' + opt.fromVersion + '/' + opt.toVersion + queryString, {
    method: 'post',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`copy failed from ${opt.fromVersion} to ${opt.toVersion}...`));

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

        if (!cb) console.log(colors.green(`copy from ${opt.fromVersion} to ${opt.toVersion} succesfully requested`));
        if (cb) cb(null);
      });
    })();
  });
};

module.exports = copyVersion;
