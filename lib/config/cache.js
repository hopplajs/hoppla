const get = config => config.cache;
const set = (config, aCache) => (config.cache = aCache);

const setWithDefaults = config => set(config, {});

module.exports = {
  get,
  set,
  setWithDefaults
};
