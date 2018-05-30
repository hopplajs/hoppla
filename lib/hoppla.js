const path = require("path");
const shell = require("shelljs");
const fs = require("fs");
const micromatch = require("micromatch");

const aPromise = require("yaku");
aPromise.enableLongStackTrace();

const util = require("./util");
const Config = require("./config");
const Paths = require("./paths");
const ejs = require("./ejs");
const userFileConfig = require("./userFileConfig");

const createTmpDir = function(config) {
  const tmpDir = Paths.getTmpDir(config);
  shell.mkdir("-p", tmpDir);

  const templateTmpDir = Paths.getTemplateTmpDir(config);
  if (fs.existsSync(templateTmpDir)) {
    shell.rm("-r", templateTmpDir);
  }

  const template = Config.template.get(config);
  shell.cp("-r", template, templateTmpDir);
};

const cleanTmpDir = function(config) {
  const tmpDir = Paths.getTmpDir(config);
  shell.rm("-r", tmpDir);
};

const readTemplateFromFileInfo = function(config, fileInfo) {
  let content = fs.readFileSync(fileInfo.path, "utf8");
  content = ejs.render(config, content);

  const fileConfig = userFileConfig.createWithFileHeader(fileInfo, content);

  content = userFileConfig.cleanFileHeaderContent(content);

  return {
    content,
    config: fileConfig
  };
};

const catchError = function(error, shouldThrow) {
  console.error("Something went wrong:");

  if (shouldThrow) {
    throw error;
  }

  if (error.longStack) {
    console.error(error.longStack);
  } else {
    console.error(error);
  }

  return error;
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
  const config = Config.create({
    destination: options.destination,
    template: options.template,
    input: options.input,
    ejs: options.ejsOptions
  });

  const rootHopplaConfigPath = path.resolve(
    Config.template.get(config),
    "hopplaconfig"
  );
  try {
    const rootHopplaConfig = readPureHopplaConfig(config, {
      path: rootHopplaConfigPath,
      pathOrig: rootHopplaConfigPath
    });

    if (rootHopplaConfig.input) {
      Config.input.set(
        config,
        util.mergeDeep(rootHopplaConfig.input, Config.input.get(config))
      );
    }

    if (rootHopplaConfig.input) {
      Config.input.set(
        config,
        util.mergeDeep(rootHopplaConfig.input, Config.input.get(config))
      );
    }

    if (rootHopplaConfig.globs) {
      Config.globs.set(
        config,
        util.mergeDeep(Config.globs.get(config), rootHopplaConfig.globs)
      );
    }
  } catch (err) {
    catchError(err, true);
  }

  createTmpDir(config);

  return applyTransformationRecursive({
    config,
    targetFileInfo: {
      path: Paths.getTemplateTmpDir(config),
      pathOrig: Config.template.get(config)
    }
  })
    .then(() => {})
    .catch(catchError)
    .then(err => {
      if (err) return err;

      var templateTmpDir = Paths.getTemplateTmpDir(config);
      var destination = Config.destination.get(config);
      var templateFiles = fs.readdirSync(templateTmpDir);
      templateFiles.forEach(file => {
        var filePath = path.resolve(templateTmpDir, file);
        copyRecursive({
          config,
          force: options.force,
          source: filePath,
          destination: destination
        });
      });
    })
    .then(err => {
      cleanTmpDir(config);

      return err;
    });
};
module.exports = hoppla;

var copyRecursive = function(options) {
  var config = options.config;
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
        config,
        force,
        source: filePath,
        destination: destinationAndSource
      });
    });
  } else {
    const destinationRoot = Config.destination.get(config);
    const relativeDestinationAndSource = path.relative(
      destinationRoot,
      destinationAndSource
    );

    if (!force && fs.existsSync(relativeDestinationAndSource)) {
      console.warn(`File already exists: "${relativeDestinationAndSource}"`);
      return;
    }

    shell.cp(source, destinationAndSource);

    console.info(`File created: "${relativeDestinationAndSource}"`);
  }
};

const readPureHopplaConfig = function(config, hopplaConfigFileInfo) {
  var hopplaConfig = {};
  if (hopplaConfigFileInfo) {
    var hopplaConfigContent = fs.readFileSync(
      hopplaConfigFileInfo.path,
      "utf8"
    );
    hopplaConfigContent = ejs.render(config, hopplaConfigContent);
    try {
      hopplaConfig = Config.input.parse(hopplaConfigContent);
    } catch (err) {
      console.error(
        `Hopplaconfig invalid in "${hopplaConfigFileInfo.pathOrig}"`
      );
      throw err;
    }
  }

  return hopplaConfig;
};

