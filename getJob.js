const colors = require('colors');
const request = require('request');

const getJob = (opt, jobId, cb) => {
  request({
    method: 'GET',
    json: true,
    url: opt.apiPath + '/jobs/' + opt.projectId + '/' + jobId,
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`getting job failed for ${opt.version}...`));

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
    if (res.statusCode === 404) {
      if (!cb) console.error(colors.yellow(res.statusMessage + ' (' + res.statusCode + ')'));
      if (cb) cb(null, null);
      return;
    }
    if (res.statusCode >= 300) {
      if (!cb) console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }
    if (!cb) console.log(colors.green(`getting job for ${opt.version} succesfull`));
    if (cb) cb(null);
  });
};

module.exports = getJob;
