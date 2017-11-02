const colors = require('colors');
const request = require('request');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const flatten = require('flat');
const js2asr = require('android-string-resource/js2asr');
const createxliff = require('xliff/createxliff');
const createxliff12 = require('xliff/createxliff12');
const csvjson = require('csvjson');

const download = (opt, cb) => {

  if (opt.skipEmpty === undefined) opt.skipEmpty = true;
  opt.format = opt.format || 'json';
  opt.apiPath = opt.apiPath || 'https://api.locize.io/{{projectId}}/{{version}}/{{lng}}/{{ns}}';

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
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (!cb) console.log(colors.red(`download failed for ${url} to ${opt.target}...`));

      if (err) {
        if (!cb) console.error(colors.red(err.message));
        if (cb) cb(err);
        return;
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (!cb) console.error(colors.red((obj.errorMessage || obj.message)));
        if (cb) cb(new Error((obj.errorMessage || obj.message)));
        return;
      }
    }
    if (res.statusCode >= 300) {
      if (!cb) console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')'));
      if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      return;
    }

    const localFiles = [];

    async.series([
      (cb) => {
        async.forEach(obj, (entry, cb) => {
          var pathToLocalFile = path.join(opt.target, entry.key + (opt.extension || '.json'));
          // trim the projectId
          var trimmedKey = entry.key;
          if (pathToLocalFile.indexOf(opt.projectId + path.sep) > -1) {
            pathToLocalFile = pathToLocalFile.replace(opt.projectId + path.sep, '');
            trimmedKey = trimmedKey.replace(opt.projectId + path.sep, '');
          }
          // trim version if specified
          if (opt.version) {
            pathToLocalFile = pathToLocalFile.replace(opt.version + path.sep, '');
            trimmedKey = trimmedKey.replace(opt.version + path.sep, '');
          }

          mkdirp.sync(path.dirname(pathToLocalFile));
          localFiles.push({
            key: entry.key,
            trimmedKey: trimmedKey,
            pathToLocalFile: pathToLocalFile
          });

          const fsStream = fs.createWriteStream(pathToLocalFile);
          fsStream.on('close', cb);
          request(entry.url).pipe(fsStream);
        }, cb);
      },
      (cb) => {
        async.parallel([
          (cb) => {
            if (opt.format !== 'json' || !opt.skipEmpty) return cb();
            async.forEach(localFiles, (f, cb) => {
              fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                if (err) return cb(err);
                try {
                  const parsedData = JSON.parse(data);
                  if (Object.keys(parsedData).length === 0) {
                    fs.unlink(f.pathToLocalFile, cb);
                  } else {
                    cb();
                  }
                } catch (err) {
                  cb(err);
                }
              });
            }, cb);
          },
          (cb) => {
            if (opt.format !== 'flat') return cb();
            async.forEach(localFiles, (f, cb) => {
              fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                if (err) return cb(err);
                try {
                  const flatted = flatten(JSON.parse(data));
                  if (opt.skipEmpty && Object.keys(flatted).length === 0) {
                    return fs.unlink(f.pathToLocalFile, cb);
                  }
                  var sorted = {};
                  Object.keys(flatted).sort().forEach((k) => sorted[k] = flatted[k]);
                  const newString = JSON.stringify(sorted, null, 2);
                  fs.writeFile(f.pathToLocalFile, newString, 'utf8', cb);
                } catch (err) {
                  cb(err);
                }
              });
            }, cb);
          },
          (cb) => {
            if (opt.format !== 'android') return cb();
            async.forEach(localFiles, (f, cb) => {
              const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.xml';
              fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                if (err) return cb(err);
                try {
                  const js = flatten(JSON.parse(data));
                  if (opt.skipEmpty && Object.keys(js).length === 0) {
                    return fs.unlink(f.pathToLocalFile, cb);
                  }
                  js2asr(js, (err, res) => {
                    if (err) return cb(err);
                    fs.writeFile(newFilePath, res, 'utf8', (err) => {
                      if (err) return cb(err);
                      fs.unlink(f.pathToLocalFile, cb);
                    });
                  });
                } catch (err) {
                  cb(err);
                }
              });
            }, cb);
          },
          (cb) => {
            if (opt.format !== 'csv') return cb();

            const options = {
              delimiter: ',',
              wrap: true,
              headers: 'relative',
              // objectDenote: '.',
              // arrayDenote: '[]'
            };

            function processCSV() {
              async.forEach(localFiles, (f, cb) => {
                const splittedKey = f.key.split('/');
                const ns = splittedKey[splittedKey.length - 1];
                const lng = splittedKey[splittedKey.length - 2];
                const version = splittedKey[splittedKey.length - 3];
                const projId = splittedKey[splittedKey.length - 4];

                request({
                  method: 'GET',
                  json: true,
                  url: opt.apiPath + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
                }, (err, res, obj) => {
                  if (err || (obj && (obj.errorMessage || obj.message))) {
                    if (err) return cb(err);
                    if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
                  }
                  if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

                  const refNs = flatten(obj);
                  const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.csv';
                  fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                    if (err) return cb(err);
                    try {
                      const js = flatten(JSON.parse(data));

                      if (opt.skipEmpty && Object.keys(js).length === 0) {
                        return fs.unlink(f.pathToLocalFile, cb);
                      }

                      const js2CsvData = Object.keys(js).reduce((mem, k) => {
                        const refItem = refNs[k];
                        if (!refItem) return mem;

                        const value = js[k] || '';
                        const line = { // https://en.wikipedia.org/wiki/Delimiter-separated_values
                          key: k.replace(/"/g, '""'),
                          [opt.referenceLanguage]: value.replace(/"/g, '""'),
                          [lng]: value.replace(/"/g, '""')
                        };
                        mem.push(line);

                        return mem;
                      }, []);

                      fs.writeFile(newFilePath, csvjson.toCSV(js2CsvData, options), 'utf8', (err) => {
                        if (err) return cb(err);
                        fs.unlink(f.pathToLocalFile, cb);
                      });
                    } catch (err) {
                      cb(err);
                    }
                  });
                });
              }, cb);
            }

            if (opt.referenceLanguage) return processCSV();

            request({
              method: 'GET',
              json: true,
              url: opt.apiPath + '/languages/' + opt.projectId
            }, (err, res, obj) => {
              if (err || (obj && (obj.errorMessage || obj.message))) {
                if (err) return cb(err);
                if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
              }
              if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

              const lngs = Object.keys(obj);
              var foundRefLng = null;
              lngs.forEach((l) => {
                if (obj[l].isReferenceLanguage) foundRefLng = l;
              });
              if (foundRefLng) {
                opt.referenceLanguage = foundRefLng;
                return processCSV();
              }

              cb(new Error('Please specify a referenceLanguage'));
            });
          },
          (cb) => {
            if (opt.format !== 'xliff2' && opt.format !== 'xliff12') return cb();
            const fn = opt.format === 'xliff12' ? createxliff12 : createxliff;

            function processXliff() {
              async.forEach(localFiles, (f, cb) => {
                const splittedKey = f.key.split('/');
                const ns = splittedKey[splittedKey.length - 1];
                const lng = splittedKey[splittedKey.length - 2];
                const version = splittedKey[splittedKey.length - 3];
                const projId = splittedKey[splittedKey.length - 4];

                request({
                  method: 'GET',
                  json: true,
                  url: opt.apiPath + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
                }, (err, res, obj) => {
                  if (err || (obj && (obj.errorMessage || obj.message))) {
                    if (err) return cb(err);
                    if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
                  }
                  if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

                  const refNs = flatten(obj);
                  const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.xliff';
                  fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                    if (err) return cb(err);
                    try {
                      const js = flatten(JSON.parse(data));
                      if (opt.skipEmpty && Object.keys(js).length === 0) {
                        return fs.unlink(f.pathToLocalFile, cb);
                      }
                      fn(
                        opt.referenceLanguage,
                        lng,
                        refNs,
                        js,
                        ns,
                        (err, res) => {
                          if (err) return cb(err);
                          fs.writeFile(newFilePath, res, 'utf8', (err) => {
                            if (err) return cb(err);
                            fs.unlink(f.pathToLocalFile, cb);
                          });
                        }
                      );
                    } catch (err) {
                      cb(err);
                    }
                  });
                });
              }, cb);
            }

            if (opt.referenceLanguage) return processXliff();

            request({
              method: 'GET',
              json: true,
              url: opt.apiPath + '/languages/' + opt.projectId
            }, (err, res, obj) => {
              if (err || (obj && (obj.errorMessage || obj.message))) {
                if (err) return cb(err);
                if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
              }
              if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

              const lngs = Object.keys(obj);
              var foundRefLng = null;
              lngs.forEach((l) => {
                if (obj[l].isReferenceLanguage) foundRefLng = l;
              });
              if (foundRefLng) {
                opt.referenceLanguage = foundRefLng;
                return processXliff();
              }

              cb(new Error('Please specify a referenceLanguage'));
            });
          }
        ], cb);
      }
    ], (err) => {
      if (err) {
        if (!cb) console.error(colors.red(err.message));
        if (cb) cb(err);
        return;
      }

      if (!cb) console.log(colors.green(`downloaded ${url} to ${opt.target}...`));
      if (cb) cb(null);
    });
  });
};

module.exports = download;
