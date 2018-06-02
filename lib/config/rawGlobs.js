const get = config => config.rawGlobs;
const set = (config, globs) => (config.rawGlobs = globs);

const setWithDefaults = config => set(config, []);

module.exports = {
  get,
  set,
  setWithDefaults
};