const applyTransformationRecursive = function({
  config,
  targetFileInfo,
  hopplaConfigFileInfo,
  ignoreGenerate
}) {
  var hopplaConfig;

  // Ignore root config file
  const targetBaseName = path.basename(targetFileInfo.path);
  if (targetBaseName === "hopplaconfig") {
    shell.rm(targetFileInfo.path);
    return;
  }

  return aPromise
    .resolve()
    .then(() => {
      targetFileInfo.pathOrigRelative = path.relative(
        Config.template.get(config),
        targetFileInfo.pathOrig
      );

      const targetStats = fs.statSync(targetFileInfo.path);
      targetFileInfo.isDirectory = targetStats.isDirectory();

      hopplaConfig = readPureHopplaConfig(config, hopplaConfigFileInfo);

      // Check if the file is configured as raw file
      if (hopplaConfig.raw != null) {
        targetFileInfo.raw = hopplaConfig.raw;
      } else {
        const rawGlobs = Config.globs.get(config).raw;
        const matches = micromatch([targetFileInfo.pathOrigRelative], rawGlobs);
        targetFileInfo.raw = matches.length > 0;
      }

      // If it isnt a raw file, read its contents and apply the template transformations
      if (!targetFileInfo.raw && !targetFileInfo.isDirectory) {
        const targetFile = readTemplateFromFileInfo(config, targetFileInfo);
        hopplaConfig = util.mergeDeep(hopplaConfig, targetFile.config);
        targetFileInfo.content = targetFile.content;
      }

      if (!ignoreGenerate && hopplaConfig.generate) {
        hopplaConfig.ignore = true;

        var eval2 = eval;
        try {
          var generateFunction = eval2(
            `(function(hoppla) { ${hopplaConfig.generate} })`
          );
        } catch (err) {
          console.error(
            `Hopplaconfig Generate in "${
              targetFileInfo.pathOrig
            }" could not be executed`
          );
          throw err;
        }

        var generateIndex = 0;
        // TODO: separate these functions
        var generateOptions = {
          require: file => {
            var filePath = path.resolve(Config.root.get(config), file);
            return require(filePath);
          },
          generate: mutatedInput => {
            generateIndex++;

            var baseName = path.basename(targetFileInfo.path);
            var parentDir = path.dirname(targetFileInfo.path);

            var newTargetPath = path.resolve(
              parentDir,
              `${generateIndex}_hoppla_${baseName}`
            );
            if (targetFileInfo.isDirectory) {
              shell.cp("-r", targetFileInfo.path, newTargetPath);
            } else {
              shell.cp(targetFileInfo.path, newTargetPath);
            }

            var nextConfig = util.mergeDeep({}, config);
            if (mutatedInput) {
              Config.input.set(nextConfig, mutatedInput);
            }

            var generateFileOptions = {
              config: nextConfig,
              targetFileInfo: {
                path: newTargetPath,
                pathOrig: targetFileInfo.pathOrig
              },
              hopplaConfigFileInfo,
              ignoreGenerate: true
            };

            return applyTransformationRecursive(generateFileOptions);
          },
          input: util.mergeDeep({}, Config.input.get(config))
        };

        return aPromise
          .resolve()
          .then(() => {
            return generateFunction(generateOptions);
          })
          .catch(err => {
            console.error(
              `Hopplaconfig Generate in "${
                targetFileInfo.pathOrig
              }" could not be executed`
            );
            catchError(err);
          });
      }
    })
    .then(() => {
      // TODO: Implement ignore globs
      if (hopplaConfig.ignore) {
        if (targetFileInfo.isDirectory) {
          shell.rm("-r", targetFileInfo.path);
        } else {
          shell.rm(targetFileInfo.path);
        }

        return;
      }

      if (hopplaConfig.fileName) {
        var targetOld = targetFileInfo.path;
        var targetparent = path.dirname(targetFileInfo.path);
        targetFileInfo.path = path.resolve(targetparent, hopplaConfig.fileName);
        shell.mv(targetOld, targetFileInfo.path);
      }

      if (targetFileInfo.isDirectory) {
        return applyTransformationDirectory({
          config,
          targetFileInfo
        });
      } else {
        if (!targetFileInfo.raw) {
          fs.writeFileSync(targetFileInfo.path, targetFileInfo.content);
        }
      }
    })
    .then(() => {
      return targetFileInfo;
    });
};

const applyTransformationDirectory = function({ config, targetFileInfo }) {
  return aPromise
    .resolve()
    .then(() => {
      var children = fs.readdirSync(targetFileInfo.path);

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

      let nextTransformationsPromise = aPromise.resolve();

      children.forEach(fileName => {
        const nextTargetFileInfo = {
          path: path.resolve(targetFileInfo.path, fileName),
          pathOrig: path.resolve(targetFileInfo.pathOrig, fileName)
        };

        let nextTransformationConfig = {
          config: util.mergeDeep({}, config),
          targetFileInfo: nextTargetFileInfo
        };

        const hopplaConfigPath = hopplaConfigByFileName[fileName];

        if (hopplaConfigPath) {
          const nextTargetHopplaConfigFileInfo = {
            path: path.resolve(targetFileInfo.path, hopplaConfigPath),
            pathOrig: path.resolve(
              targetFileInfo.pathOrig,
              hopplaConfigByFileName[fileName]
            )
          };
          nextTransformationConfig.hopplaConfigFileInfo = nextTargetHopplaConfigFileInfo;
        }

        nextTransformationsPromise = nextTransformationsPromise.then(() => {
          return applyTransformationRecursive(nextTransformationConfig);
        });
      });

      return nextTransformationsPromise.then(() => {
        return hopplaConfigByFileName;
      });
    })
    .then(hopplaConfigByFileName => {
      // Delete old hopplaConfig files
      Object.values(hopplaConfigByFileName).forEach(hopplaConfigFileName => {
        var hopplaConfigFilePath = path.resolve(
          targetFileInfo.path,
          hopplaConfigFileName
        );
        shell.rm(hopplaConfigFilePath);
      });
    });
};
