import parseLocalLanguage from './parseLocalLanguage.js'
import filterNamespaces from './filterNamespaces.js'

const parseLocalReference = (opt, cb) => parseLocalLanguage(opt, opt.referenceLanguage, (err, nss) => {
  if (err) return cb(err)

  cb(err, filterNamespaces(opt, nss).filter((n) => n.language === opt.referenceLanguage))
})

export default parseLocalReference
