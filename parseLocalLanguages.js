const async = require('async');
const parseLocalLanguage = require('./parseLocalLanguage');
const filterNamespaces = require('./filterNamespaces');

const parseLocalLanguages = (opt, lngs, cb) => {
  var res = [];
  async.each(lngs, (lng, clb) => {
    if (opt.language && (lng !== opt.language && lng !== opt.referenceLanguage)) {
      return clb();
    }
    parseLocalLanguage(opt, lng, (err, nss) => {
      if (err) return clb(err);
      res = res.concat(filterNamespaces(opt, nss));
      clb();
    });
  }, (err) => {
    if (err) return cb(err);
    cb(null, res);
  });
};

module.exports = parseLocalLanguages;
