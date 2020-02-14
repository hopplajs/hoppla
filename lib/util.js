const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const micromatch = require("micromatch");

var isObjectLike = function(obj) {
  return typeof obj == "object" && obj != null;
};

var isObject = function(obj) {
  return isObjectLike(obj) && obj.length == null;
};

var mergeDeep = function(destination = {}, source) {
  Object.keys(source).forEach(key => {
    var value = source[key];
    if (isObject(value)) {
      value = mergeDeep(destination[key], value);
    }

    destination[key] = value;
  });

  return destination;
};

// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// (There was an example for this escape function =))
var escapeRegExp = function(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
};

/**
 * Converts an fs stat mode to the octal permission format
 *
 * @param {Object} options
 * @param {number} options.statMode
 */
const convertStatModeToOctal = function({ statMode }) {
  return "0" + (statMode & parseInt("777", 8)).toString(8);
};

const chmod = function(permissions, filePath) {
  if (process.platform == "win32") {
    return;
  }

  shell.chmod(permissions, filePath);
};

const copyRecursive = function(options) {
  const force = options.force;
  const excludeGlobs = options.excludeGlobs;
  const templateTmpDir = options.templateTmpDir;
  const source = options.source;
  const destination = options.destination;
  const outputProgress = options.outputProgress;
  const rootDestination = options.rootDestination;
  const rawDirectories = options.rawDirectories;

  const relativeDestinationAndSource =
    outputProgress && rootDestination
      ? path.relative(rootDestination, destination)
      : false;

  if (excludeGlobs && templateTmpDir) {
    const relativeDestination = path.relative(templateTmpDir, destination);
    const matches = micromatch([relativeDestination], excludeGlobs);
    if (matches.length > 0) {
      return;
    }
  }

  const sourceStats = fs.statSync(source);
  const isDirectory = sourceStats.isDirectory();

  if (isDirectory) {
    var isRawDirectory = rawDirectories && rawDirectories[source];
    if (isRawDirectory) {
      if (fs.existsSync(destination)) {
        if (!force) {
          console.warn(
            `Folder already exists: "${relativeDestinationAndSource}"`
          );
          return;
        }

        // Already existing raw folders will be removed if force is active
        // A raw folder is handled like a single file.
        // As example: an old raw .git folder will be replaced by the new one, it doesnt make sense to merge old and new one
        shell.rm("-rf", destination);
      }

      copyRecursive({
        source: source,
        destination: destination
      });
      if (relativeDestinationAndSource) {
        console.info(`Folder created: "${relativeDestinationAndSource}"`);
      }
    } else {
      shell.mkdir("-p", destination);
      if (relativeDestinationAndSource) {
        console.info(`Folder created: "${relativeDestinationAndSource}"`);
      }
      var children = fs.readdirSync(source);
      children.forEach(fileName => {
        var filePath = path.resolve(source, fileName);
        copyRecursive({
          ...options,
          source: filePath,
          destination: path.join(destination, fileName)
        });
      });
    }
  } else {
    if (fs.existsSync(destination)) {
      if (!force) {
        if (relativeDestinationAndSource) {
          console.warn(
            `File already exists: "${relativeDestinationAndSource}"`
          );
        }
        return;
      }

      // Just doing this for this very special case:
      // If the destination is a folder and the new thing is a file, the folder has to be removed, because
      // the new file otherwise would end up in the old folder =)
      shell.rm("-rf", destination);
    }

    shell.cp("-P", source, destination);
    if (relativeDestinationAndSource) {
      console.info(`File created: "${relativeDestinationAndSource}"`);
    }
  }

  const octalPermissions = convertStatModeToOctal({
    statMode: sourceStats.mode
  });
  chmod(octalPermissions, destination);
};

module.exports = {
  mergeDeep,
  escapeRegExp,
  convertStatModeToOctal,
  copyRecursive,
  chmod
};
