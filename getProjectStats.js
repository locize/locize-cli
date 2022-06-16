const colors = require('colors');
const request = require('./request');

const getProjectStats = (opt, cb) => {
  request(opt.apiPath + '/stats/project/' + opt.projectId, {
    method: 'get',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red('getting job failed...'));

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
    if (!cb) console.log(colors.green('getting project stats succesfull'));
    if (cb) cb(null, obj);
  });
};

module.exports = getProjectStats;
