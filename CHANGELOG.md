## 4.1.0
- looking for the config file in the current directory first

## 4.0.1
- handle edge case for fluent format
- update deps

## 4.0.0
- refactoring of sync and download command
- introduce tmx format
- po files now get correct date values

## 3.15.0
- introduce --language-folder-prefix parameter for sync command

## 3.14.2
- catch edge case when file has no content

## 3.14.1
- ignore comments for fluent format
- update deps

## 3.14.0
- support fluent format

## 3.13.4
- fix gettext format

## 3.13.3
- fix yaml-rails format

## 3.13.2
- fix yaml-rails format nesting

## 3.13.1
- fix yaml-rails format

## 3.13.0
- support yaml-rails format

## 3.12.1
- do not delete hidden folders

## 3.12.0
- introduce delete-namespace

## 3.11.0
- introduce --update-values flag for sync command

## 3.10.0
- support for private published files

## 3.9.6
- support for HTML strings for Android #4

## 3.9.5
- fix a bug when adding and removing keys with the same sync call (keys are not added anymore to all languages)

## 3.9.4
- fix -c argument
- possibility to define env vars

## 3.9.3
- fix exit code on error in bin too

## 3.9.2
- fix exit code on error

## 3.9.1
- fix return of job object

## 3.9.0
- wait for async action for copy & publish version completes

## 3.8.0
- copy version
- publish version

## 3.7.3
- update dependencies

## 3.7.2
- update dependencies

## 3.7.1
- make sure we get a non-cached version of available languages request

## 3.7.0
- introduce sync command

## 3.6.0
- download resources as strings format

## 3.5.0
- download resources as gettext po format

## 3.4.3
- add defaults for download (when calling programmatically)

## 3.4.2
- update android-string-resource dependency

## 3.4.1
- ensure data is flatted for add

## 3.4.0
- add possibility to skip-empty namespaces

## 3.3.1
- sort keys for flat json export

## 3.3.0
- add additional csv format option for download

## 3.2.3
- update android-string-resource dependency

## 3.2.2
- update xliff dependency

## 3.2.1
- optimize error message handling

## 3.2.0
- migrate has a new option --replace

## 3.1.0
- download resources in different formats (json, flat, xliff2, xliff12, android)

## 3.0.1
- fixes path cleaning for non linux systems

## 3.0.0

- download now does not provide projectId and version (if called with version param) - so downloaded structure is more useful to i18next
- download now appends fileextension .json to the json files

## 1+2.x.x

- initial versions
