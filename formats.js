const fileExtensionsMap = {
  '.json': ['json', 'flat'],
  '.po': ['po', 'gettext', 'po_i18next', 'gettext_i18next'],
  '.xml': ['android'],
  '.strings': ['strings'],
  '.csv': ['csv'],
  '.resx': ['resx'],
  '.yaml': ['yaml', 'yaml-rails', 'yaml-nested'],
  '.xlsx': ['xlsx'],
  '.xliff': ['xliff2', 'xliff12'],
  '.xlf': ['xlf2', 'xlf12'],
  '.ftl': ['fluent'],
  '.tmx': ['tmx'],
  '.php': ['laravel'],
  '.properties': ['properties']
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
