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

const HOPPLA_EJS_FILE_SUFFIX = "hop.ejs";
const HOPPLA_EJS_FILE_SUFFIX_REGEX = new RegExp(
  `\.${util.escapeRegExp(HOPPLA_EJS_FILE_SUFFIX)}$`
);

const createTmpDir = function(config) {
  const tmpDir = Paths.getTmpDir(config);
  shell.mkdir("-p", tmpDir);

  const templateTmpDir = Paths.getTemplateTmpDir(config);
  if (fs.existsSync(templateTmpDir)) {
    shell.rm("-rf", templateTmpDir);
  }

  const template = Config.template.get(config);

  copyToTmpRecursive({
    config,
    templateTmpDir,
    source: template,
    destination: tmpDir
  });
};

const copyToTmpRecursive = function(options) {
  const templateTmpDir = options.templateTmpDir;
  var config = options.config;
  var source = options.source;
  var sourceBasename = path.basename(source);
  var destination = options.destination;
  var destinationAndSource = path.resolve(destination, sourceBasename);

  const excludeGlobs = Config.excludeGlobs.get(config);
  const relativeDestination = path.relative(
    templateTmpDir,
    destinationAndSource
  );
  const matches = micromatch([relativeDestination], excludeGlobs);
  if (matches.length > 0) {
    return;
  }

  // TODO: Maybe also handle raw globs for directories while copying to tmp (raw directories could be shell.cp'd directly)
  // This needs more experience, not sure if it even would make a difference performance wise

  var sourceStats = fs.statSync(source);
  var isDirectory = sourceStats.isDirectory();

  if (isDirectory) {
    shell.mkdir("-p", destinationAndSource);
    var children = fs.readdirSync(source);
    children.forEach(fileName => {
      var filePath = path.resolve(source, fileName);
      copyToTmpRecursive({
        ...options,
        source: filePath,
        destination: destinationAndSource
      });
    });
  } else {
    shell.cp(source, destinationAndSource);
  }
};

