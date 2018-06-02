const Destination = require("./destination");
const Template = require("./template");
const Input = require("./input");
const Ejs = require("./ejs");
const Root = require("./root");
const RawGlobs = require("./rawGlobs");
const ExcludeGlobs = require("./excludeGlobs");

const create = function({ destination, template, input, ejs }) {
  let config = {};

  Destination.set(config, destination);
  Template.set(config, template);
  Input.set(config, input);
  Root.set(config, Template.get(config));

  RawGlobs.setWithDefaults(config);
  ExcludeGlobs.setWithDefaults(config);
  Ejs.setWithDefaults(config, ejs);

  return config;
};

module.exports = {
  create,
  rawGlobs: RawGlobs,
  excludeGlobs: ExcludeGlobs,
  ejs: Ejs,
  root: Root,
  input: Input,
  destination: Destination,
  template: Template
};
