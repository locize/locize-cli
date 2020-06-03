const parseLocalLanguage = require('./parseLocalLanguage');
const filterNamespaces = require('./filterNamespaces');

const parseLocalReference = (opt, cb) => parseLocalLanguage(opt, opt.referenceLanguage, (err, nss) => {
  if (err) return cb(err);

  cb(err, filterNamespaces(opt, nss));
});

module.exports = parseLocalReference;
