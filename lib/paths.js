const path = require("path");
const Config = require("./config");

const getTemplateTmpDir = function(config) {
  const tmpDir = getTmpDir(config);
  const template = Config.template.get(config);
  const templateBaseName = path.basename(template);

  return path.resolve(tmpDir, templateBaseName);
};

const getTmpDir = function(config) {
  const destinationDir = Config.destination.get(config);

  return path.resolve(destinationDir, "tmp-hoppla");
};

module.exports = {
  getTmpDir,
  getTemplateTmpDir
};
