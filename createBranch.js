const colors = require('colors');
const request = require('./request');

const createBranch = (opt, cb) => {
  request(opt.apiPath + '/branch/create/' + opt.projectId + '/' + opt.version, {
    method: 'post',
    headers: {
      'Authorization': opt.apiKey
    },
    body: { name: opt.branch }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red('creating branch failed...'));

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
    if (!cb) console.log(colors.green('creating branch "' + obj.name + '" (' + obj.id + ') successful'));
    if (cb) cb(null, obj);
  });
};

module.exports = createBranch;
