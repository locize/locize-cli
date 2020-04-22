const colors = require('colors');
const request = require('./request');

const deleteNamespace = (opt, cb) => {
  const url = opt.apiPath + '/delete/' + opt.projectId + '/' + opt.version + '/' + opt.namespace;

  if (!cb) console.log(colors.yellow(`deleting ${opt.namespace} from ${opt.version}...`));

  request(url, {
    method: 'delete',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`delete failed for ${opt.namespace} from ${opt.version}...`));

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
    if (!cb) console.log(colors.green(`deleted ${opt.namespace} from ${opt.version}...`));
    if (cb) cb(null);
  });
};

module.exports = deleteNamespace;
