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

  console.log(colors.yellow(`adding ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));

  var data = {};
  data[opt.key] = opt.value;

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
      console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));

      if (err) return console.error(colors.red(err.message));
      if (obj && obj.errorMessage) return console.error(colors.red(obj.errorMessage));
    }
    console.log(colors.green(`added ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
  });
};

module.exports = add;
