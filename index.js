'use strict'


const fs = require('fs-extra')
const config = require('./config.json')
const {generate, deploy} = require('./process.js');



function entry(arg) {

    arg = arg || process.argv[2] || '';
    if (arg == 'help' || arg == 'h') {
        console.log(`
            build(b) --- default, generate htmls and copy files if not exist
            rebuild (r) --- first clean public dir, then build
            deploy(d) --- Push public dir to git repo configured in the deploy field of _config.yml
            `)
        return;
    } else if (arg == 'b' || arg == '') {
        generate(config)
        return;
    } else if (arg == 'r') {
        console.log(`Cleaning public dir...`)
        fs.emptyDirSync('./public')
        generate(config)
        return;
    } else if (arg == 'c') {
        console.log(`Cleaning public dir...`)
        fs.emptyDirSync('./public')
        return
    } else if (arg == 'd'){
        deploy(config)
    }

}

entry()