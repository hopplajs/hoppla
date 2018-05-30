const path = require("path");
const fs = require("fs");

const verify = template => {
  if (!path.isAbsolute(template)) {
    template = path.resolve(template);
  }
  if (!fs.existsSync(template)) {
    throw `Template "${template}" doesnt exist`;
  }

  var sourceStats = fs.statSync(template);
  var templateIsDirectory = sourceStats.isDirectory();
  if (!templateIsDirectory) {
    throw `Template "${template}" has to be a directory`;
  }

  return template;
};

const set = function(config, template) {
  template = verify(template);

  config.template = template;
};

const get = config => config.template;

module.exports = {
  get,
  set
};
