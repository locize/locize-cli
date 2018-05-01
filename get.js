const colors = require('colors');
const request = require('request');
const flatten = require('flat');

const get = (opt, cb) => {
  const url = opt.getPath
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', opt.language)
    .replace('{{lng}}', opt.language)
    .replace('{{ns}}', opt.namespace)
    .replace('{{namespace}}', opt.namespace);

  // if (!cb) console.log(colors.yellow(`getting ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));

  request({
    method: 'GET',
    json: true,
    url: url
  }, (err, res, obj) => {
    if (err) {
      if (!cb) console.log(colors.red(`get failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      if (err) {
        if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
        if (cb) cb(err);
        return;
      }
    }
    if (res.statusCode >= 300) {
      if (!cb) { console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')')); process.exit(1); }
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }
    // if (!cb) console.log(colors.green(`got ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));

    const flat = flatten(obj);
    if (!flat[opt.key]) {
      if (!cb) { console.error(colors.red(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`)); process.exit(1); }
      if (cb) cb(new Error(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`));
      return;
    }
    if (!cb) console.log(flat[opt.key]);
    if (cb) cb(null);
  });
};

module.exports = get;
