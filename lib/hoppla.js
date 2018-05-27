var path = require("path");
var shell = require("shelljs");
var fs = require("fs");
var ejs = require("ejs");
const Input = require("./lib/input.js");

var defaultEjsOptions = {
  delimiter: "%",
  compileDebug: true
};

var verifyDestinationOption = destination => {
  if (!path.isAbsolute(destination)) {
    destination = path.resolve(destination);
  }
  shell.mkdir("-p", destination);

  return destination;
};

var verifyTemplateOption = template => {
  var template = options.template;
  if (!path.isAbsolute(template)) {
    template = path.resolve(template);
  }
  if (!fs.existsSync(template)) {
    throw `Template "${template}" doesnt exist`;
  }

  return template;
};

/**
 * Creates in the destination new files based on the template and adds the input to the files with ejs
 *
 * @param {object} options
 * @param {string} options.template (Required) Path to the template folder
 * @param {string} options.destination (Required) Path to the destination folder
 * @param {object} options.input Data available in the template
 * @param {object} options.ejsOptions EJS options
 * @param {boolean} options.force Overwrite existing files
 */
var hoppla = function(options) {
  var destination = verifyDestinationOption(options.destination);
  var template = verifyTemplateOption(options.template);
  var templateBasename = path.basename(template);

  return Promise.resolve().then(() => {});

  var ejsOptions = Object.assign({}, defaultEjsOptions);

  var sourceStats = fs.statSync(template);
  var templateIsDirectory = sourceStats.isDirectory();
  if (!templateIsDirectory) {
    throw `Template "${template}" has to be a directory`;
  }
  ejsOptions.root = template;

  if (options.ejsOptions) {
    ejsOptions = Object.assign(ejsOptions, options.ejsOptions);
  }

  var tmpDir = path.resolve(destination, "tmp-hoppla");
  shell.mkdir("-p", tmpDir);

  var templateTmp = path.resolve(tmpDir, templateBasename);
  if (fs.existsSync(templateTmp)) {
    shell.rm("-r", templateTmp);
  }
  shell.cp("-r", template, templateTmp);

  var input = {
    input: options.input ? options.input : {}
  };

  try {
    templateTmp = applyTransformationRecursive({
      input: input,
      target: templateTmp,
      targetOriginal: template,
      ejsOptions,
      root: template
    });

    var templateFiles = fs.readdirSync(templateTmp);
    templateFiles.forEach(file => {
      var filePath = path.resolve(templateTmp, file);
      copyRecursive({
        force: options.force,
        source: filePath,
        destination: destination
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    shell.rm("-r", tmpDir);
  }
};
module.exports = hoppla;

const fileHeaderHopplaConfigRegex = /^###hopplaconfig((\s|\S)*)hopplaconfig###(\s*\n)?/;

var copyRecursive = function(options) {
  var force = !!options.force;
  var source = options.source;
  var sourceBasename = path.basename(source);
  var destination = options.destination;
  var destinationAndSource = path.resolve(destination, sourceBasename);

  var sourceStats = fs.statSync(source);
  var isDirectory = sourceStats.isDirectory();

  if (isDirectory) {
    shell.mkdir("-p", destinationAndSource);
    var children = fs.readdirSync(source);
    children.forEach(fileName => {
      var filePath = path.resolve(source, fileName);
      copyRecursive({
        force,
        source: filePath,
        destination: destinationAndSource
      });
    });
  } else {
    if (!force && fs.existsSync(destinationAndSource)) {
      console.warn(`File already exists: "${destinationAndSource}"`);
      return;
    }

    shell.cp(source, destinationAndSource);
  }
};

const originalFileNames = {};

var applyTransformationRecursive = function(options) {
  var input = options.input;
  var target = options.target;
  var targetOriginal = options.targetOriginal;
  var targetOld;
  var originalFileName = originalFileNames[target]
    ? originalFileNames[target]
    : targetOriginal;

  var targetStats = fs.statSync(target);
  var isDirectory = targetStats.isDirectory();

  var hopplaConfig = {};
  if (options.hopplaConfig) {
    var hopplaConfigContent = fs.readFileSync(options.hopplaConfig, "utf8");
    hopplaConfigContent = ejs.render(
      hopplaConfigContent,
      input,
      options.ejsOptions
    );
    try {
      hopplaConfig = Input.parse(hopplaConfigContent);
    } catch (err) {
      console.error(
        `Hopplaconfig invalid in "${options.hopplaConfigOriginal}"`
      );
      throw err;
    }
  }

  var fileContent = "";

  if (!isDirectory) {
    fileContent = fs.readFileSync(target, "utf8");
    fileContent = ejs.render(fileContent, input, options.ejsOptions);
    var fileHeaderHopplaConfig = fileContent.match(fileHeaderHopplaConfigRegex);
    var ignore = false;
    if (fileHeaderHopplaConfig && fileHeaderHopplaConfig[1]) {
      fileContent = fileContent.replace(fileHeaderHopplaConfigRegex, "");

      try {
        fileHeaderHopplaConfig = Input.parse(fileHeaderHopplaConfig[1]);
      } catch (err) {
        console.error(`Hopplaconfig invalid in "${originalFileName}"`);
        throw err;
      }

      hopplaConfig = Object.assign({}, hopplaConfig, fileHeaderHopplaConfig);
    }
  }

  if (!options.ignoreGenerate && hopplaConfig.generate) {
    var eval2 = eval;
    try {
      var generateFunction = eval2(
        `(function(hoppla) { ${hopplaConfig.generate} })`
      );
    } catch (err) {
      console.error(
        `Hopplaconfig Generate in "${originalFileName}" could not be executed`
      );
      throw err;
    }

    var generateIndex = 0;
    // TODO: separate these functions
    var generateOptions = {
      require: file => {
        var filePath = path.resolve(options.root, file);
        return require(filePath);
      },
      generate: mutatedInput => {
        generateIndex++;
        var baseName = path.basename(target);
        var parentDir = path.dirname(target);

        var newTarget = path.resolve(
          parentDir,
          `${generateIndex}_hoppla_${baseName}`
        );
        if (isDirectory) {
          shell.cp("-r", target, newTarget);
        } else {
          shell.cp(target, newTarget);
        }

        var newInput = Object.assign({}, input);
        newInput.input = mutatedInput;

        var generateFileOptions = {
          target: newTarget,
          targetOriginal,
          hopplaConfig: options.hopplaConfig,
          hopplaConfigOriginal: options.hopplaConfigOriginal,
          ejsOptions: options.ejsOptions,
          input: newInput,
          ignoreGenerate: true,
          root: options.root
        };
        applyTransformationRecursive(generateFileOptions);
      },
      input: Object.assign({}, input.input)
    };

    try {
      generateFunction(generateOptions);
    } catch (err) {
      console.error(
        `Hopplaconfig Generate in "${originalFileName}" could not be executed`
      );
      throw err;
    }

    hopplaConfig.ignore = true;
  }

  if (hopplaConfig.ignore) {
    if (isDirectory) {
      shell.rm("-r", target);
    } else {
      shell.rm(target);
    }

    return target;
  }

  if (hopplaConfig.fileName) {
    var targetOld = target;
    target = path.dirname(target);
    target = path.resolve(target, hopplaConfig.fileName);
    if (isDirectory) {
      shell.mv(targetOld, target);
    } else {
      shell.rm(targetOld);
    }
  }

  if (isDirectory) {
    var children = fs.readdirSync(target);

    // Get hopplaConfig file names
    var hopplaConfigByFileName = {};
    children = children.filter(hopplaConfigFileName => {
      if (hopplaConfigFileName.endsWith(".hopplaconfig")) {
        var fileName = hopplaConfigFileName.replace(".hopplaconfig", "");
        hopplaConfigByFileName[fileName] = hopplaConfigFileName;
        return;
      }

      return true;
    });

    children.forEach(fileName => {
      var filePath = path.resolve(target, fileName);
      var filePathOriginal = path.resolve(targetOriginal, fileName);

      var hopplaConfigPath = hopplaConfigByFileName[fileName];
      var hopplaConfigPathOriginal = hopplaConfigByFileName[fileName];
      if (hopplaConfigPath) {
        hopplaConfigPath = path.resolve(target, hopplaConfigPath);
        hopplaConfigPathOriginal = path.resolve(
          targetOriginal,
          hopplaConfigPathOriginal
        );
      }

      applyTransformationRecursive({
        target: filePath,
        targetOriginal: filePathOriginal,
        hopplaConfig: hopplaConfigPath,
        hopplaConfigOriginal: hopplaConfigPathOriginal,
        ejsOptions: options.ejsOptions,
        input,
        root: options.root
      });
    });

    // Delete old hopplaConfig files
    Object.values(hopplaConfigByFileName).forEach(hopplaConfigFileName => {
      var hopplaConfigFilePath = path.resolve(target, hopplaConfigFileName);
      shell.rm(hopplaConfigFilePath);
    });
  } else {
    fs.writeFileSync(target, fileContent);
  }

  return target;
};
