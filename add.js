const colors = require('colors');
const request = require('request');

const add = (opt, cb) => {
  const url = opt.addPath
              .replace('{{projectId}}', opt.projectId)
              .replace('{{ver}}', opt.version)
              .replace('{{version}}', opt.version)
              .replace('{{language}}', opt.language)
              .replace('{{lng}}', opt.language)
              .replace('{{ns}}', opt.namespace)
              .replace('{{namespace}}', opt.namespace);

  if (!cb) console.log(colors.yellow(`adding ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));

  var data = {};
  data[opt.key] = opt.value || null; // null will remove the key

  request({
    method: 'POST',
    json: true,
    url: url,
    body: data,
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && obj.errorMessage)) {
      if (!cb) console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));

      if (err) {
        if (!cb) console.error(colors.red(err.message));
        if (cb) cb(err);
        return;
      }
      if (obj && obj.errorMessage) {
        if (!cb) console.error(colors.red(obj.errorMessage));
        if (cb) cb(new Error(obj.errorMessage));
        return;
      }
    }
    if (res.statusCode >= 300) {
      if (!cb) console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }
    if (!cb) console.log(colors.green(`added ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
    if (cb) cb(null);
  });
};

module.exports = add;
