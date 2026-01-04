#!/usr/bin/env node

import { Command } from 'commander'
import colors from 'colors'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import ini from 'ini'
import migrate from './migrate.js'
import add from './add.js'
import download from './download.js'
import get from './get.js'
import sync from './sync.js'
import missing from './missing.js'
import copyVersion from './copyVersion.js'
import removeVersion from './removeVersion.js'
import publishVersion from './publishVersion.js'
import deleteNamespace from './deleteNamespace.js'
import formatFn from './format.js'
import createBranch from './createBranch.js'
import mergeBranch from './mergeBranch.js'
import deleteBranch from './deleteBranch.js'
import 'dotenv/config'

const configInHome = path.join(os.homedir(), '.locize')
const configInWorkingDirectory = path.join(process.cwd(), '.locize')
const defaultCdnType = 'standard'

const fixApiPath = (p, cdnType) => {
  if (p.indexOf('.locize.app') < 0) return p
  if (p.indexOf('.lite.locize.app') > 0) {
    return p.replace('.lite.locize.app', `${(cdnType || defaultCdnType) === 'standard' ? '.lite' : ''}.locize.app`)
  } else {
    return p.replace('.locize.app', `${(cdnType || defaultCdnType) === 'standard' ? '.lite' : ''}.locize.app`)
  }
}
const defaultApiEndpoint = fixApiPath('https://api.locize.app', defaultCdnType)

let config = {}
try {
  config = ini.parse(fs.readFileSync(configInWorkingDirectory, 'utf-8'))
} catch (e) {
  try {
    config = ini.parse(fs.readFileSync(configInHome, 'utf-8'))
  } catch (e) {}
}

const program = new Command()

program
  .description('The official locize CLI.')
  .version('__packageVersion__') // This string is replaced with the actual version at build time by rollup
// .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
// .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`);

program
  .command('migrate')
  .alias('m')
  .description('migration of existing translation files')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-l, --language <lng>', 'Found namespaces will be matched to this language')
  .option('-v, --ver <version>', 'Found namespaces will be matched to this version (default: latest)')
  .option('-p, --path <path>', `Specify the path that should be used (default: ${process.cwd()})`, process.cwd())
  .option('-L, --parse-language <true|false>', 'Parse folders as language (default: true)', 'true')
  .option('-f, --format <json>', 'File format of namespaces (default: json)', 'json')
  .option('-r, --replace <true|false>', 'This will empty the optionally existing namespace before saving the new translations. (default: false)', 'false')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    if (!path.isAbsolute(options.path)) {
      options.path = path.join(process.cwd(), options.path)
    }

    migrate({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      path: options.path,
      language: options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG,
      version,
      parseLanguage: options.parseLanguage === 'true',
      format: options.format,
      replace: options.replace === 'true'
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize migrate')
    console.log('    $ locize migrate --path ./en --language en')
    console.log('    $ locize migrate --api-key <apiKey> --project-id <projectId> --path ./en --language en')
    console.log()
  })

