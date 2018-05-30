const get = config => config.root;
const set = (config, aRoot) => (config.root = aRoot);

module.exports = {
  get,
  set
};
