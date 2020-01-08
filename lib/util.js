const shell = require("shelljs");
const path = require("path");
const fs = require("fs");

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
 * Merges the content from sourceDir to the destinationDir and creates destinationDir, if it doesnt exist
 *
 * @param {Object} options
 * @param {string} options.sourceDir Absolute source directory path
 * @param {string} options.destinationDir Absolute destination directory path
 */
const mergeDirectories = function({ sourceDir, destinationDir }) {
  if (!shell.ls("-A", sourceDir).length) {
    return;
  }

  shell.mkdir("-p", destinationDir);
  const sourceDirFiles = fs.readdirSync(sourceDir);
  sourceDirFiles.forEach(file => {
    shell.cp("-r", path.join(sourceDir, file), path.join(destinationDir, file));
  });
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

module.exports = {
  mergeDeep,
  escapeRegExp,
  mergeDirectories,
  convertStatModeToOctal
};
