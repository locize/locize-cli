[![npm](https://img.shields.io/npm/v/locize-cli.svg)](https://npmjs.org/package/locize-cli)

# Getting started with the locize-cli

## Step 0: Install the cli (preferred globally)

```sh
npm install -g locize-cli
```

## Migration of existing i18next files
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
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --target ./backup
```

or

```sh
locize download
```

or add a format like (flat, android, xliff2, xlliff12, android, csv, po, strings)

```sh
locize download --project-id my-project-id-93e1-442a-ab35-24331fa294ba --ver latest --language en --namespace namespace1 --target ./backup --format android
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
locize migrate
```

or

```sh
locize add common title "the title of my cool app"
```
