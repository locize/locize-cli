const fs = require('fs');
const path = require('path');
const flatten = require('flat');
const async = require('async');
const colors = require('colors');
const request = require('request');

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function(file) {
    return !fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

const load = (namespaces, cb) => {
  async.each(namespaces, (ns, done) => {
    fs.readFile(ns.path, 'utf8', (err, data) => {
      if (err) return done(err);
      try {
        ns.value = flatten(JSON.parse(data));
      } catch (err) {
        console.error(colors.red(err.stack));
        ns.value = {};
      }
      done();
    });
  }, (err) => cb(err, namespaces));
};

const parseLanguage = (p, cb) => {
  const dirs = getDirectories(p);

  const namespaces = [];

  dirs.forEach((lng) => {
    const files = getFiles(path.join(p, lng));

    files.forEach((file) => {
      namespaces.push({
        language: lng,
        namespace: path.basename(file, '.json'),
        path: path.join(p, lng, file)
      });
    });
  });

  load(namespaces, cb);
};

const transfer = (opt, ns, cb) => {
  var url = opt.addPath
              .replace('{{projectId}}', opt.projectId)
              .replace('{{ver}}', opt.version)
              .replace('{{version}}', opt.version)
              .replace('{{language}}', ns.language)
              .replace('{{lng}}', ns.language)
              .replace('{{ns}}', ns.namespace)
              .replace('{{namespace}}', ns.namespace);

  console.log(colors.yellow(`transfering ${opt.version}/${ns.language}/${ns.namespace}...`));

  request({
    method: 'POST',
    json: true,
    url: url,
    body: ns.value,
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && obj.errorMessage)) {
      console.log(colors.red(`transfer failed for ${opt.version}/${ns.language}/${ns.namespace}...`));

      if (err) return cb(err);
      if (obj && obj.errorMessage) return cb(new Error(obj.errorMessage));
    }
    console.log(colors.green(`transfered ${opt.version}/${ns.language}/${ns.namespace}...`));
    cb(null);
  });
};

const upload = (opt, nss, cb) => {
  async.each(
    nss,
    (ns, done) => transfer(opt, ns, done),
    cb
  );
};

const migrate = (opt) => {
  if (opt.format !== 'json') throw new Error(`Format ${opt.format} is not accepted!`)

  if (opt.language) {
    const files = getFiles(opt.path);

    const namespaces = files.map((file) => {
      return {
        language: opt.language,
        namespace: path.basename(file, '.json'),
        path: path.join(opt.path, file)
      };
    });

    load(namespaces, (err, nss) => {
      if (err) return console.error(colors.red(err.stack));
      upload(opt, nss, (err) => {
        if (err) {
          console.error(colors.red(err.stack));
          process.exit(1);
          return;
        }
        console.log(colors.green('FINISHED'));
      });
    });
    return;
  }

  if (opt.parseLanguage) {
    parseLanguage(opt.path, (err, nss) => {
      if (err) return console.error(colors.red(err.stack));
      upload(opt, nss, (err) => {
        if (err) {
          console.error(colors.red(err.stack));
          process.exit(1);
          return;
        }
        console.log(colors.green('FINISHED'));
      });
    });
    return;
  }
};

module.exports = migrate;
