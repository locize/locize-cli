const colors = require('colors');
const request = require('request');

const deleteNamespace = (opt, cb) => {
  const url = opt.apiPath + '/delete/' + opt.projectId + '/' + opt.version + '/' + opt.namespace;

  if (!cb) console.log(colors.yellow(`deleting ${opt.namespace} from ${opt.version}...`));

  request({
    method: 'DELETE',
    json: true,
    url: url,
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
    if (res.statusCode >= 300) {
      if (!cb) { console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')')); process.exit(1); }
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }
    if (!cb) console.log(colors.green(`deleted ${opt.namespace} from ${opt.version}...`));
    if (cb) cb(null);
  });
};

module.exports = deleteNamespace;
