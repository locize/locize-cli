const colors = require('colors');
const fs = require('fs');
const async = require('async');
const path = require('path');
const diff = require('diff');
const convertToFlatFormat = require('./convertToFlatFormat');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const sortFlatResources = require('./sortFlatResources');
const formats = require('./formats');
const fileExtensionsMap = formats.fileExtensionsMap;
const acceptedFileExtensions = formats.acceptedFileExtensions;
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.message));
    process.exit(1);
  }
  if (cb) cb(err);
};

const getFiles = (srcpath) => {
  var files = [];
  fs.readdirSync(srcpath).forEach((file) => {
    if (fs.statSync(path.join(srcpath, file)).isDirectory()) {
      files = files.concat(getFiles(path.join(srcpath, file)));
    } else if (acceptedFileExtensions.indexOf(path.extname(file)) > -1) {
      files.push(path.join(srcpath, file));
    }
  });
  return files;
};

function readLocalFile(opt, fPath, clb) {
  const fExt = path.extname(fPath);
  const namespace = path.basename(fPath, fExt);
  const splitted = fPath.split(path.sep);
  const lng = splitted[splitted.length - 2];

  fs.readFile(fPath, (err, data) => {
    if (err) return clb(err);

    fs.stat(fPath, (err, stat) => {
      if (err) return clb(err);

      clb(null, {
        namespace: namespace,
        path: fPath,
        extension: fExt,
        original: data.toString(),
        language: lng,
        mtime: stat.mtime
      });
    });
  });
}

function readLocalFiles(opt, filePaths, clb) {
  async.map(filePaths, (filePath, cb) => {
    readLocalFile(opt, filePath, cb);
  }, clb);
}

function convertAllFilesToFlatFormat(opt, files, clb) {
  async.map(files, (file, cb) => {
    if (fileExtensionsMap[file.extension].indexOf(opt.format) < 0) {
      return cb(new Error(`Format mismatch! Found ${fileExtensionsMap[file.extension][0]} but requested ${opt.format}!`));
    }

    convertToFlatFormat(opt, file.original, (err, content) => {
      if (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
        err.message += '\n' + file.path;
        return cb(err);
      }

      file.content = sortFlatResources(content);
      cb(null, file);
    });
  }, clb);
}

function convertAllFilesToDesiredFormat(opt, files, clb) {
  async.map(files, (file, cb) => {
    convertToDesiredFormat(opt, file.namespace, file.language, file.content, file.mtime, (err, res) => {
      if (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
        return cb(err);
      }
      file.converted = res;
      cb(null, file);
    });
  }, clb);
}

function writeLocalFile(opt, file, clb) {
  if (file.converted === file.original) {
    if (opt.noCallback) console.log(colors.grey(`${file.path} unchanged`));
    return clb(null);
  }

  const d = diff.diffLines(file.original, file.converted);
  d.forEach((part) => {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    if (opt.noCallback) console.log(part.value[color]);
  });

  if (opt.noCallback) console.log(colors.yellow(`reformatting ${file.path}...`));
  if (opt.dry) {
    if (opt.noCallback) console.log(colors.yellow(`would have reformatted ${file.path}...`));
    return clb(null, true);
  }

  fs.writeFile(file.path, file.converted, (err) => clb(err, true));
}

function writeLocalFiles(opt, files, clb) {
  async.map(files, (file, cb) => {
    writeLocalFile(opt, file, cb);
  }, clb);
}

function processFiles(opt, filePaths, clb) {
  readLocalFiles(opt, filePaths, (err, orgFiles) => {
    if (err) return clb(err);

    if (!opt.format) {
      if (orgFiles.length === 0) {
        return clb(new Error('Please provide a format!'));
      }
      // guess format
      opt.format = fileExtensionsMap[orgFiles[0].extension][0];
      if (opt.noCallback) console.log(colors.bgYellow(`No format argument was passed, so guessing "${opt.format}" format.`));
    }

    convertAllFilesToFlatFormat(opt, orgFiles, (err, files) => {
      if (err) return clb(err);

      opt.getNamespace = (o, lng, ns, cb) => {
        const foundOrgFile = orgFiles.find((f) => f.namespace === ns && f.language === lng);
        if (!foundOrgFile) {
          return cb(new Error(`No file found for language "${lng}" and namespace "${ns}" locally!`));
        }
        cb(null, foundOrgFile.content, foundOrgFile.mtime);
      };

      // just the value
      files.forEach((f) => {
        if (f.content) {
          Object.keys(f.content).forEach((k) => {
            if (f.content[k] && typeof f.content[k] === 'object' && f.content[k].value !== undefined) {
              f.content[k] = f.content[k].value;
            }
          });
        }
      });

      convertAllFilesToDesiredFormat(opt, files, (err, convertedFiles) => {
        if (err) return clb(err);

        writeLocalFiles(opt, convertedFiles, clb);
      });
    });
  });
}

const format = (opt, cb) => {
  if (opt.format && !reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`), cb);
  }

  opt.noCallback = !cb;

  fs.lstat(opt.fileOrDirectory, (err, stat) => {
    if (err) return handleError(err, cb);

    const isDirectory = stat.isDirectory();

    var filePaths = [];
    if (isDirectory) {
      try {
        filePaths = getFiles(opt.fileOrDirectory);
      } catch (err) {}
    } else {
      filePaths = [opt.fileOrDirectory];
    }

    processFiles(opt, filePaths, (err, writeResults) => {
      if (err) return handleError(err, cb);
      if (!cb) {
        console.log(colors.green('FINISHED'));
        if (opt.dry && writeResults.find((wr) => !!wr)) {
          process.exit(1);
        }
      }
      if (cb) cb(null);
    });
  });
};

module.exports = format;
