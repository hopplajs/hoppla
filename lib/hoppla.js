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

const executeJsFromString = function(jsString, context) {
  return aPromise.resolve().then(() => {
    var eval2 = eval;

    try {
      var generateFunction = eval2(`(function(hoppla) { ${jsString} })`);
    } catch (err) {
      console.error("Parsing of JS failed");
      throw err;
    }

    try {
      var result = generateFunction(context);
    } catch (err) {
      console.error("Execution of JS failed");
      throw err;
    }

    return result;
  });
};

const readTemplateFromFileInfo = function(config, fileInfo) {
  let content = fs.readFileSync(fileInfo.path, "utf8");

  try {
    content = ejs.render(config, content);
  } catch (err) {
    console.error(`Could not render EJS in "${fileInfo.pathOrig}"`);
    throw err;
  }

  const fileConfig = userFileConfig.createWithFileHeader(fileInfo, content);

  content = userFileConfig.cleanFileHeaderContent(content);

  return {
    content,
    config: fileConfig
  };
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
    var rootHopplaConfig = readPureHopplaConfig(config, {
      path: rootHopplaConfigPath,
      pathOrig: rootHopplaConfigPath
    });

    if (rootHopplaConfig.input) {
      Config.input.set(
        config,
        util.mergeDeep(rootHopplaConfig.input, Config.input.get(config))
      );
    }

    if (rootHopplaConfig.rawGlobs) {
      Config.rawGlobs.set(config, rootHopplaConfig.rawGlobs);
    }

    if (rootHopplaConfig.excludeGlobs) {
      Config.excludeGlobs.set(config, rootHopplaConfig.excludeGlobs);
    }
  } catch (err) {
    console.error(`Error while reading ${rootHopplaConfigPath}`);
    throw err;
  }

  return Promise.resolve()
    .then(() => {
      return aPromise
        .resolve()
        .then(() => {
          createTmpDir(config);
        })
        .catch(err => {
          console.error(`Failed to create the tmp folder`);
          throw err;
        });
    })
    .then(() => {
      if (rootHopplaConfig.prepare) {
        return executeJsFromString(rootHopplaConfig.prepare, {
          input: Config.input.get(config),
          template: Config.template.get(config),
          tmp: Paths.getTemplateTmpDir(config),
          destination: Config.destination.get(config),
          require: file => {
            var filePath = path.resolve(Config.root.get(config), file);
            return require(filePath);
          }
        }).catch(err => {
          console.error(
            `Failed to execute the prepare JS in ${rootHopplaConfigPath}`
          );
          throw err;
        });
      }
    })
    .then(() => {
      // Step: prepareTmp
      return applyTransformationRecursive({
        config,
        targetFileInfo: {
          path: Paths.getTemplateTmpDir(config),
          pathOrig: Config.template.get(config)
        }
      }).catch(err => {
        console.error("Failed to prepare the temporary template files");
        throw err;
      });
    })
    .then(() => {
      // Step: Copy tmp contents to destination
      return aPromise
        .resolve()
        .then(() => {
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
        .catch(err => {
          console.error(`Failed to copy template to destination`);
          throw err;
        });
    })
    .catch(err => {
      if (err.longStack) {
        console.error(err.longStack);
      } else {
        console.error(err);
      }

      return err;
    })
    .then(err => {
      cleanTmpDir(config);

      if (rootHopplaConfig.finalize) {
        return executeJsFromString(rootHopplaConfig.finalize, {
          error: err,
          input: Config.input.get(config),
          template: Config.template.get(config),
          destination: Config.destination.get(config),
          require: file => {
            var filePath = path.resolve(Config.root.get(config), file);
            return require(filePath);
          }
        }).catch(err => {
          console.error(
            `Failed to execute the finalize JS in ${rootHopplaConfigPath}`
          );
          throw err;
        });
      }
    })
    .catch(err => {
      if (err.longStack) {
        console.error(err.longStack);
      } else {
        console.error(err);
      }
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

    try {
      hopplaConfigContent = ejs.render(config, hopplaConfigContent);
    } catch (err) {
      console.error(
        `Could not render EJS in "${hopplaConfigFileInfo.pathOrig}"`
      );
      throw err;
    }

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
        const rawGlobs = Config.rawGlobs.get(config);
        const matches = micromatch([targetFileInfo.pathOrigRelative], rawGlobs);
        targetFileInfo.raw = matches.length > 0;
      }

      // If it isnt a raw file, read its contents and apply the template transformations
      if (!targetFileInfo.raw && !targetFileInfo.isDirectory) {
        const targetFile = readTemplateFromFileInfo(config, targetFileInfo);
        hopplaConfig = util.mergeDeep(hopplaConfig, targetFile.config);
        targetFileInfo.content = targetFile.content;
      }

      // Check if the file is configured as excluded file
      if (hopplaConfig.exclude != null) {
        targetFileInfo.exclude = hopplaConfig.exclude;
      } else {
        const excludeGlobs = Config.excludeGlobs.get(config);
        const matches = micromatch(
          [targetFileInfo.pathOrigRelative],
          excludeGlobs
        );
        targetFileInfo.exclude = matches.length > 0;
      }

      if (!ignoreGenerate && hopplaConfig.generate) {
        targetFileInfo.exclude = true;

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
            return executeJsFromString(hopplaConfig.generate, generateOptions);
          })
          .catch(err => {
            console.error(
              `Hopplaconfig Generate in "${
                targetFileInfo.pathOrig
              }" could not be executed`
            );
            throw err;
          });
      }
    })
    .then(() => {
      if (targetFileInfo.exclude) {
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
