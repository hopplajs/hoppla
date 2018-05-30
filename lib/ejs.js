var Config = require("./config");
var ejs = require("ejs");

const render = function(config, content) {
  const input = Config.input.get(config);
  const ejsConfig = Config.ejs.get(config);

  return ejs.render(
    content,
    {
      input
    },
    ejsConfig
  );
};

module.exports = {
  render
};
