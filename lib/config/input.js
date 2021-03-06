const Hjson = require("hjson");

const parse = function(input) {
  return Hjson.parse(input);
};

const getFromStdin = function() {
  return new Promise(resolve => {
    var input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("readable", () => {
      var aInput;
      while ((aInput = process.stdin.read())) {
        input += aInput;
      }
    });
    process.stdin.on("end", () => {
      resolve(input);
    });
  });
};

const get = config => config.input;
const set = (config, input) => (config.input = input || {});

module.exports = {
  get,
  set,
  parse,
  getFromStdin
};
