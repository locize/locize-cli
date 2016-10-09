const colors = require('colors');
const request = require('request');
const flatten = require('flat');

const add = (opt, cb) => {
  const url = opt.getPath
              .replace('{{projectId}}', opt.projectId)
              .replace('{{ver}}', opt.version)
              .replace('{{version}}', opt.version)
              .replace('{{language}}', opt.language)
              .replace('{{lng}}', opt.language)
              .replace('{{ns}}', opt.namespace)
              .replace('{{namespace}}', opt.namespace);

  // console.log(colors.yellow(`getting ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));

  request({
    method: 'GET',
    json: true,
    url: url
  }, (err, res, obj) => {
    if (err) {
      console.log(colors.red(`get failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      if (err) return console.error(colors.red(err.message));
    }
    if (res.statusCode >= 300) return console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));
    // console.log(colors.green(`got ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));

    const flat = flatten(obj);
    if (!flat[opt.key]) return console.error(colors.red(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`));
    console.log(flat[opt.key]);
  });
};

module.exports = add;
