const shell = require("shelljs");
const path = require("path");

var verify = destination => {
  if (!path.isAbsolute(destination)) {
    destination = path.resolve(destination);
  }
  shell.mkdir("-p", destination);

  return destination;
};

const set = function(config, destination) {
  destination = verify(destination);

  config.destination = destination;
};

const get = config => config.destination;

module.exports = {
  get,
  set
};
