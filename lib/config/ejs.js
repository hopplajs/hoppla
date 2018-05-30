const util = require("../util");

const defaults = {
  delimiter: "%",
  compileDebug: true
};

const getDefaults = config => {
  const Config = require("./index");

  let newDefaults = util.mergeDeep({}, defaults);
  newDefaults.root = Config.template.get(config);

  return newDefaults;
};

const setWithDefaults = (config, ejs) => {
  const defaults = getDefaults(config);
  const mergedEjs = util.mergeDeep(defaults, ejs);

  set(config, mergedEjs);
};

const set = (config, ejs) => (config.ejs = ejs);
const get = config => config.ejs;

module.exports = {
  get,
  set,
  setWithDefaults
};
