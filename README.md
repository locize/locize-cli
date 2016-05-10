# Getting started with the locize-cli

## Step 1: Install the cli (preferred globally)

```sh
npm install -g locize-cli
```


## Step 2: Go near to your translation files

At the moment only i18next translation files (json) are supported

```sh
cd my-awesome-project/locales
```


## Step 3: Decide if you want to migrate all languages or only one

If you have a directory structure like this:

    locales
    ├── en
    │   ├── namespace1
    │   ├── namespace2
    │   ├── ...
    ├── de
    │   ├── ...

the cli by default will try to use the directory name as language.


If you have a directory structure like this:

    locales
    ├── namespace1
    ├── namespace2
    ├── ...

you can use the `--language` option to define the language.


## Step 4: execute

Add your api-key and your project-id and let's go...

```sh
locize my-api-key-d9de-4f55-9855-a9ef0ed44672 my-project-id-93e1-442a-ab35-24331fa294ba --path ./en --language en
```

## Step 5: verify

Navigate to your locize project and check the results => [www.locize.io](https://www.locize.io)


## locize --help

```sh
locize --help

  Usage: locize [options] <api-key> <project-id>

  Options:

    -h, --help                          output usage information
    -V, --version                       output the version number
    -p, --path <path>                   Specify the path that should be used </Users/adrai/Projects/locize/locize-app>
    -a, --add-path <url>                Specify the add-path url that should be used <https://api.locize.io/missing/{{projectId}}/{{version}}/{{lng}}/{{ns}}}>
    -l, --language <lng>                Found namespaces will be matched to this language
    -v, --ver <version>                 Found namespaces will be matched to this version
    -pl, --parse-language <true|false>  Parse folders as language (default is true)
    -f, --format <json>                 File format of namespaces


locize api-key project-id
```
