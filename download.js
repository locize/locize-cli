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

  if (!cb) console.log(colors.yellow(`downloading ${url} to ${opt.target}...`));

  request({
    method: 'GET',
    json: true,
    url: url
  }, (err, res, obj) => {
    if (err || (obj && obj.errorMessage)) {
      if (!cb) console.log(colors.red(`download failed for ${url} to ${opt.target}...`));

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

    obj.forEach((entry) => {
      const pathToLocalFile = path.join(opt.target, entry.key);
      mkdirp.sync(path.dirname(pathToLocalFile));

      request(entry.url).pipe(fs.createWriteStream(pathToLocalFile));
    });

    if (!cb) console.log(colors.green(`downloaded ${url} to ${opt.target}...`));
    if (cb) cb(null);
  });
};

module.exports = download;
