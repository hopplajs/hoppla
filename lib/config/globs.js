const get = config => config.globs;
const set = (config, globs) => (config.globs = globs);

const setWithDefaults = config => set(config, { raw: [], ignore: [] });

module.exports = {
  get,
  set,
  setWithDefaults
};
