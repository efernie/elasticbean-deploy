#!/usr/bin/env node

var parseArgs = require('minimist')(process.argv.slice(2)),
    program = require('commander'),
    _ = require('lodash'),
    AWS = require('aws-sdk'),
    elasticBeanstalk = new AWS.ElasticBeanstalk();


program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config path. defaults to elasticconfig.json');

program.on('--help', function () {
  console.log(' Examples:');
  console.log('');
  console.log('   $ elasticbean-deploy init     # Creates an application');
});


// console.log(program);

program
  .command('init')
  .description('run remote setup commands')
   .action(function(){
     console.log('setup');
   });

// this needs to be last
program.parse(process.argv);