const cleanTmpDir = function(config) {
  const tmpDir = Paths.getTmpDir(config);
  shell.rm("-rf", tmpDir);
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
    console.error(err.message);
    console.error(`Could not render EJS in "${fileInfo.pathOrig}"`);
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
      console.log(
        `Preparing files from template: ${Config.template.get(config)}`
      );

      if (rootHopplaConfig.prepare) {
        return executeJsFromString(rootHopplaConfig.prepare, {
          input: Config.input.get(config),
          template: Config.template.get(config),
          tmp: Paths.getTemplateTmpDir(config),
          destination: Config.destination.get(config),
          require: file => {
            var filePath = path.resolve(Config.root.get(config), file);
            return require(filePath);
          },
          call: hoppla
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
        rootConfig: config,
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

          console.log(`Copying prepared files to ${destination}`);

          var templateFiles = fs.readdirSync(templateTmpDir);
          templateFiles.forEach(file => {
            var filePath = path.resolve(templateTmpDir, file);
            copyToDestinationRecursive({
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
          },
          call: hoppla
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

var copyToDestinationRecursive = function(options) {
  var config = options.config;
  var force = !!options.force;
  var source = options.source;
  var sourceBasename = path.basename(source);
  var destination = options.destination;
  var destinationAndSource = path.resolve(destination, sourceBasename);

  var sourceStats = fs.statSync(source);
  var isDirectory = sourceStats.isDirectory();

  if (isDirectory) {
    const cache = Config.cache.get(config);
    cache.rawDirectories = cache.rawDirectories || {};
    var isRawDirectory = cache.rawDirectories[source];

    if (isRawDirectory) {
      const destinationRoot = Config.destination.get(config);
      const relativeDestinationAndSource = path.relative(
        destinationRoot,
        destinationAndSource
      );

      if (fs.existsSync(destinationAndSource)) {
        if (!force) {
          console.warn(
            `Folder already exists: "${relativeDestinationAndSource}"`
          );
          return;
        }

        // Already existing raw folders will be removed if force is active
        // A raw folder is handled like a single file.
        // As example: an old raw .git folder will be replaced by the new one, it doesnt make sense to merge old and new one
        shell.rm("-rf", destinationAndSource);
      }

      util.mergeDirectories({
        sourceDir: source,
        destinationDir: destinationAndSource
      });

      console.info(`Folder created: "${relativeDestinationAndSource}"`);
    } else {
      shell.mkdir("-p", destinationAndSource);
      var children = fs.readdirSync(source);
      children.forEach(fileName => {
        var filePath = path.resolve(source, fileName);
        copyToDestinationRecursive({
          config,
          force,
          source: filePath,
          destination: destinationAndSource
        });
      });
    }
  } else {
    const destinationRoot = Config.destination.get(config);
    const relativeDestinationAndSource = path.relative(
      destinationRoot,
      destinationAndSource
    );

    if (fs.existsSync(destinationAndSource)) {
      if (!force) {
        console.warn(`File already exists: "${relativeDestinationAndSource}"`);
        return;
      }

      // Just doing this for this very special case:
      // If the destination is a folder and the new thing is a file, the folder has to be removed, because
      // the new file otherwise would end up in the old folder =)
      shell.rm("-rf", destinationAndSource);
    }

    shell.cp(source, destinationAndSource);

    console.info(`File created: "${relativeDestinationAndSource}"`);
  }
};

const readPureHopplaConfig = function(config, hopplaConfigFileInfo) {
  var hopplaConfig = {};
  if (hopplaConfigFileInfo && fs.existsSync(hopplaConfigFileInfo.path)) {
    var hopplaConfigContent = fs.readFileSync(
      hopplaConfigFileInfo.path,
      "utf8"
    );

    try {
      hopplaConfigContent = ejs.render(config, hopplaConfigContent);
    } catch (err) {
      console.error(err.message);
      console.error(
        `Could not render EJS in "${hopplaConfigFileInfo.pathOrig}"`
      );
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
  rootConfig,
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
        if (!targetFileInfo.isDirectory) {
          // Only hoppla configs and ejs files will be processed with the (ejs) template engine,
          // all other files are raw.
          // We cannot set directories to raw because raw directories will be copied with cp and
          // not with hoppla specific recursive logic
          targetFileInfo.raw =
            micromatch(
              [targetFileInfo.pathOrigRelative],
              ["**/*", "!**/*hopplaconfig", `!**/*.${HOPPLA_EJS_FILE_SUFFIX}`]
            ).length > 0;
        }

        const rawGlobs = Config.rawGlobs.get(config);
        const matches = micromatch([targetFileInfo.pathOrigRelative], rawGlobs);
        if (matches.length > 0) {
          targetFileInfo.raw = true;
        }
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
              rootConfig,
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

      if (targetFileInfo.raw) {
        if (targetFileInfo.isDirectory) {
          const cache = Config.cache.get(rootConfig);
          cache.rawDirectories = cache.rawDirectories || {};
          cache.rawDirectories[targetFileInfo.path] = true;
        }

        // Children of raw directories will not be further computed
        return;
      }

      if (targetFileInfo.isDirectory) {
        return applyTransformationDirectory({
          config,
          rootConfig,
          targetFileInfo
        });
      } else {
        try {
          fs.unlinkSync(targetFileInfo.path);
          fs.writeFileSync(targetFileInfo.path, targetFileInfo.content);
        } catch (err) {
          console.error(err.message);
          console.error(`Could not write file: ${targetFileInfo.path}`);
        }
      }
    })
    .then(() => {
      // Apply filename changes

      if (targetFileInfo.exclude) {
        return;
      }

      if (!hopplaConfig.fileName) {
        if (targetFileInfo.path.match(HOPPLA_EJS_FILE_SUFFIX_REGEX)) {
          hopplaConfig.fileName = targetFileInfo.path.replace(
            HOPPLA_EJS_FILE_SUFFIX_REGEX,
            ""
          );
        }
      }

      if (hopplaConfig.fileName) {
        var targetOld = targetFileInfo.path;
        var targetParent = path.dirname(targetFileInfo.path);
        targetFileInfo.path = path.resolve(targetParent, hopplaConfig.fileName);
        targetParent = path.dirname(targetFileInfo.path, "..");

        if (targetOld !== targetFileInfo.path) {
          if (targetFileInfo.isDirectory) {
            util.mergeDirectories({
              sourceDir: targetOld,
              destinationDir: targetFileInfo.path
            });
          } else {
            shell.mkdir("-p", targetParent);
            shell.cp(targetOld, targetFileInfo.path);
          }

          shell.rm("-rf", targetOld);
        }
      }
    })
    .then(() => {
      return targetFileInfo;
    });
};

const applyTransformationDirectory = function({
  config,
  rootConfig,
  targetFileInfo
}) {
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
          rootConfig,
          config: util.mergeDeep({}, config),
          targetFileInfo: nextTargetFileInfo
        };

        // Hopplaconfig matches to the filename without the hoplla suffix
        // Examples (target filename => filename for hopplaconfig of target file)
        // lib/main.js.hop.ejs => lib/main.js.hopplaconfig
        // test.jsx.hop.ejs => test.jsx.hopplaconfig
        const hopplaConfigPath =
          hopplaConfigByFileName[
            fileName.replace(HOPPLA_EJS_FILE_SUFFIX_REGEX, "")
          ];

        if (hopplaConfigPath) {
          const nextTargetHopplaConfigFileInfo = {
            path: path.resolve(targetFileInfo.path, hopplaConfigPath),
            pathOrig: path.resolve(targetFileInfo.pathOrig, hopplaConfigPath)
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
