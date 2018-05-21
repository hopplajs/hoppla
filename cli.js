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

var input = (argv.input)? JSON.parse(argv.input): null;

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
