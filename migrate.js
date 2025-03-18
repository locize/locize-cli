const fs = require('fs');
const path = require('path');
const flatten = require('flat');
const async = require('async');
const colors = require('colors');
const request = require('./request');
const getRemoteLanguages = require('./getRemoteLanguages');

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
      if (path.extname(file) !== '.json') return;

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

  if (!opt.replace) url = url.replace('/update/', '/missing/');

  var data = ns.value;
  var keysToSend = Object.keys(data).length;
  if (keysToSend === 0) return cb(null);

  var payloadKeysLimit = 1000;

  function send(d, so, isFirst, clb, isRetrying) {
    const queryParams = new URLSearchParams();
    if (so) {
      queryParams.append('omitstatsgeneration', 'true');
    }
    if (isFirst && opt.replace) {
      queryParams.append('replace', 'true');
    }

    const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : '';

    request(url + queryString, {
      method: 'post',
      body: d,
      headers: {
        'Authorization': opt.apiKey
      }
    }, (err, res, obj) => {
      if (err || (obj && (obj.errorMessage || obj.message))) {
        if (url.indexOf('/missing/') > -1 && res.status === 412) {
          console.log(colors.green(`transfered ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace} (but all keys already existed)...`));
          clb(null);
          return;
        }
        if (res.status === 504 && !isRetrying) {
          return setTimeout(() => send(d, so, isFirst, clb, true), 3000);
        }
        console.log(colors.red(`transfer failed for ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace}...`));

        if (err) return clb(err);
        if (obj && (obj.errorMessage || obj.message)) return clb(new Error((obj.errorMessage || obj.message)));
      }
      if (res.status >= 300 && res.status !== 412) {
        if (obj && (obj.errorMessage || obj.message)) {
          return clb(new Error((obj.errorMessage || obj.message)));
        }
        return clb(new Error(res.statusText + ' (' + res.status + ')'));
      }
      console.log(colors.green(`transfered ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace}...`));
      clb(null);
    });
  }

  if (keysToSend > payloadKeysLimit) {
    var tasks = [];
    var keysInObj = Object.keys(data);

    while (keysInObj.length > payloadKeysLimit) {
      (function() {
        var pagedData = {};
        keysInObj.splice(0, payloadKeysLimit).forEach((k) => pagedData[k] = data[k]);
        var hasMoreKeys = keysInObj.length > 0;
        tasks.push((c) => send(pagedData, hasMoreKeys, false, c));
      })();
    }

    if (keysInObj.length === 0) return cb(null);

    var finalPagedData = {};
    keysInObj.splice(0, keysInObj.length).forEach((k) => finalPagedData[k] = data[k]);
    tasks.push((c) => send(finalPagedData, false, false, c));

    async.series(tasks, cb);
    return;
  }

  send(data, false, true, cb);
};

const upload = (opt, nss, cb) => {
  if (!opt.referenceLanguage) {
    async.eachLimit(
      nss,
      require('os').cpus().length,
      (ns, done) => transfer(opt, ns, done),
      cb
    );
    return;
  }

  const nssRefLng = nss.filter((n) => n.language === opt.referenceLanguage);
  const nssNonRefLng = nss.filter((n) => n.language !== opt.referenceLanguage);

  async.eachLimit(
    nssRefLng,
    require('os').cpus().length,
    (ns, done) => transfer(opt, ns, done),
    (err) => {
      if (err) return cb(err);
      async.eachLimit(
        nssNonRefLng,
        require('os').cpus().length,
        (ns, done) => transfer(opt, ns, done),
        cb
      );
    }
  );
};

const addLanguage = (opt, l, cb) => {
  var url = opt.apiPath + '/language/' + opt.projectId + '/' + l;

  request(url, {
    method: 'post',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      console.log(colors.red(`failed to add language ${l}...`));

      if (err) return cb(err);
      if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
    }
    if (res.status >= 300 && res.status !== 412) return cb(new Error(res.statusText + ' (' + res.status + ')'));
    console.log(colors.green(`added language ${l}...`));
    cb(null);
  });
};

const migrate = (opt, cb) => {
  if (opt.format !== 'json') {
    var err = new Error(`Format ${opt.format} is not accepted!`);
    if (!cb) throw err;
    if (cb) cb(err);
    return;
  }

  opt.apiPath = opt.apiPath || 'https://api.locize.app';

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
      if (err) {
        if (!cb) { console.error(colors.red(err.stack)); process.exit(1); }
        if (cb) cb(err);
        return;
      }
      upload(opt, nss, (err) => {
        if (err) {
          if (!cb) {
            console.error(colors.red(err.stack));
            process.exit(1);
          }
          if (cb) cb(err);
          return;
        }
        if (!cb) console.log(colors.green('FINISHED'));
        if (cb) cb(null);
      });
    });
    return;
  }

  if (opt.parseLanguage) {
    parseLanguage(opt.path, (err, nss) => {
      if (err) {
        if (!cb) console.error(colors.red(err.stack)); process.exit(1);
        if (cb) cb(err);
        return;
      }

      getRemoteLanguages(opt, (err, remoteLanguages) => {
        if (err) {
          if (!cb) { console.error(colors.red(err.stack)); process.exit(1); }
          if (cb) cb(err);
          return;
        }

        const localLanguages = [];
        nss.forEach((n) => {
          if (localLanguages.indexOf(n.language) < 0) localLanguages.push(n.language);
        });

        const notExistingLanguages = localLanguages.filter((l) => remoteLanguages.indexOf(l) < 0);

        if (notExistingLanguages.length === 0) {
          upload(opt, nss, (err) => {
            if (err) {
              if (!cb) {
                console.error(colors.red(err.stack));
                process.exit(1);
              }
              if (cb) cb(err);
              return;
            }
            if (!cb) console.log(colors.green('FINISHED'));
            if (cb) cb(null);
          });
          return;
        }

        async.eachLimit(
          notExistingLanguages,
          require('os').cpus().length,
          (l, done) => addLanguage(opt, l, done),
          (err) => {
            if (err) {
              if (!cb) {
                console.error(colors.red(err.stack));
                process.exit(1);
              }
              if (cb) cb(err);
              return;
            }
            setTimeout(() => {
              // wait a bit to make sure project is up-to-date also in cache
              upload(opt, nss, (err) => {
                if (err) {
                  if (!cb) {
                    console.error(colors.red(err.stack));
                    process.exit(1);
                  }
                  if (cb) cb(err);
                  return;
                }
                if (!cb) console.log(colors.green('FINISHED'));
                if (cb) cb(null);
              });
            }, 5000);
          }
        );
        return;
      });
    });
    return;
  }
};

module.exports = migrate;
