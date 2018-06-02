const get = config => config.excludeGlobs;
const set = (config, globs) => (config.excludeGlobs = globs);

const setWithDefaults = config => set(config, []);

module.exports = {
  get,
  set,
  setWithDefaults
};
