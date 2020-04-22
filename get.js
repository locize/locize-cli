const colors = require('colors');
const request = require('./request');
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

  if (opt.key && opt.key.indexOf(',') > 0 && opt.key.indexOf(' ') < 0) {
    opt.keys = opt.key.split(',');
    delete opt.key;
  }

  request(url, {
    method: 'get'
  }, (err, res, obj) => {
    if (err) {
      if (!cb) console.log(colors.red(`get failed for ${opt.key || opt.keys.join(', ')} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      if (err) {
        if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
        if (cb) cb(err);
        return;
      }
    }
    if (res.status >= 300) {
      if (!cb) { console.error(colors.red(res.statusText + ' (' + res.status + ')')); process.exit(1); }
      if (cb) cb(new Error(res.statusText + ' (' + res.status + ')'));
      return;
    }
    // if (!cb) console.log(colors.green(`got ${opt.opt.key || opt.keys.join(', ')} from ${opt.version}/${opt.language}/${opt.namespace}...`));

    const flat = flatten(obj);
    if (opt.key) {
      if (!flat[opt.key]) {
        if (!cb) { console.error(colors.red(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`)); process.exit(1); }
        if (cb) cb(new Error(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`));
        return;
      }
      if (!cb) console.log(flat[opt.key]);
    }
    if (opt.keys) {
      const ret = {};
      const retWitAllKeys = {};
      opt.keys.forEach((k) => {
        if (flat[k] !== undefined) {
          ret[k] = flat[k];
        }
        retWitAllKeys[k] = flat[k];
      });
      const retKeys = Object.keys(ret);
      if (retKeys.length === 0) {
        if (!cb) { console.error(colors.red(`${opt.keys.join(', ')} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`)); process.exit(1); }
        if (cb) cb(new Error(`${opt.keys.join(', ')} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`));
        return;
      }
      if (!cb) {
        if (console.table) {
          console.table(retWitAllKeys);
        } else {
          opt.keys.forEach((k) => {
            console.log(`${k}\t=>\t${ret[k] || ''}`);
          });
        }
      }
    }
    if (cb) cb(null);
  });
};

module.exports = get;
