const colors = require('colors');
const request = require('request');

const copyVersion = (opt, cb) => {
  request({
    method: 'POST',
    json: true,
    url: opt.apiPath + '/copy/' + opt.projectId + '/version/' + opt.fromVersion + '/' + opt.toVersion,
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`copy failed from ${opt.fromVersion} to ${opt.toVersion}...`));

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
    if (!cb) console.log(colors.green(`copy from ${opt.fromVersion} to ${opt.toVersion} succesfully requested`));
    if (cb) cb(null);
  });
};

module.exports = copyVersion;
