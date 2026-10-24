const fileExtensionsMap = {
  '.json': ['json', 'nested', 'flat'],
  '.po': ['po', 'gettext', 'po_i18next', 'gettext_i18next'],
  '.xml': ['android'],
  '.strings': ['strings'],
  '.csv': ['csv'],
  '.resx': ['resx'],
  '.yaml': ['yaml', 'yaml-rails', 'yaml-rails-ns', 'yaml-nested'],
  '.yml': ['yml', 'yml-rails', 'yml-rails-ns', 'yml-nested'],
  '.xlsx': ['xlsx'],
  '.xliff': ['xliff2', 'xliff21', 'xliff22', 'xliff12'],
  '.xlf': ['xlf2', 'xlf21', 'xlf22', 'xlf12'],
  '.ftl': ['fluent'],
  '.tmx': ['tmx'],
  '.php': ['laravel'],
  '.properties': ['properties'],
  '.xcstrings': ['xcstrings']
}

const acceptedFileExtensions = Object.keys(fileExtensionsMap)

const reversedFileExtensionsMap = {}
acceptedFileExtensions.forEach((ext) => {
  fileExtensionsMap[ext].forEach((format) => {
    reversedFileExtensionsMap[format] = ext
  })
})

export {
  fileExtensionsMap,
  acceptedFileExtensions,
  reversedFileExtensionsMap
}

// the gettext formats carry the needs-review mark as "#, fuzzy": an unpublished
// download pulls their rows raw so the marks can be written out
export const GETTEXT_FORMATS = ['po', 'gettext', 'po_i18next', 'gettext_i18next']

// gettext tells entries apart by (msgctxt, msgid); in 'po' / 'gettext' the key holds both, joined
// by U+0004 as gettext does in .mo files ('po_i18next' keeps i18next's "_")
// (sister: inweso-cat packages/file-gettext/index.js)
export const GETTEXT_CTX_SEPARATOR = '\u0004'

// the msgctxt a key carries, without the plural suffix the converter appends after it
// ponytail: a msgctxt that itself ends like a plural suffix ("menu_one") loses it in the context text; the key stays right
export const gettextContextOf = (key) => {
  const i = key.indexOf(GETTEXT_CTX_SEPARATOR)
  if (i < 0) return
  return key.slice(i + 1).replace(/_(plural|\d+|zero|one|two|few|many|other)$/, '') || undefined
}
