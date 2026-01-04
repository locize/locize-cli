import async from 'async'
import parseLocalLanguage from './parseLocalLanguage.js'
import filterNamespaces from './filterNamespaces.js'

const parseLocalLanguages = (opt, lngs, cb) => {
  let res = []
  async.each(lngs, (lng, clb) => {
    if (opt.language && (lng !== opt.language && lng !== opt.referenceLanguage)) {
      return clb()
    }
    parseLocalLanguage(opt, lng, (err, nss) => {
      if (err) return clb(err)
      res = res.concat(filterNamespaces(opt, nss))
      clb()
    })
  }, (err) => {
    if (err) return cb(err)
    cb(null, res)
  })
}

export default parseLocalLanguages
