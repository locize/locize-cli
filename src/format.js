import colors from 'colors'
import fs from 'node:fs'
import path from 'node:path'
import { diffLines } from 'diff'
import convertToFlatFormat from './convertToFlatFormat.js'
import convertToDesiredFormat from './convertToDesiredFormat.js'
import sortFlatResources from './sortFlatResources.js'
import * as formats from './formats.js'
const fileExtensionsMap = formats.fileExtensionsMap
const acceptedFileExtensions = formats.acceptedFileExtensions
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap

const getFiles = (srcpath) => {
  let files = []
  fs.readdirSync(srcpath).forEach((file) => {
    if (fs.statSync(path.join(srcpath, file)).isDirectory()) {
      files = files.concat(getFiles(path.join(srcpath, file)))
    } else if (acceptedFileExtensions.indexOf(path.extname(file)) > -1) {
      files.push(path.join(srcpath, file))
    }
  })
  return files
}

async function readLocalFile (opt, fPath) {
  const fExt = path.extname(fPath)
  const namespace = path.basename(fPath, fExt)
  const splitted = fPath.split(path.sep)
  const lng = splitted[splitted.length - 2]
  const data = await fs.promises.readFile(fPath)
  const stat = await fs.promises.stat(fPath)
  return {
    namespace,
    path: fPath,
    extension: fExt,
    original: data.toString(),
    language: lng,
    mtime: stat.mtime
  }
}

async function readLocalFiles (opt, filePaths) {
  return await Promise.all(filePaths.map(f => readLocalFile(opt, f)))
}

async function convertAllFilesToFlatFormat (opt, files) {
  return await Promise.all(files.map(async file => {
    if (fileExtensionsMap[file.extension].indexOf(opt.format) < 0) {
      throw new Error(`Format mismatch! Found ${fileExtensionsMap[file.extension][0]} but requested ${opt.format}!`)
    }
    let content
    try {
      content = await convertToFlatFormat(opt, file.original)
    } catch (err) {
      err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '') + '\n' + file.path
      throw err
    }
    file.content = sortFlatResources(content)
    return file
  }))
}

async function convertAllFilesToDesiredFormat (opt, files) {
  return await Promise.all(files.map(async file => {
    let res
    try {
      res = await convertToDesiredFormat(opt, file.namespace, file.language, file.content, file.mtime)
    } catch (err) {
      err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
      throw err
    }
    res = (opt.format !== 'xlsx' && !res.endsWith('\n')) ? (res + '\n') : res
    file.converted = res
    return file
  }))
}

async function writeLocalFile (opt, file) {
  if (file.converted === file.original) {
    console.log(colors.grey(`${file.path} unchanged`))
    return false
  }
  const d = diffLines(file.original, file.converted)
  d.forEach((part) => {
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey'
    console.log(part.value[color])
  })
  console.log(colors.yellow(`reformatting ${file.path}...`))
  if (opt.dry) {
    console.log(colors.yellow(`would have reformatted ${file.path}...`))
    return true
  }
  const fileContent = (opt.format !== 'xlsx' && !file.converted.endsWith('\n')) ? (file.converted + '\n') : file.converted
  await fs.promises.writeFile(file.path, fileContent)
  return true
}

async function writeLocalFiles (opt, files) {
  return await Promise.all(files.map(f => writeLocalFile(opt, f)))
}

async function processFiles (opt, filePaths) {
  const orgFiles = await readLocalFiles(opt, filePaths)
  if (!opt.format) {
    if (orgFiles.length === 0) {
      throw new Error('Please provide a format!')
    }
    opt.format = fileExtensionsMap[orgFiles[0].extension][0]
    console.log(colors.bgYellow(`No format argument was passed, so guessing "${opt.format}" format.`))
  }
  const files = await convertAllFilesToFlatFormat(opt, orgFiles)
  opt.getNamespace = async (o, lng, ns) => {
    const foundOrgFile = orgFiles.find((f) => f.namespace === ns && f.language === lng)
    if (!foundOrgFile) {
      throw new Error(`No file found for language "${lng}" and namespace "${ns}" locally!`)
    }
    return { content: foundOrgFile.content, mtime: foundOrgFile.mtime }
  }
  files.forEach((f) => {
    if (f.content) {
      Object.keys(f.content).forEach((k) => {
        if (f.content[k] && typeof f.content[k] === 'object' && f.content[k].value !== undefined) {
          f.content[k] = f.content[k].value
        }
      })
    }
  })
  const convertedFiles = await convertAllFilesToDesiredFormat(opt, files)
  return await writeLocalFiles(opt, convertedFiles)
}

async function format (opt) {
  if (opt.format && !reversedFileExtensionsMap[opt.format]) {
    throw new Error(`${opt.format} is not a valid format!`)
  }
  const stat = await fs.promises.lstat(opt.fileOrDirectory)
  const isDirectory = stat.isDirectory()
  let filePaths = []
  if (isDirectory) {
    try {
      filePaths = getFiles(opt.fileOrDirectory)
    } catch (err) {}
  } else {
    filePaths = [opt.fileOrDirectory]
  }
  const writeResults = await processFiles(opt, filePaths)
  console.log(colors.green('FINISHED'))
  if (opt.dry && writeResults.find((wr) => !!wr)) {
    process.exit(1)
  }
}

export default format
