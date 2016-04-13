# usage

```sh
locizify --help

  Usage: locizify [options] <api-key> <project-id>

  Options:

    -h, --help                          output usage information
    -V, --version                       output the version number
    -p, --path <path>                   Specify the path that sould be used </Users/adrai/Projects/locize/locize-app>
    -a, --add-path <url>                Specify the add-path url that sould be used <https://api-dev.locize.io/missing/{{projectId}}/{{version}}/{{lng}}/{{ns}}}>
    -l, --language <lng>                Found namespaces will be matched to this language
    -v, --ver <version>                 Found namespaces will be matched to this version
    -pl, --parse-language <true|false>  Parse folders as language
    -f, --format <json>                 File format of namespaces


locizify api-key project-id
```
