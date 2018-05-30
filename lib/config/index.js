const Destination = require("./destination");
const Template = require("./template");
const Input = require("./input");
const Ejs = require("./ejs");
const Root = require("./root");
const Globs = require("./globs");

const create = function({ destination, template, input, ejs }) {
  let config = {};

  Destination.set(config, destination);
  Template.set(config, template);
  Input.set(config, input);
  Root.set(config, Template.get(config));

  Globs.setWithDefaults(config);
  Ejs.setWithDefaults(config, ejs);

  return config;
};

module.exports = {
  create,
  globs: Globs,
  ejs: Ejs,
  root: Root,
  input: Input,
  destination: Destination,
  template: Template
};
