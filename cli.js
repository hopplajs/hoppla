#!/usr/bin/env node

var hoppla = require('./index.js');
var argv = require('yargs')
    .options({
        t: { alias: 'template', describe: 'Path to template folder', type: 'string', demandOption: true },
        d: { alias: 'destination', describe: 'Path to destination folder', type: 'string', default: '.' },
        i: { alias: 'input', describe: 'JSON input data', type: 'string'},
        f: { alias: 'force', describe: 'Overwrites existing files', type: 'boolean' },
        'ed': { alias: 'ejs-delimiter', describe: 'Which EJS delimiter to use', type: 'string', default: '%'}
    })
    .argv

var getInputFromPipe = function() {
    return new Promise((resolve) => {
        var input = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('readable', () => {
            var aInput
            while(aInput = process.stdin.read()) {
                input += aInput;
            }
        });
        process.stdin.on('end', () => {
            resolve(input);
        });
    });
}

var startHoppla = function(input) {
    try {
        hoppla({
            template: argv.template,
            destination: argv.destination,
            force: argv.force,
            ejsOptions: {
                delimiter: argv['ejs-delimiter']
            },
            input
        })
    }
    catch(err) {
        console.error(err);
    }
}

var parseInput = function(input) {
    return JSON.parse(input);
}

Promise.resolve()
    .then(() => {
        var input = argv.input;
        if (input != null) {
            if (input === '') {
                return getInputFromPipe();
            }
        
            return input;
        }
    })
    .then(parseInput)
    .then(startHoppla)
