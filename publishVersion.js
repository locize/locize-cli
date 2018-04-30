const colors = require('colors');
const request = require('request');
const getJob = require('./getJob');

const publishVersion = (opt, cb) => {
  request({
    method: 'POST',
    json: true,
    url: opt.apiPath + '/publish/' + opt.projectId + '/' + opt.version,
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`publishing failed for ${opt.version}...`));

      if (err) {
        if (!cb) console.error(colors.red(err.message));
        if (cb) cb(err);
        return;
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (!cb) console.error(colors.red((obj.errorMessage || obj.message)));
        if (cb) cb(new Error((obj.errorMessage || obj.message)));
        return;
      }
    }
    if (res.statusCode >= 300) {
      if (!cb) console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }

    if (!obj || !obj.jobId) {
      if (!cb) console.error(colors.red('No jobId! Something went wrong!'));
      if (cb) cb(new Error('No jobId! Something went wrong!'));
      return;
    }

    (function waitForJob() {
      getJob(opt, obj.jobId, (err, job) => {
        if (err) {
          if (!cb) console.error(colors.red(err.message));
          if (cb) cb(err);
          return;
        }

        if (job && !job.timeouted) {
          setTimeout(waitForJob, 2000);
          return;
        }

        if (job && job.timeouted) {
          if (!cb) console.error(colors.red('Job timeouted!'));
          if (cb) cb(new Error('Job timeouted!'));
          return;
        }

        if (!cb) console.log(colors.green(`publishing for ${opt.version} succesfully requested`));
        if (cb) cb(null);
      });
    })();
  });
};

module.exports = publishVersion;
