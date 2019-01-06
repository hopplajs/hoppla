const shell = require("shelljs");
const path = require("path");

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
  sourceDir = path.join(sourceDir, "*");
  shell.cp("-r", sourceDir, destinationDir);
};

module.exports = {
  mergeDeep,
  escapeRegExp,
  mergeDirectories
};
