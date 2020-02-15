## Changelog

### 0.14.0
- FEATURE: Added `exclude` param to `copyRecursive`

### 0.13.0

**BREAKING**: If you used hoppla's js api, you have to update your require statement:

```js
// Old require:
const hoppla = require('hoppla')
// New require:
const { hoppla } = require'hoppla')
```

- FEATURE: Added public `copyRecursive` js api

### 0.12.0
- FEATURE: Implemented new "init" config, a callback that is called after the tmp directory is created (and still is empty)

### 0.11.1
- FEATURE: Cleanup recursive copy processes, removed redundant code

### 0.11.0
- FEATURE: The file copy process should consider dot files
- FEATURE: Each hoppla process should use an unique identifier for its tmp directory. This makes sure that parallel hoppla processes with the same destination can run without side effects
- FEATURE: Updated dependencies: ejs, hjson, micromatch, prettier

### 0.10.1
- BUGFIX: Dont follow symlinks, copy them as is

### 0.10.0
- Moved changelog into CHANGELOG.md file
- FEATURE: File permissions will now be preserved for hop.ejs files and directories
- FEATURE: Added console logs for prepare and finalize JS execution

### 0.9.1
Fixed console warning, when copying and merging empty directories without files

### 0.9.0
- Fixed raw directory override: Raw directories will now replace old ones instead of merging
- Fixed files that should replace folders in the destination moved into the destination instead
- Added mkdir -p to the fileName option, so the option now even can be used to use file names like "newFolder/myFileName"
- Upgraded dependencies: hjson, shelljs, yaku, yargs and prettier
### 0.8.0
Improved defaults for ejs processing
- Only hopplaconfig's and files suffixed with `.hop.ejs` will be processed with ejs
- For *.hop.ejs the hopplaconfig filename doesnt need the `.hop.ejs` suffix
  - Example: Target file: `app.js.hop.ejs` -> hopplaconfig for target file: `app.js.hopplaconfig`
### 0.7.0
Better folder renaming logic (fileName): if multiple folders use the same fileName their children will be merged together
### 0.6.0
- Documented javascript usage
- Fixed error if no ejs option was provided with js "hoppla"-function
- Added "call" function to the prepare/finalize hoppla object
### 0.5.0
Bugfixes, better error logs and performance improvements

- FEATURE ff5e0b0: Copy raw directories without custom handler, remove tmp with force (copied only read files, could not be removed otherwise)
- FEATURE e525485: Early exclude files, dont show stacktrace for ejs and special cases
### 0.4.0
Bugfixes and extra logs
- BUGFIX b795cf9: Fix hopplaconfig always has to exist
- FEATURE a91046d: Added extra log infos
- BUGFIX f923a28: Fix file-exist check uses wrong path
### 0.3.1
README improvements
### 0.3.0
Promises, Errorhandling, LongStackTraces,
### 0.2.0
Input piping, HSJON support, config standardization, Generate option
### 0.1.0
Refactorings, config changes, Corrected destination merge logic
### 0.0.1
Initial release