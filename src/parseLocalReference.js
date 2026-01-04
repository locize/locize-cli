import parseLocalLanguage from './parseLocalLanguage.js'
import filterNamespaces from './filterNamespaces.js'

const parseLocalReference = async (opt) => {
  const nss = await parseLocalLanguage(opt, opt.referenceLanguage)
  return filterNamespaces(opt, nss).filter((n) => n.language === opt.referenceLanguage)
}

export default parseLocalReference
