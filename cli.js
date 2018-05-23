#!/usr/bin/env node

const Input = require('./lib/input.js');
const hoppla = require('./index.js');
const argv = require('yargs')
    .options({
        t: { alias: 'template', describe: 'Path to template folder', type: 'string', demandOption: true },
        d: { alias: 'destination', describe: 'Path to destination folder', type: 'string', default: '.' },
        i: { alias: 'input', describe: 'HJSON input data', type: 'string'},
        f: { alias: 'force', describe: 'Overwrites existing files', type: 'boolean' },
        'ed': { alias: 'ejs-delimiter', describe: 'Which EJS delimiter to use', type: 'string', default: '%'}
    })
    .argv

const startHoppla = function(input) {
    if (input === false) {
        return;
    }

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

Promise.resolve()
    .then(() => {
        var input = argv.input;
        if (input != null) {
            if (input === '') {
                return Input.getFromStdin();
            }
        
            return input;
        }

        return '{}'
    })
    .then(Input.parse)
    .catch((err) => {
        console.error('Input was not readable as HJSON')
        console.error(err);
        return false;
    })
    .then(startHoppla)
