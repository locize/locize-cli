const fileExtensionsMap = {
  '.json': ['json', 'flat'],
  '.po': ['po', 'gettext', 'po_i18next', 'gettext_i18next'],
  '.xml': ['strings', 'android'],
  '.csv': ['csv'],
  '.resx': ['resx'],
  '.yaml': ['yaml', 'yaml-rails'],
  '.xlsx': ['xlsx'],
  '.xliff': ['xliff2', 'xliff12'],
  '.ftl': ['fluent'],
  '.tmx': ['tmx'],
  '.php': ['laravel']
};

const acceptedFileExtensions = Object.keys(fileExtensionsMap);

const reversedFileExtensionsMap = {};
acceptedFileExtensions.forEach((ext) => {
  fileExtensionsMap[ext].forEach((format) => {
    reversedFileExtensionsMap[format] = ext;
  });
});

module.exports = {
  fileExtensionsMap: fileExtensionsMap,
  acceptedFileExtensions: acceptedFileExtensions,
  reversedFileExtensionsMap: reversedFileExtensionsMap
};
