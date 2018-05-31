# Hoppla
EJS and HJSON based scaffolding

## Cli usage
```
Options:
  --help                 Show help                                     [boolean]
  --version              Show version number                           [boolean]
  -t, --template         Path to template folder             [string] [required]
  -d, --destination      Path to destination folder      [string] [default: "."]
  -i, --input            HJSON input data                               [string]
  -f, --force            Overwrites existing files                     [boolean]
  --ed, --ejs-delimiter  Which EJS delimiter to use      [string] [default: "%"]
```

## Installation
`npm install hoppla`

## Basics
Hoppla is a tool to quickly set up new folder structures in your projects. The templates can be automated with EJS and JS. Instead of using complicated cli dialogs to provide data for your templates, the data can be directly provided by HJSON or JSON.

The core of hoppla works similar to `cp -r`. It merges the template contents into the destination, will however by default not overwrite files. 

Template `templates/example` content: `helloworld.txt`
Example cli execution: `npx hoppla -t ./templates/example -d .`
Result: `./helloworld.txt`

## Anatomy of a template
A template is just a folder and its content will be copied recursively to a destination.
   
### Configuration
There are three places to configure your template:

### global

### local per file

### inline per file
