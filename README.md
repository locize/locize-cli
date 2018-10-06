[![npm](https://img.shields.io/npm/v/locize-cli.svg)](https://npmjs.org/package/locize-cli)

# Getting started with the locize-cli

## Step 0: Install the cli (preferred globally)

```sh
npm install -g locize-cli
```


## Adding/Updating new keys
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize add --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --language en namespace1 myNewKey "My new value"
```


## Remove keys
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize remove --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --language en namespace1 myNewKey
```

or

```sh
locize remove common title
```


## Get keys
### Step 1: execute

Add your project-id and let's go...

```sh
locize get --project-id my-project-id-93e1-442a-ab35-24331fa294ba --language en namespace1 myNewKey
```

or

```sh
locize get common title
```


## Download current published files
### Step 1: execute

Add your project-id and let's go...

```sh
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --path ./backup
```

or

```sh
locize download
```

or add a format like (json, flat, xliff2, xliff12, android, yaml, yaml-rails, csv, xlsx, po, strings, resx, fluent, tmx)

```sh
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --path ./backup --format android
```


## Synchronize locize with your repository (or any other local directory)
### Step 1: Go near to your translation files

```sh
cd my-awesome-project/locales
```

Make sure you have this type of tree structure:
Each language should be a directory and each namespace should be a file

    locales
    ├── en
    │   ├── namespace1.extension
    │   ├── namespace2.extension
    │   ├── ...
    ├── de
    │   ├── ...

the cli by will use the directory name as language and the filename (without extension as namespace name).


### Step 3: execute

Add your api-key and your project-id and let's go...

```sh
locize sync --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba
```

or add a format like (json, flat, xliff2, xliff12, android, yaml, yaml-rails, csv, xlsx, po, strings, resx, fluent, tmx)

```sh
locize sync --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --format android
```

**‼️ By default: The reference language in your local repository is the master ‼️**

- if you have new keys in your local namespace it will add the missing one to locize
- if you have new namespaces in your local language directory it will add the missing one to locize
- if you have less keys (you have deleted some keys) in your local namespace it will remove them in locize too
- all non reference languages will always be just locally replaced by what is published on locize
- if you change the values of existing keys in the reference language, it will not change them in locize (to change the existing values you have to change it directly in locize)
- **if you want to take into account all languages instead of the reference language only while comparing the namespace content between local and remote, you can use the command argument *--reference-language-only false***
- **if you want to take into account the modification time while comparing the namespace content between local and remote, you can use the command argument *--compare-modification-time true***


### Step 4: verify

Navigate to your locize project and check the results => [www.locize.io](https://www.locize.io)


## Copy version
### Step 1: execute

Add your api-key (of target version) and your project-id and let's go...

```sh
# this will copy version latest to production
locize copy-version latest --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver production
```


## Publish version
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize publish-version --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver production
```


## Delete namespace
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize delete-namespace common --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest
```


## Migration of existing i18next files
We suggest to use the sync command instead of the migrate command.
The migrate command is older and only works with json files.

### Step 1: Go near to your translation files

At the moment only i18next translation files (json) are supported

```sh
cd my-awesome-project/locales
```


### Step 2: Decide if you want to migrate all languages or only one

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


### Step 3: execute

Add your api-key and your project-id and let's go...

```sh
locize migrate --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --path ./en --language en
```
_Passing the argument --replace will empty the optionally existing namespace before saving the new translations. (default: false)_

### Step 4: verify

Navigate to your locize project and check the results => [www.locize.io](https://www.locize.io)



## Other information

You can define a config file in your home directory (or wherever you want (by specifying it in the command)) that contains defaults for your commands.
i.e.

```sh
cat /Users/user/.locize

apiKey = my-api-key-d9de-4f55-9855-a9ef0ed44672
projectId = my-project-id-93e1-442a-ab35-24331fa294ba
language = en
version = latest
```

like this you can just work like this:

```sh
locize migrate
```

or

```sh
locize add common title "the title of my cool app"
```
