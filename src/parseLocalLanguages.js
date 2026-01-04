import parseLocalLanguage from './parseLocalLanguage.js'
import filterNamespaces from './filterNamespaces.js'

const parseLocalLanguages = async (opt, lngs) => {
  let res = []
  for (const lng of lngs) {
    if (opt.language && (lng !== opt.language && lng !== opt.referenceLanguage)) {
      continue
    }
    const nss = await parseLocalLanguage(opt, lng)
    res = res.concat(filterNamespaces(opt, nss))
  }
  return res
}

export default parseLocalLanguages
