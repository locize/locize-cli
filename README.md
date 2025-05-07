[![npm](https://img.shields.io/npm/v/locize-cli.svg)](https://npmjs.org/package/locize-cli)

# Getting started with the locize-cli

## Step 0: Install the cli

### with npm (preferred globally)

```sh
npm install -g locize-cli
```

### with Shell: (downloads [released](https://github.com/locize/locize-cli/releases) (linux or macos) binaries)

```sh
curl -fsSL https://raw.githubusercontent.com/locize/locize-cli/master/install.sh | sh
```

### with PowerShell: (downloads [released](https://github.com/locize/locize-cli/releases) (windows) binaries)

```sh
iwr https://raw.githubusercontent.com/locize/locize-cli/master/install.ps1 -useb | iex
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

*The CLI will use the normal [API](https://www.locize.com/docs/api) endpoints to download the translations, so normal download charges etc. will occur.*

### Step 1: execute

Add your project-id and let's go...

```sh
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --path ./backup
```
*Make sure to use `--ver` and not `--version` (`--version` will print the CLI version).*

or

```sh
locize download
```

or add a format like (json, nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings)

*Special formats:*
- use yaml-rails to have the language code in the resulting yaml as root object
- use yaml-rails-ns to have the namespace in the resulting yaml as first key scope

```sh
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --path ./backup --format android
```

### GitHub Action

There's also a [GitHub Action](https://github.com/marketplace/actions/locize-download) that handles the download in your CI/CD workflow.


## Synchronize locize with your repository (or any other local directory)
By using the sync command, you can keep your existing code setup and synchronize the translations with locize.
An example on how this could look like can be seen in [this tutorial](https://github.com/locize/react-tutorial#step-1---keep-existing-code-setup-but-synchronize-with-locize).

**⚠️ Since the remote source are the published translations, make sure the desired version is set to auto publish mode. Alternatively use the `--unpublished true` argument (this will generate [private downloads costs](https://www.locize.com/docs/api#fetch-filter-the-unpublished-namespace-resources)). ⚠️**

*The CLI will use the normal [API](https://www.locize.com/docs/api) endpoints, so normal modification and download charges etc. will occur.*

*If you need to change or remove multiple keys, please do NOT execute the sync command after each individual key change, but make the changes all together and then execute the sync command once.*

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

or add a format like (json, nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings)

*Special formats:*
- use yaml-rails to have the language code in the resulting yaml as root object
- use yaml-rails-ns to have the namespace in the resulting yaml as first key scope

```sh
locize sync --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --format android
```

**‼️ By default: The reference language in your local repository is the master ‼️**

- if you have new keys in your local namespace it will add the missing one to locize
- if you have new namespaces in your local language directory it will add the missing one to locize
- if you have less keys (you have deleted some keys) in your local namespace it will remove them in locize too
- all non reference languages will always be just locally replaced by what is published on locize, unless the *--skip-delete true* argument is used
- if you change the values of existing keys in the reference language, it will not change them in locize (to change the existing values you have to change it directly in locize or use the *--update-values true* argument)
- if you update existing keys (with *--update-values true*) the automatic translation is not triggered, unless the *--auto-translate true* argument us used
- **if you want to take into account all languages instead of the reference language only while comparing the namespace content between local and remote, you can use the command argument *--reference-language-only false***
- **if you want to take into account the modification time while comparing the namespace content between local and remote, you can use the command argument *--compare-modification-time true***


### Step 4: verify

Navigate to your locize project and check the results => [www.locize.app](https://www.locize.app)


## Push missing keys to locize from your repository (or any other local directory)
This is useful, when i.e. using [i18next-scanner](https://github.com/i18next/i18next-scanner), like described [here](https://github.com/locize/i18next-locize-backend/issues/315#issuecomment-586967039).
The save-missing command uses the [missing API](https://www.locize.com/docs/api#missing-translations) and the sync command uses the [update API](https://www.locize.com/docs/api#update-remove-translations).
So, if you want to save new keys (that does not exist in locize), the save-missing command is the better choice.
Doing so, you can then for example make use of the “created by missing API" filter in the locize UI.
Also, using this save-missing command does not generate extra modification costs.

But if you need to update existing keys, the sync command is the correct choice.

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
locize save-missing --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba
```

or add a format like (json, nested, flat, xliff2, xliff12, xlf2, xlf12, android, yaml, yaml-rails, yaml-rails-ns, yaml-nested, yml, yml-rails, yml-nested, csv, xlsx, po, strings, resx, fluent, tmx, laravel, properties, xcstrings)

```sh
locize save-missing --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --format android
```

### Step 4: verify

Navigate to your locize project and check the results => [www.locize.app](https://www.locize.app)


## Copy version

*It uses this [API endpoint](https://www.locize.com/docs/api#copy-version) and it's the same behavior like [overwriting](https://github.com/more/versioning#a-overwrite-with-data-from) via the UI.*

### Step 1: execute

Add your api-key (of target version) and your project-id and let's go...

```sh
# this will copy version latest to production
locize copy-version latest --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver production
```
*Make sure to use `--ver` and not `--version` (`--version` will print the CLI version).*


## Publish version
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize publish-version --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver production
```


## Delete version

*It uses this [API endpoint](https://www.locize.com/docs/api#remove-version).*

### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
# this will remove version tmp-ver
locize remove-version tmp-ver --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba
```


## Delete namespace
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize delete-namespace common --api-key my-api-key-d9de-4f55-9855-a9ef0ed44672 --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest
```
*Make sure to use `--ver` and not `--version` (`--version` will print the CLI version).*


## Migration of existing i18next files
We suggest to use the sync command instead of the migrate command.
The migrate command should be used only once and only works with json files.

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

Navigate to your locize project and check the results => [www.locize.app](https://www.locize.app)



## Format local files (i.e. in combination with download command)
### Step 1: execute

Add your api-key and your project-id and let's go...

```sh
locize format path/to/dictionary --format android
```



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
locize sync
```

or

```sh
locize add common title "the title of my cool app"
```

### Additionally if these environment variables can be set:

- LOCIZE_PROJECTID or LOCIZE_PID
- LOCIZE_API_KEY or LOCIZE_KEY
- LOCIZE_VERSION or LOCIZE_VER
- LOCIZE_LANGUAGE or LOCIZE_LANG or LOCIZE_LNG

they will also be considered with this priority:

1. argument as part of command (i.e. locize sync --project-id ...)
2. config value in .locize file (i.e. projectId = ...)
3. env variable (i.e. LOCIZE_PROJECTID) / or .env file

In case you have a .env file in the current working directory, it will be used to load environment variables from that .env file into process.env.
