const colors = require('colors');
const request = require('request');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const download = (opt, cb) => {

  var url = opt.apiPath + '/download/' + opt.projectId;

  if (opt.version) {
    url += '/' + opt.version;
    if (opt.language) {
      url += '/' + opt.language;
      if (opt.namespace) {
        url += '/' + opt.namespace;
      }
    }
  }

  console.log(colors.yellow(`downloading ${url} to ${opt.target}...`));

  request({
    method: 'GET',
    json: true,
    url: url
  }, (err, res, obj) => {
    if (err || (obj && obj.errorMessage)) {
      console.log(colors.red(`download failed for ${url} to ${opt.target}...`));

      if (err) return console.error(colors.red(err.message));
      if (obj && obj.errorMessage) return console.error(colors.red(obj.errorMessage));
    }
    if (res.statusCode >= 300) return console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));

    obj.forEach((entry) => {
      const pathToLocalFile = path.join(opt.target, entry.key);
      mkdirp.sync(path.dirname(pathToLocalFile));

      request(entry.url).pipe(fs.createWriteStream(pathToLocalFile));
    });

    console.log(colors.green(`downloaded ${url} to ${opt.target}...`));
  });
};

module.exports = download;
