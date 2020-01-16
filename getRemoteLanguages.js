const request = require('request');

const getRemoteLanguages = (opt, cb) => {
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

    if (Object.keys(obj).length === 0) {
      return cb(new Error('Project not found!'));
    }

    const lngs = Object.keys(obj);
    var foundRefLng = null;
    lngs.forEach((l) => {
      if (obj[l].isReferenceLanguage) foundRefLng = l;
    });
    if (!foundRefLng) {
      return cb(new Error('Reference language not found!'));
    }
    opt.referenceLanguage = foundRefLng;

    // reflng first
    lngs.splice(lngs.indexOf(opt.referenceLanguage), 1);
    lngs.unshift(opt.referenceLanguage);

    cb(null, lngs);
  });
};

module.exports = getRemoteLanguages;
