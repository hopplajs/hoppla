# Hoppla
EJS and HJSON based scaffolding. A simple tool and library to automate the process of setting up new projects or project parts with templates.

Summary:
* Works similar to `cp -r`
* No overwrite by default
* All files parsed with EJS
* Directly access JSON/HJSON Data in the files
* No cli modal boilerplate
* Customize with own javascript

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

* Template `templates/example` content: `helloworld.txt`
* Example cli execution: `npx hoppla -t ./templates/example -d .`
* Result: `./helloworld.txt`

## EJS / input

By default all files suffixed with `.hop.ejs` will be parsed with EJS. Other files will be copied as is.
The data specified in the input cli option will be used as EJS data and therefore can be accessed in the template files.

Example content of `templates/example/helloworld.txt.hop.ejs`:
```ejs
Hello <%= input.userName %>

<% if (input.userAge < 18) { %>
  Sorry but you are too young.
<% } %>
```

This file will be scaffolded with the name `helloworld.txt` (hoppla removes the `.hop.ejs` suffix).

## Anatomy of a template
A template is just a folder with content that will be copied recursively to a destination.
   
### Configuration
There are three places to configure your template:

### global per template
You can add a file with the name `hopplaconfig` to the root of your template. This file will not be copied to the destination. The contents of the file is a HSJON or JSON object which can have the following options:

```js
{
  // Default input data used for EJS. Input data provided with the cli option will be merged over the input data specified here.
  input: {
    aVariable: 'defaultValue'
  }

  // Files and folders matching these globs will not be copied to the destination
  // Keep in mind: this gets checked before the files will be renamed (in case there is a hopplaconfig fileName).
  // Think it like this: if you have an excluded file, its hopplaconfig is ignored too!
  excludeGlobs: [ '**/tmp', 'TODOS.md' ] 

  // Files matching these globs will not be parsed with EJS
  // By default only files suffixed with ".hop.ejs" are parsed with EJS!
  rawGlobs: [ '**/*.png', '**/*.zip' ]

  // Custom javascript which will be executed at the start of hoppla, before the template files will be copied from the tmp directory to the destination 
  prepare: 'console.log("Hello world")'

  // Custom javascript which will be executed at the end of hoppla, after the template files are copied to the destination
  finalize: 'console.log("Goodby")'
}
```

### local inline per file
Coming back to the helloworld.txt.hop.ejs file from the Basics chapter.
Its content can look like this:

```
###hopplaconfig {
  // Create the file in the destination with a custom filename.
  // The string will be joined with the parent folder name before interpretation, making it viable
  // for various tricks like:
  // '.' (a folder would in this case copy its contents into its parent)
  // 'newFolderX/newFolderY/hello.txt' (the file would be copied into the completely new folders newFolderX/newFolderY)
  fileName: 'hello.<%= input.userName %>.txt',
  // Can be set to "true" and the file will not be copied to the destination
  exclude: false,
  // Copy file as is / not EJS output
  raw: false,
  // Custom javascript hook (have a look at the specific chapter)
  generate: 'console.log(hoppla.input.userName); return hoppla.generate(hoppla.input);'
} hopplaconfig###
Hello <%= input.userName %>
```

The ###hopplaconfig hopplaconfig### block is not included in the destination output.

### local separate config per file
Every file in the template accepts a second file with the name `filename.hopplaconfig`. `filename` is the filename of the file to configure (without the `.hop.ejs` suffix). So the hopplaconfig filename for our example `helloworld.txt.hop.ejs` is `helloworld.txt.hopplaconfig`

This is espacially useful for folders and binary files which cannot be configured inline.

The content of the separate config file is JSON or HJSON. The options are the same as if you use the inline configuration.

## Custom javascript
Inside of your custom javascript you have access to a `hoppla` variable which is an object with several properties:

### prepare / finalize
Customize the template with javascript at the start and end of the hoppla process.

```js
{
  input: { hello: 'world' }
  prepare: 'console.log("prepareHopplaObj", hoppla)'
  /*
   * Output: 
   * 'prepareHopplaObj' {
   *   input: { hello: 'world' },
   *   template: '/home/ubuntu/projects/templates/helloworld',
   *   tmp: '/home/ubuntu/projects/templates/new-helloworld/tmp-hoppla/helloworld'
   *   destination: '/home/ubuntu/projects/new-helloworld'
   *   require: Function
   * }
   */
  finalize: 'console.log("finalizeHopplaObj", hoppla)'
  /*
   * Output: 
   * 'finalizeHopplaObj' {
   *   error: Error
   *   input: { hello: 'world' },
   *   template: '/home/ubuntu/projects/templates/helloworld',
   *   destination: '/home/ubuntu/projects/new-helloworld'
   *   require: Function
   * }
   */
}
```

### generate
This is a hook where you can add file specific javascript. In the js context is a hoppla object with a generate function.
Everytime this generate function is called, it will create a copy of the file (counter.txt in the example) and interpret 
the new copy  with the input you specified as the first argument of hoppla.generate.
Only the generated copies will be finally copied to the destination!

This allows you to not only add extra input variables from js for a single file but also to generate 
multiple copies of the file with new file names.

Example:

counter.txt:
```
###hopplaconfig {
  fileName: 'count.<%= input.count %>.txt'
  // Always return the promise from hoppla.generate!
  generate: 'return hoppla.require('tpl-helpers/hello.js')(hoppla)'
} ###hopplaconfig
Counting <%= input.count %>
```

tpl-helpers/hello.js:
```js
module.exports = function(hoppla) {
  console.log('generateHopplaObj', hoppla);
  /*
   * Output:
   * 'generateHopplaObj' {
   *   generate: Function,
   *   input: { userName: 'john' }
   *   require: Function
   * }
   */

  var promise = Promise.resolve();
  for(var i = 0; i < 3; i++) {
    promise = promise.then(() => {
      input.count = i;
      // Creates a temporary copy of counter.txt which will be parsed with the new input
      // The copy will NOT recursively interpret the generate =)
      // hoppla.generate is asynchronous and returns a Promise!
      return hoppla.generate(input);  
    })
  }

  return promise;
}
```

Destination result:
* count.0.txt
* count.1.txt
* count.2.txt

**If you use the generate option, you also have to use the hoppla.generate function atleast once. Otherwise the file would not be copied to the destination.**

#### Asynchronous javascript
You can just return a promise in custom-js options:

```js
{
  prepare: 'return Promise.resolve().then(() => { console.log("async") })'
}
```

#### hoppla.require
Use this to require other javascript files from your template. The path is relative to the template directory.

```js
{
  excludeGlobs: [ 'tpl-helpers' ]
  prepare: 'hoppla.require("tpl-helpers/prepare.js")()'
}
```

#### hoppla.error
Only exists in the hoppla object of finalize. If hoppla somewhere throwed an error, it will be accessible in `hoppla.error`. This allows you to add sensible logic to your custom javascript:

```js
{
  finalize: 'if (hoppla.error) console.log("Please restart windows")'
}
```

#### hoppla.call
Only exists in the hoppla object of prepare/finalize. Use this to call separate hoppla-js processes. Check out the "Call hoppla from javascript" chapter for more details.

## Call hoppla from javascript
Instead of using the cli for hoppla, you also can instead require and call it with javascript like in this example:

```js
const hoppla = require('hoppla');
Promise.resolve()
  .then(() => {
    return hoppla({
      input: {
        userName: 'john'
      },
      template: 'folder/to/template',
      destination: 'folder/to/destination'
      // force: true,
      // ejsOptions: { customEjsOptions... }
    })
  })
  .then(() => {
    // hoppla is done
  })
```