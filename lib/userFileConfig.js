const Config = require("./config");

const fileHeaderHopplaConfigRegex = /^###hopplaconfig((\s|\S)*)hopplaconfig###(\s*\n)?/;

const parseConfig = function(fileInfo, config) {
  try {
    config = Config.input.parse(config);
  } catch (err) {
    console.error(`Hopplaconfig invalid in "${fileInfo.pathOrig}"`);
    throw err;
  }

  return config;
};

const createWithFileHeader = function(fileInfo, fileContent) {
  var config = {};

  var matches = fileContent.match(fileHeaderHopplaConfigRegex);
  if (matches && matches[1]) {
    config = parseConfig(fileInfo, matches[1]);
  }

  return config;
};

const cleanFileHeaderContent = function(fileContent) {
  return fileContent.replace(fileHeaderHopplaConfigRegex, "");
};

module.exports = {
  createWithFileHeader,
  cleanFileHeaderContent
};
