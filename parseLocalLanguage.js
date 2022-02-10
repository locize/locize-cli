const fs = require('fs');
const path = require('path');
const async = require('async');
const mkdirp = require('mkdirp');
const convertToFlatFormat = require('./convertToFlatFormat');
const formats = require('./formats');
const fileExtensionsMap = formats.fileExtensionsMap;
const acceptedFileExtensions = formats.acceptedFileExtensions;

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return !fs.statSync(path.join(srcpath, file)).isDirectory();
  }).filter((file) => acceptedFileExtensions.indexOf(path.extname(file)) > -1);
};

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

const parseLocalLanguage = (opt, lng, cb) => {
  const hasNamespaceInPath = opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1;
  const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng);
  var firstPartLngMask, lastPartLngMask;
  if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
    const secondPartMask = opt.pathMask.substring(opt.pathMask.lastIndexOf(path.sep) + 1);
    firstPartLngMask = secondPartMask.substring(0, secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`));
    lastPartLngMask = secondPartMask.substring(secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`.length);
  }
  var lngPath;
  if (filledLngMask.lastIndexOf(path.sep) > 0) {
    lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep));
  }
  if (!opt.dry && lngPath && lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) < 0) mkdirp.sync(path.join(opt.path, lngPath));
  var files = [];
  try {
    if (lngPath) {
      if (lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1) {
        const firstPart = lngPath.substring(0, lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`));
        const lastPart = lngPath.substring(lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`.length);
        var additionalSubDirsLeft = '';
        var additionalSubDirs = '';
        var splittedP = lngPath.split(path.sep);
        const foundSplitted = splittedP.find((s) => s.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1);
        const foundSplittedIndex = splittedP.indexOf(foundSplitted);
        if (splittedP.length > 2) {
          additionalSubDirsLeft = splittedP.slice(0, foundSplittedIndex).join(path.sep);
          additionalSubDirs = splittedP.slice(foundSplittedIndex + 1).join(path.sep);
        }
        var dirs = getDirectories(path.join(opt.path, additionalSubDirsLeft));
        if (additionalSubDirs === '') {
          dirs = dirs.filter((d) => d.startsWith(firstPart) && d.endsWith(lastPart));
        }
        dirs.forEach((d) => {
          if (additionalSubDirs && fs.statSync(path.join(opt.path, additionalSubDirsLeft, d)).isDirectory()) {
            var directoryExists = false;
            try {
              directoryExists = fs.statSync(path.join(opt.path, additionalSubDirsLeft, d, additionalSubDirs)).isDirectory();
            } catch (e) {}
            if (directoryExists) {
              var subFls = getFiles(path.join(opt.path, additionalSubDirsLeft, d, additionalSubDirs));
              if (firstPartLngMask || lastPartLngMask) subFls = subFls.filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`);

              subFls = subFls.filter((f) => {
                const a = path.join(additionalSubDirsLeft, d, additionalSubDirs, path.basename(f, path.extname(f)));
                const startIndexOfNs = filledLngMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`);
                if (startIndexOfNs === -1) return true;
                const afterNs = filledLngMask.substring(startIndexOfNs + `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`.length);
                const nsName = a.substring(startIndexOfNs, a.indexOf(afterNs));
                const b = filledLngMask.replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, nsName);
                return a === b;
              });

              files = files.concat(subFls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${additionalSubDirs}${path.sep}${f}`));
            }
          } else {
            const fls = getFiles(path.join(opt.path, additionalSubDirsLeft, d)).filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`);
            files = files.concat(fls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${f}`));
          }
        });
      } else {
        files = getFiles(path.join(opt.path, lngPath));
      }
    } else {
      files = getFiles(opt.path);
      // filter lng files...
      const lngIndex = filledLngMask.indexOf(lng);
      const lngLeftLength = filledLngMask.length - lngIndex;
      files = files.filter((f) => { // {{language}} can be left or right of {{namespace}}
        if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) < opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
          return f.indexOf(lng) === lngIndex;
        }
        return (path.basename(f, path.extname(f)).length - f.indexOf(lng)) === lngLeftLength;
      });
    }
  } catch (err) {}
  async.map(files, (file, clb) => {
    var dirPath;
    if (file.lastIndexOf(path.sep) > 0) {
      dirPath = file.substring(0, file.lastIndexOf(path.sep));
      file = file.substring(file.lastIndexOf(path.sep) + 1);
    }
    const fExt = path.extname(file);
    var namespace = path.basename(file, fExt);
    const nsMask = `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
    const filledNsMask = lngPath && lngPath.indexOf(nsMask) > -1 ? filledLngMask : filledLngMask.substring(filledLngMask.lastIndexOf(path.sep) + 1);
    const startNsIndex = filledNsMask.indexOf(nsMask);
    var restNsMask = filledNsMask.substring((startNsIndex || 0) + nsMask.length);
    namespace = namespace.substring(startNsIndex || 0, namespace.lastIndexOf(restNsMask));
    if (lngPath && lngPath.indexOf(nsMask) > -1) {
      restNsMask = restNsMask.substring(0, restNsMask.lastIndexOf(path.sep));
      if (dirPath.indexOf(restNsMask) > 0) {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask), dirPath.indexOf(restNsMask));
      } else {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask));
      }
    } else if (!hasNamespaceInPath && startNsIndex < 0) {
      namespace = opt.namespace;
    }
    var fPath = path.join(opt.path, lngPath || '', file);
    if (dirPath && lngPath.indexOf(nsMask) > -1) {
      fPath = path.join(opt.path, dirPath.replace(nsMask, namespace), file);
    }
    if (!namespace) return clb(new Error(`namespace could not be found in ${fPath}`));
    fs.readFile(fPath, (err, data) => {
      if (err) return clb(err);

      if (fileExtensionsMap[fExt].indexOf(opt.format) < 0) {
        return clb(new Error(`Format mismatch! Found ${fileExtensionsMap[fExt][0]} but requested ${opt.format}!`));
      }

      if (opt.namespace) {
        let hasNamespaceInPathPask = !opt.pathMask || !opt.pathMaskInterpolationPrefix || !opt.pathMaskInterpolationSuffix;
        hasNamespaceInPathPask = !hasNamespaceInPathPask && opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1;
        if (!hasNamespaceInPathPask && namespace === lng) {
          namespace = opt.namespace;
        }
      }

      convertToFlatFormat(opt, data, lng, (err, content) => {
        if (err) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
          err.message += '\n' + fPath;
          return clb(err);
        }

        fs.stat(fPath, (err, stat) => {
          if (err) return clb(err);

          clb(null, {
            namespace: namespace,
            path: fPath,
            extension: fExt,
            content: content,
            language: lng,
            mtime: stat.mtime
          });
        });
      });
    });
  }, cb);
};

module.exports = parseLocalLanguage;
