const colors = require('colors');
const request = require('request');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const async = require('async');
const flatten = require('flat');
const js2asr = require('android-string-resource/js2asr');
const stringsFile = require('strings-file');
const createxliff = require('xliff/createxliff');
const createxliff12 = require('xliff/createxliff12');
const csvjson = require('csvjson');
const i18nextToPo = require('i18next-conv').i18nextToPo;
const xlsx = require('xlsx');
const jsyaml = require('js-yaml');
const js2resx = require('resx/js2resx');
const js2tmx = require('tmexchange/js2tmx');

function handleDownload(opt, url, err, res, obj, cb) {
  if (err || (obj && (obj.errorMessage || obj.message))) {
    if (!cb) console.log(colors.red(`download failed for ${url} to ${opt.target}...`));

    if (err) {
      if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
      if (cb) cb(err);
      return;
    }
    if (obj && (obj.errorMessage || obj.message)) {
      if (!cb) { console.error(colors.red((obj.errorMessage || obj.message))); process.exit(1); }
      if (cb) cb(new Error((obj.errorMessage || obj.message)));
      return;
    }
  }
  if (res.statusCode >= 300) {
    if (!cb) { console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')')); process.exit(1); }
    if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
    return;
  }

  const localFiles = [];

  async.series([
    (cb) => {
      async.forEach(obj, (entry, cb) => {
        if (entry.isPrivate) {
          entry.key = entry.key.substring(8);
        }
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
          pathToLocalFile: pathToLocalFile,
          isPrivate: entry.isPrivate
        });

        const fsStream = fs.createWriteStream(pathToLocalFile);
        fsStream.on('close', cb);
        request({
          method: 'GET',
          url: entry.url,
          headers: opt.apiKey ? {
            'Authorization': opt.apiKey
          } : undefined
        }).pipe(fsStream);
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
          if (opt.format !== 'yaml') return cb();
          async.forEach(localFiles, (f, cb) => {
            const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.yaml';
            fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
              if (err) return cb(err);
              try {
                const js = flatten(JSON.parse(data));
                if (opt.skipEmpty && Object.keys(js).length === 0) {
                  return fs.unlink(f.pathToLocalFile, cb);
                }

                fs.writeFile(newFilePath, jsyaml.safeDump(js), 'utf8', (err) => {
                  if (err) return cb(err);
                  fs.unlink(f.pathToLocalFile, cb);
                });
              } catch (err) {
                cb(err);
              }
            });
          }, cb);
        },
        (cb) => {
          if (opt.format !== 'yaml-rails') return cb();
          async.forEach(localFiles, (f, cb) => {
            const splittedKey = f.key.split('/');
            const ns = splittedKey[splittedKey.length - 1];
            const lng = splittedKey[splittedKey.length - 2];
            const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.yaml';
            fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
              if (err) return cb(err);
              try {
                const js = JSON.parse(data);
                if (opt.skipEmpty && Object.keys(js).length === 0) {
                  return fs.unlink(f.pathToLocalFile, cb);
                }

                var extendedJs = {};
                extendedJs[lng] = {};
                extendedJs[lng][ns] = js;
                fs.writeFile(newFilePath, jsyaml.safeDump(extendedJs), 'utf8', (err) => {
                  if (err) return cb(err);
                  fs.unlink(f.pathToLocalFile, cb);
                });
              } catch (err) {
                cb(err);
              }
            });
          }, cb);
        },
        (cb) => {
          if (opt.format !== 'resx') return cb();
          async.forEach(localFiles, (f, cb) => {
            const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.resx';
            fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
              if (err) return cb(err);
              try {
                const js = flatten(JSON.parse(data));
                if (opt.skipEmpty && Object.keys(js).length === 0) {
                  return fs.unlink(f.pathToLocalFile, cb);
                }

                js2resx(js, (err, res) => {
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
          if (opt.format !== 'strings') return cb();
          async.forEach(localFiles, (f, cb) => {
            const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.xml';
            fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
              if (err) return cb(err);
              try {
                const js = flatten(JSON.parse(data));
                if (opt.skipEmpty && Object.keys(js).length === 0) {
                  return fs.unlink(f.pathToLocalFile, cb);
                }
                Object.keys(js).forEach((k) => {
                  if (js[k] === null) delete js[k];
                });
                const res = stringsFile.compile(js);
                fs.writeFile(newFilePath, res, 'utf8', (err) => {
                  if (err) return cb(err);
                  fs.unlink(f.pathToLocalFile, cb);
                });
              } catch (err) {
                cb(err);
              }
            });
          }, cb);
        },
        (cb) => {
          if (opt.format !== 'po' && opt.format !== 'gettext') return cb();
          async.forEach(localFiles, (f, cb) => {
            const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.po';
            fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
              if (err) return cb(err);
              try {
                const js = JSON.parse(data);
                if (opt.skipEmpty && Object.keys(js).length === 0) {
                  return fs.unlink(f.pathToLocalFile, cb);
                }

                Object.keys(js).forEach((k) => {
                  if (js[k] === null) js[k] = '';
                });

                const splittedKey = f.pathToLocalFile.split('/');
                // const ns = splittedKey[splittedKey.length - 1];
                const lng = splittedKey[splittedKey.length - 2];
                // const version = splittedKey[splittedKey.length - 3];
                // const projId = splittedKey[splittedKey.length - 4];

                const options = { project: 'locize', language: lng };
                i18nextToPo(lng, JSON.stringify(js), options)
                  .then((res) => {
                    fs.writeFile(newFilePath, res, 'utf8', (err) => {
                      if (err) return cb(err);
                      fs.unlink(f.pathToLocalFile, cb);
                    });
                  }, (err) => cb(err));
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
                url: opt.apiPath + (f.isPrivate ? '/private' : '') + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
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
                        [opt.referenceLanguage]: (refItem[k] || '').replace(/"/g, '""'),
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
            url: opt.apiPath + '/languages/' + opt.projectId + '?ts=' + Date.now()
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
          if (opt.format !== 'xlsx') return cb();

          function processXLSX() {
            async.forEach(localFiles, (f, cb) => {
              const splittedKey = f.key.split('/');
              const ns = splittedKey[splittedKey.length - 1];
              const lng = splittedKey[splittedKey.length - 2];
              const version = splittedKey[splittedKey.length - 3];
              const projId = splittedKey[splittedKey.length - 4];

              request({
                method: 'GET',
                json: true,
                url: opt.apiPath + (f.isPrivate ? '/private' : '') + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
              }, (err, res, obj) => {
                if (err || (obj && (obj.errorMessage || obj.message))) {
                  if (err) return cb(err);
                  if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
                }
                if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

                const refNs = flatten(obj);
                const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.xlsx';
                fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                  if (err) return cb(err);
                  try {
                    const js = flatten(JSON.parse(data));

                    if (opt.skipEmpty && Object.keys(js).length === 0) {
                      return fs.unlink(f.pathToLocalFile, cb);
                    }

                    const js2XlsxData = Object.keys(js).reduce((mem, k) => {
                      const refItem = refNs[k];
                      if (!refItem) return mem;

                      const value = js[k] || '';
                      const line = {
                        key: k,
                        [opt.referenceLanguage]: refItem[k] || '',
                        [lng]: value
                      };
                      mem.push(line);

                      return mem;
                    }, []);

                    const worksheet = xlsx.utils.json_to_sheet(js2XlsxData);
                    const workbook = xlsx.utils.book_new();
                    workbook.SheetNames.push(ns);
                    workbook.Sheets[ns] = worksheet;

                    const wbout = xlsx.write(workbook, { type: 'binary' });

                    fs.writeFile(newFilePath, wbout, 'utf8', (err) => {
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

          if (opt.referenceLanguage) return processXLSX();

          request({
            method: 'GET',
            json: true,
            url: opt.apiPath + '/languages/' + opt.projectId + '?ts=' + Date.now()
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
              return processXLSX();
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
                url: opt.apiPath + (f.isPrivate ? '/private' : '') + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
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
            url: opt.apiPath + '/languages/' + opt.projectId + '?ts=' + Date.now()
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
        },
        (cb) => {
          if (opt.format !== 'tmx') return cb();

          function processTmx() {
            async.forEach(localFiles, (f, cb) => {
              const splittedKey = f.key.split('/');
              const ns = splittedKey[splittedKey.length - 1];
              const lng = splittedKey[splittedKey.length - 2];
              const version = splittedKey[splittedKey.length - 3];
              const projId = splittedKey[splittedKey.length - 4];

              request({
                method: 'GET',
                json: true,
                url: opt.apiPath + (f.isPrivate ? '/private' : '') + '/' + projId + '/' + version + '/' + opt.referenceLanguage + '/' + ns
              }, (err, res, obj) => {
                if (err || (obj && (obj.errorMessage || obj.message))) {
                  if (err) return cb(err);
                  if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
                }
                if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));

                const refNs = flatten(obj);
                const newFilePath = f.pathToLocalFile.substring(0, f.pathToLocalFile.lastIndexOf('.')) + '.tmx';
                fs.readFile(f.pathToLocalFile, 'utf8', (err, data) => {
                  if (err) return cb(err);
                  try {
                    const js = flatten(JSON.parse(data));
                    if (opt.skipEmpty && Object.keys(js).length === 0) {
                      return fs.unlink(f.pathToLocalFile, cb);
                    }

                    const js2TmxData = Object.keys(js).reduce((mem, k) => {
                      const refItem = refNs[k];
                      if (!refItem) return mem;

                      const value = js[k] || '';
                      mem.resources[ns][k] = {};
                      mem.resources[ns][k][opt.referenceLanguage] = refItem;
                      mem.resources[ns][k][lng] = value;

                      return mem;
                    }, {
                      resources: {
                        [ns]: {}
                      },
                      sourceLanguage: opt.referenceLanguage
                    });

                    js2tmx(js2TmxData, (err, res) => {
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
              });
            }, cb);
          }

          if (opt.referenceLanguage) return processTmx();

          request({
            method: 'GET',
            json: true,
            url: opt.apiPath + '/languages/' + opt.projectId + '?ts=' + Date.now()
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
              return processTmx();
            }

            cb(new Error('Please specify a referenceLanguage'));
          });
        }
      ], cb);
    }
  ], (err) => {
    if (err) {
      if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
      if (cb) cb(err);
      return;
    }

    if (!cb) console.log(colors.green(`downloaded ${url} to ${opt.target}...`));
    if (cb) cb(null);
  });
}

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
    url: url,
    headers: opt.apiKey ? {
      'Authorization': opt.apiKey
    } : undefined
  }, (err, res, obj) => {
    if (res && res.statusCode === 401) {
      opt.apiKey = null;
      request({
        method: 'GET',
        json: true,
        url: url
      }, (err, res, obj) => handleDownload(opt, url, err, res, obj, cb));
      return;
    }

    handleDownload(opt, url, err, res, obj, cb);
  });
};

module.exports = download;