program
  .command('add <namespace> <key> <value>')
  .alias('a')
  .description('add a new key')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-l, --language <lng>', 'The language that should be targeted')
  .option('-v, --ver <version>', 'The version that should be targeted (default: latest)')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((namespace, key, value, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG
    if (!language) {
      console.error(colors.red('  error: missing required argument `language`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    add({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      language,
      version,
      namespace,
      key,
      value
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize add common title "the title of my cool app"')
    console.log('    $ locize add common title "the title of my cool app" --language en')
    console.log('    $ locize add common title "the title of my cool app" --api-key <apiKey> --project-id <projectId> --language en')
    console.log()
  })

program
  .command('remove <namespace> <key>')
  .alias('rm')
  .description('remove a key')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-l, --language <lng>', 'The language that should be targeted (omitting this attribute will result in removing the key from all languages)')
  .option('-v, --ver <version>', 'The version that should be targeted (default: latest)')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((namespace, key, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG
    // if (!language) {
    //   console.error(colors.red('  error: missing required argument `language`');
    //   process.exit(1);
    //   return;
    // }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    add({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      language,
      version,
      namespace,
      key
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize remove common title')
    console.log('    $ locize remove common title --language en')
    console.log('    $ locize remove common title --api-key <apiKey> --project-id <projectId> --language en')
    console.log()
  })

program
  .command('download')
  .alias('dl')
  .description('download namespaces')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-v, --ver <version>', 'The version that should be targeted (default: latest)')
  .option('-l, --language <lng>', 'The language that should be targeted')
  .option('--ls, --languages <lng1,lng2>', 'The languages that should be targeted')
  .option('-n, --namespace <ns>', 'The namespace that should be targeted')
  .option('-p, --path <path>', `Specify the path that should be used (default: ${process.cwd()})`, process.cwd())
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-f, --format <json>', 'File format of namespaces (default: json; [nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings])', 'json')
  .option('-s, --skip-empty <true|false>', 'Skips to download empty files (default: true)', 'true')
  .option('-P, --language-folder-prefix <prefix>', 'This will be added as a local folder name prefix in front of the language.', '')
  .option('-m, --path-mask <mask>', 'This will define the folder and file structure; do not add a file extension (default: {{language}}/{{namespace}})', `{{language}}${path.sep}{{namespace}}`)
  .option('-c, --clean <true|false>', 'Removes all local files by removing the whole folder (default: false)', 'false')
  .option('--up, --unpublished <true|false>', 'Downloads the current (unpublished) translations. This will generate private download costs (default: false)', 'false')
  .option('--oo, --overridden-only <true|false>', 'Downloads only the current overridden (unpublished) translations of a tenant or branch project. This will generate private download costs (default: false)', 'false')
  .option('-b, --branch <branch>', 'The branch name (or id) that should be targeted')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint

    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG
    const languages = options.languages || config.languages || config.lngs || process.env.LOCIZE_LANGUAGES || process.env.LOCIZE_LANGS || process.env.LOCIZE_LNGS

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    const namespace = options.namespace

    const format = options.format

    const skipEmpty = options.skipEmpty === 'true'

    const clean = options.clean === 'true'

    const unpublished = options.unpublished === 'true'

    const overriddenOnly = options.overriddenOnly === 'true'

    const languageFolderPrefix = options.languageFolderPrefix || ''

    const pathMask = options.pathMask

    const branch = options.branch

    download({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      language,
      languages: languages && languages.split(','),
      version,
      namespace,
      path: options.path,
      format,
      skipEmpty,
      clean,
      languageFolderPrefix,
      pathMask,
      unpublished,
      branch,
      overriddenOnly
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize download')
    console.log('    $ locize download --ver latest')
    console.log('    $ locize download --project-id <projectId> --ver latest --language en --namespace common')
    console.log('    $ locize download --project-id <projectId> --ver latest --language en --namespace common --format flat')
    console.log()
  })

program
  .command('get <namespace> <key>')
  .alias('g')
  .description('get a key')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-l, --language <lng>', 'The language that should be targeted')
  .option('-v, --ver <version>', 'The version that should be targeted (default: latest)')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((namespace, key, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG
    if (!language) {
      console.error(colors.red('  error: missing required argument `language`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    get({
      cdnType: cdnType || defaultCdnType,
      apiEndpoint,
      projectId,
      language,
      version,
      namespace,
      key
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize get common title')
    console.log('    $ locize get common title --language en')
    console.log('    $ locize get common title --api-key <apiKey> --project-id <projectId> --language en')
    console.log()
  })

program
  .command('sync')
  .alias('s')
  .description('synchronizes locize with your repository (or any other local directory)')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-v, --ver <version>', 'Found namespaces will be matched to this version (default: latest)')
  .option('-p, --path <path>', `Specify the path that should be used (default: ${process.cwd()})`, process.cwd())
  .option('-B, --backup-deleted-path <path>', 'Saves the segments that will be deleted in this path')
  .option('-A, --auto-create-path <true|false>', 'This will automatically make sure the --path is created. (default: true)', 'true')
  .option('-f, --format <json>', 'File format of namespaces (default: json; [nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings])', 'json')
  .option('-s, --skip-empty <true|false>', 'Skips to download empty files (default: false)', 'false')
  .option('-c, --clean <true|false>', 'Removes all local files by removing the whole folder (default: false)', 'false')
  .option('--cf, --clean-local-files <true|false>', 'Removes all local files without removing any folder (default: false)', 'false')
  .option('-u, --update-values <true|false>', 'This will update values of existing translations. (default: false)', 'false')
  .option('--auto-translate <true|false>', 'This will trigger auto-translation of updated translations. (default: false)', 'false')
  .option('-S, --skip-delete <true|false>', 'This will skip the removal of keys on locize. (default: false)', 'false')
  .option('-D, --delete-remote-namespace <true|false>', 'This will delete a complete namespace on locize, if a local file in reference language was deleted. (default: false)', 'false')
  .option('-m, --path-mask <mask>', 'This will define the folder and file structure; do not add a file extension (default: {{language}}/{{namespace}})', `{{language}}${path.sep}{{namespace}}`)
  .option('-P, --language-folder-prefix <prefix>', 'This will be added as a local folder name prefix in front of the language.', '')
  .option('-d, --dry <true|false>', 'Dry run (default: false)', 'false')
  .option('-R, --reference-language-only <true|false>', 'Check for changes in reference language only. (default: true)', 'true')
  .option('-t, --compare-modification-time <true|false>', 'while comparing the namespace content between local and remote, take the modification time of the local file and the last modified time of the remote namespace into account. (default: false)', 'false')
  .option('-l, --language <lng>', 'The language that should be targeted')
  .option('--ls, --languages <lng1,lng2>', 'The languages that should be targeted')
  .option('-n, --namespace <ns>', 'The namespace that should be targeted (you can also pass a comma separated list)')
  .option('--up, --unpublished <true|false>', 'Downloads the current (unpublished) translations. This will generate private download costs (default: false)', 'false')
  .option('--oo, --overridden-only <true|false>', 'Downloads only the current overridden (unpublished) translations of a tenant or branch project. This will generate private download costs (default: false)', 'false')
  .option('-b, --branch <branch>', 'The branch name (or id) that should be targeted')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG
    const languages = options.languages || config.languages || config.lngs || process.env.LOCIZE_LANGUAGES || process.env.LOCIZE_LANGS || process.env.LOCIZE_LNGS

    const namespace = options.namespace

    if (!path.isAbsolute(options.path)) {
      options.path = path.join(process.cwd(), options.path)
    }

    const clean = options.clean === 'true'
    const cleanLocalFiles = options.cleanLocalFiles === 'true'
    const dry = options.dry === 'true'
    const updateValues = options.updateValues === 'true'
    const autoTranslate = options.autoTranslate === 'true'
    const skipDelete = options.skipDelete === 'true'
    const deleteRemoteNamespace = options.deleteRemoteNamespace === 'true'
    const languageFolderPrefix = options.languageFolderPrefix || ''
    const skipEmpty = options.skipEmpty === 'true'
    const referenceLanguageOnly = options.referenceLanguageOnly !== 'false'
    const compareModificationTime = options.compareModificationTime === 'true'
    const pathMask = options.pathMask
    const unpublished = options.unpublished === 'true'
    const overriddenOnly = options.overriddenOnly === 'true'
    const autoCreatePath = options.autoCreatePath === 'true'
    const backupDeletedPath = options.backupDeletedPath
    const branch = options.branch

    sync({
      cdnType: cdnType || defaultCdnType,
      apiEndpoint,
      apiKey,
      projectId,
      version,
      path: options.path,
      format: options.format,
      updateValues,
      autoTranslate,
      skipDelete,
      deleteRemoteNamespace,
      languageFolderPrefix,
      clean,
      cleanLocalFiles,
      skipEmpty,
      referenceLanguageOnly,
      compareModificationTime,
      language,
      languages: languages && languages.split(','),
      namespace,
      dry,
      pathMask,
      unpublished,
      autoCreatePath,
      backupDeletedPath,
      branch,
      overriddenOnly
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize sync')
    console.log('    $ locize sync --path ./locales --version production')
    console.log('    $ locize sync --api-key <apiKey> --project-id <projectId> --path ./locales --version production --format flat')
    console.log()
  })

program
  .command('save-missing')
  .alias('sm')
  .description('saves missing keys to locize from your repository (or any other local directory)')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-v, --ver <version>', 'Found namespaces will be matched to this version (default: latest)')
  .option('-p, --path <path>', `Specify the path that should be used (default: ${process.cwd()})`, process.cwd())
  .option('-f, --format <json>', 'File format of namespaces (default: json; [nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings])', 'json')
  .option('-m, --path-mask <mask>', 'This will define the folder and file structure; do not add a file extension (default: {{language}}/{{namespace}})', `{{language}}${path.sep}{{namespace}}`)
  .option('-P, --language-folder-prefix <prefix>', 'This will be added as a local folder name prefix in front of the language.', '')
  .option('-d, --dry <true|false>', 'Dry run (default: false)', 'false')
  .option('-R, --reference-language-only <true|false>', 'Check for changes in reference language only. (default: true)', 'true')
  .option('-l, --language <lng>', 'The language that should be targeted')
  .option('-n, --namespace <ns>', 'The namespace that should be targeted (you can also pass a comma separated list)')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    const language = options.language || config.language || config.lng || process.env.LOCIZE_LANGUAGE || process.env.LOCIZE_LANG || process.env.LOCIZE_LNG

    const namespace = options.namespace

    if (!path.isAbsolute(options.path)) {
      options.path = path.join(process.cwd(), options.path)
    }

    const dry = options.dry === 'true'
    const updateValues = options.updateValues === 'true'
    const skipDelete = options.skipDelete === 'true'
    const languageFolderPrefix = options.languageFolderPrefix || ''
    const referenceLanguageOnly = options.referenceLanguageOnly !== 'false'
    const pathMask = options.pathMask

    missing({
      cdnType: cdnType || defaultCdnType,
      apiEndpoint,
      apiKey,
      projectId,
      version,
      path: options.path,
      format: options.format,
      updateValues,
      skipDelete,
      languageFolderPrefix,
      referenceLanguageOnly,
      language,
      namespace,
      dry,
      pathMask
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize save-missing')
    console.log('    $ locize save-missing --path ./locales --version production')
    console.log('    $ locize save-missing --api-key <apiKey> --project-id <projectId> --path ./locales --version production --format flat')
    console.log()
  })

program
  .command('copy-version <fromVersion>')
  .alias('cv')
  .description('copy version')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-v, --ver <version>', 'The target version to be used to copy to (default: latest)')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('--iv, --ignore-if-version-exists <true|false>', 'The project-id that should be used (default: false)', 'false')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((fromVersion, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    const ignoreIfVersionExists = options.ignoreIfVersionExists === 'true'

    copyVersion({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      fromVersion,
      toVersion: version,
      ignoreIfVersionExists
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize copy-version latest')
    console.log('    $ locize copy-version latest --ver production')
    console.log('    $ locize copy-version latest --api-key <apiKey> --project-id <projectId> --ver <version>')
    console.log()
  })

program
  .command('remove-version <version>')
  .alias('rv')
  .description('remove version')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((version, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    removeVersion({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      version
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize remove-version tmp-ver')
    console.log('    $ locize remove-version tmp-ver --api-key <apiKey> --project-id <projectId>')
    console.log()
  })

program
  .command('publish-version')
  .alias('pv')
  .description('publish version')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-v, --ver <version>', 'The version to be used to publish (default: latest)')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-t, --tenants <true|false>', 'Publish also tenants (if using multi-tenant setup) (default: false)', 'false')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    const tenants = options.tenants === 'true'

    publishVersion({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      version,
      tenants
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize publish-version')
    console.log('    $ locize publish-version --ver production')
    console.log('    $ locize publish-version --api-key <apiKey> --project-id <projectId> --ver <version>')
    console.log()
  })

program
  .command('delete-namespace <namespace>')
  .alias('dn')
  .description('delete a namespace')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-v, --ver <version>', 'The version that should be targeted (default: latest)')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((namespace, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    deleteNamespace({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      version,
      namespace
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize delete-namespace common')
    console.log('    $ locize delete-namespace common --api-key <apiKey> --project-id <projectId>')
    console.log()
  })

program
  .command('format [fileOrDirectory]')
  .alias('ft')
  .description('format local files')
  .option('-f, --format <json>', 'File format of namespaces (default: json; [nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings])', 'json')
  .option('-l, --reference-language <lng>', 'Some format conversions need to know the reference language.', 'en')
  .option('-d, --dry <true|false>', 'Dry run (default: false)', 'false')
  .action((fileOrDirectory, options) => {
    fileOrDirectory = fileOrDirectory || '.'

    if (!path.isAbsolute(fileOrDirectory)) {
      fileOrDirectory = path.join(process.cwd(), fileOrDirectory)
    }

    const format = options.format
    const dry = options.dry === 'true'
    const referenceLanguage = options.referenceLanguage

    formatFn({
      fileOrDirectory,
      format,
      referenceLanguage,
      dry
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize format')
    console.log('    $ locize format path/to/file')
    console.log('    $ locize format path/to/dictionary')
    console.log('    $ locize format path/to/dictionary --format android')
    console.log('    $ locize format path/to/dictionary --format android --dry true')
    console.log('    $ locize format path/to/dictionary --format xliff2 --reference-language en')
    console.log()
  })

program
  .command('create-branch <branch>')
  .alias('cb')
  .description('create branch')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-v, --ver <version>', 'The target version to be used to copy to (default: latest)')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((branch, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    const version = options.ver || config.ver || config.version || process.env.LOCIZE_VERSION || process.env.LOCIZE_VER || 'latest'

    createBranch({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      version,
      branch
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize create-branch featureX')
    console.log('    $ locize create-branch featureX --ver production')
    console.log('    $ locize create-branch featureX --api-key <apiKey> --project-id <projectId> --ver <version>')
    console.log()
  })

program
  .command('merge-branch <branch>')
  .alias('mb')
  .description('merge branch')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-d, --delete <true|false>', 'This will delete the branch after merging. (default: false)', 'false')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((branch, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    mergeBranch({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      delete: options.delete === 'true',
      branch
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize merge-branch featureX')
    console.log('    $ locize merge-branch <projectId-of-branch>')
    console.log('    $ locize merge-branch featureX --delete true')
    console.log('    $ locize merge-branch featureX --api-key <apiKey> --project-id <projectId> --delete true')
    console.log()
  })

program
  .command('delete-branch <branch>')
  .alias('db')
  .description('delete branch')
  .option('-k, --api-key <apiKey>', 'The api-key that should be used')
  .option('-i, --project-id <projectId>', 'The project-id that should be used')
  .option('-a, --api-endpoint <url>', `Specify the api-endpoint url that should be used (default: ${defaultApiEndpoint})`)
  .option('-C, --config-path <configPath>', `Specify the path to the optional locize config file (default: ${configInWorkingDirectory} or ${configInHome})`)
  .option('--ct, --cdn-type <standard|pro>', `Specify the cdn endpoint that should be used (depends on which cdn type you've in your locize project) (default: ${defaultCdnType})`)
  .action((branch, options) => {
    try {
      config = ini.parse(fs.readFileSync(options.configPath, 'utf-8')) || config
    } catch (e) {}

    const cdnType = options.cdnType || config.cdnType || process.env.LOCIZE_CDN_TYPE

    let apiEndpoint = options.apiEndpoint || config.apiEndpoint || process.env.LOCIZE_API_ENDPOINT || defaultApiEndpoint
    if (cdnType) apiEndpoint = fixApiPath(apiEndpoint, cdnType)

    const apiKey = options.apiKey || config.apiKey || process.env.LOCIZE_API_KEY || process.env.LOCIZE_KEY
    if (!apiKey) {
      console.error(colors.red('  error: missing required argument `apiKey`'))
      process.exit(1)
      return
    }

    const projectId = options.projectId || config.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID
    if (!projectId) {
      console.error(colors.red('  error: missing required argument `projectId`'))
      process.exit(1)
      return
    }

    deleteBranch({
      cdnType: cdnType || defaultCdnType,
      apiKey,
      projectId,
      apiEndpoint,
      branch
    })
  })
  .on('--help', () => {
    console.log('  Examples:')
    console.log()
    console.log('    $ locize delete-branch featureX')
    console.log('    $ locize delete-branch featureX --api-key <apiKey> --project-id <projectId>')
    console.log()
  })

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp(colors.red)
}
