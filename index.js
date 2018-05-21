var path = require('path');
var shell = require('shelljs');
var fs = require('fs');
var ejs = require('ejs');

var defaultEjsOptions = {
    delimiter: '%',
    compileDebug: true
}

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
    var destination = options.destination;
    if (!path.isAbsolute(destination)) {
        destination = path.resolve(destination);
    }

    shell.mkdir('-p', destination);

    var template = options.template;
    if (!path.isAbsolute(template)) {
        template = path.resolve(template);
    }
    var templateBasename = path.basename(template);

    if (!fs.existsSync(template)) {
        throw `Template "${template}" doesnt exist`;
    }

    var ejsOptions = Object.assign({}, defaultEjsOptions);
    
    var sourceStats = fs.statSync(template);
    var templateIsDirectory = sourceStats.isDirectory();
    if (!templateIsDirectory) {
        throw `Template "${template}" has to be a directory`
    }
    ejsOptions.root = template;

    if (options.ejsOptions) {
        ejsOptions = Object.assign(ejsOptions, options.ejsOptions)
    }

    var tmpDir = path.resolve(destination, 'tmp-hoppla');
    shell.mkdir('-p', tmpDir)

    var templateTmp = path.resolve(tmpDir, templateBasename);
    if (fs.existsSync(templateTmp)) {
        shell.rm('-r', templateTmp);
    }
    shell.cp('-r', template, templateTmp)

    try {
        templateTmp = applyTransformationRecursive({ 
            input: options.input,
            target: templateTmp,
            targetOriginalName: template,
            ejsOptions
        });

        var templateFiles = fs.readdirSync(templateTmp);
        templateFiles.forEach((file) => {
            var filePath = path.resolve(templateTmp, file);
            copyRecursive({
                force: options.force,
                source: filePath,
                destination: destination
            });
        });
    }
    catch(err) {
        console.error(err);
    }
    finally {
        shell.rm('-r', tmpDir)
    }
}
module.exports = hoppla;

const fileHeaderOptionsRegex = /^###hopplaconfig((\s|\S)*)hopplaconfig###(\s*\n)?/;

var copyRecursive = function(options) {
    var force = !!options.force;
    var source = options.source;
    var sourceBasename = path.basename(source);
    var destination = options.destination;
    var destinationAndSource = path.resolve(destination, sourceBasename);

    var sourceStats = fs.statSync(source);
    var isDirectory = sourceStats.isDirectory();

    if (isDirectory) {
        shell.mkdir('-p', destinationAndSource);
        var children = fs.readdirSync(source);
        children.forEach((fileName) => {
            var filePath = path.resolve(source, fileName)
            copyRecursive({
                force,
                source: filePath,
                destination: destinationAndSource
            })
        })
    } else {
        if (!force && fs.existsSync(destinationAndSource)) {
            console.warn(`File already exists: "${destinationAndSource}"`)
            return;
        }
    
        shell.cp(source, destinationAndSource);
    }
}

const originalFileNames = {};

var applyTransformationRecursive = function(options) {
    var input = options.input;
    var target = options.target;
    var targetOriginalName = options.targetOriginalName;
    var targetOld;
    var ejsOptions = options.ejsOptions;

    var targetStats = fs.statSync(target);
    var isDirectory = targetStats.isDirectory();

    if (isDirectory) {
        var ignore = false;
        var hopplaConfigPath = path.resolve(target, 'hopplaconfig');
        if (fs.existsSync(hopplaConfigPath)) {
            var hopplaConfigContent = fs.readFileSync(hopplaConfigPath, 'utf8');
            shell.rm(hopplaConfigPath);
            hopplaConfigContent = ejs.render(hopplaConfigContent, input, ejsOptions);
            try {
                hopplaConfig = JSON.parse(hopplaConfigContent);
            }
            catch(err) {
                var hopplaConfigOriginalPath = path.resolve(targetOriginalName, 'hopplaconfig');
                console.error(`Hopplaconfig invalid in "${hopplaConfigOriginalPath}"`);
                throw err;
            }

            if (hopplaConfig.dirName) {
                targetOld = target;
                target = path.resolve(target, '..', hopplaConfig.dirName);
                shell.mv(targetOld, target);
            }

            if (hopplaConfig.fileNames) {
                Object
                    .keys(hopplaConfig.fileNames)
                    .forEach((oldFileName) => {
                        var newFileName = hopplaConfig.fileNames[oldFileName];
                        var newFileName = path.resolve(target, newFileName);
                        
                        var originalFileName = path.resolve(targetOriginalName, oldFileName);
                        originalFileNames[newFileName] = originalFileName;
                        
                        var oldFileName = path.resolve(target, oldFileName);
                        shell.mv(oldFileName, newFileName);
                    })
            }

            if (hopplaConfig.ignore) {
                ignore = true;
            }
        }

        if (ignore) {
            shell.rm('-r', target);
        } else {
            var children = fs.readdirSync(target);
            children.forEach((fileName) => {
                var filePath = path.resolve(target, fileName);
                var fileOriginalPath = path.resolve(targetOriginalName, fileName);
                applyTransformationRecursive({
                    target: filePath,
                    targetOriginalName: fileOriginalPath,
                    ejsOptions,
                    input
                })
            })
        }
    } else {
        var fileContent = fs.readFileSync(target, 'utf8');
        fileContent = ejs.render(fileContent, input, ejsOptions);
        var fileHeaderOptions = fileContent.match(fileHeaderOptionsRegex);
        var ignore = false;
        if (fileHeaderOptions && fileHeaderOptions[1]) {
            fileContent = fileContent.replace(fileHeaderOptionsRegex, '');

            try {
                fileHeaderOptions = JSON.parse(fileHeaderOptions[1]);
            }
            catch(err) {
                var originalFileName = (originalFileNames[target])? originalFileNames[target]: targetOriginalName;
                console.error(`Hopplaconfig invalid in "${originalFileName}"`);
                throw err;
            }
            
            if (fileHeaderOptions.fileName) {
                var targetOld = target;
                target = path.dirname(target);
                target = path.resolve(target, fileHeaderOptions.fileName);
                shell.rm(targetOld);
            }

            if (fileHeaderOptions.ignore) {
                ignore = true;
            }
        }

        if (ignore) {
            if (fs.existsSync(target)) {
                shell.rm(target);
            }
        } else {
            fs.writeFileSync(target, fileContent);
        }
    }

    return target;
}