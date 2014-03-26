#!/usr/bin/env node
var program = require('commander'),
    fs = require('fs'),
    Q = require('q'),
    _ = require('lodash'),
    winston = require('winston'),
    moment = require('moment'),
    AWS = require('aws-sdk'),
    defaultFileName = 'elasticconfig.json',
    fileExists = fs.existsSync(defaultFileName),
    logger = new (winston.Logger)({
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          timestamp: function ( time ) {
            return moment().format('MMMM Do YYYY, h:mm:ss a');
          }
        })
      ]
    }),
    configFile, creds;

// exports
var application = require('../lib/createapplication');
var appEnvironment = require('../lib/appenvironment');
var s3Bucket = require('../lib/s3bucket');

if ( fileExists ) {
  configFile = JSON.parse(fs.readFileSync(defaultFileName,'utf8'));

  AWS.config.update({
    accessKeyId: configFile.aws.AccessKey,
    secretAccessKey: configFile.aws.SecretKey,
    region: configFile.aws.Region
  });

  elasticBeanstalk = new AWS.ElasticBeanstalk();
  s3 = new AWS.S3();
}

program
  .version('0.0.1')
  .option('-c, --config <file>', 'set config path. defaults to ' + defaultFileName)
  .option('-n, --cname <name>', 'cname to check')
  .option('-t --templatename <name>', 'set template name')
  .option('-e, --environment <name>', 'set which environment name');

program.on('--help', function () {
  console.log(' Examples:');
  console.log('');
  console.log('   Initialize Application:');
  console.log('     $ elasticbean-deploy init                    # Creates an application');
  console.log('     $ elasticbean-deploy init -c somename.json   # Creates an application with different config file name');
  console.log('');
  console.log('   Deploy Application:');
  console.log('     $ elasticbean-deploy deploy -                # Deploy application');
});

/**
 * Steps:
 *   1. Check if application exists
 *     a. if it does move on to env (step 2)
 *     b. if not create the application
 *   2. Check if
 *
 *   last is create env with uploaded version to s3
 */
program
  .command('init')
  .description('Initialize ebs application, config and creates the buckets')
  .action( function ( env ) {
    var appName = configFile.app.ApplicationName;
    if ( fileExists ) {
      application.checkApplication(elasticBeanstalk, appName)
        .then( function ( result ) {
          if ( result ) {
            // check then if not add config
            appEnvironment.checkEnv(elasticBeanstalk, appName, _.keys(configFile.app.Environments)[0])
              // appEnvironment.createConfigTemplate( elasticBeanstalk, configFile, 'Project-Ligers')
              .then( function ( result ) {
                if ( result === true ) {
                  return logger.info('Already Initialized');
                } else {
                  return logger.info('Initialized');
                }
              })
              .fail( function ( err ) {
                return logger.error('Error: ' + err);
              })
          } else {
            var params = {
              ApplicationName: configFile.app.ApplicationName,
              Description: configFile.app.Description
            };
            application.createApplication(elasticBeanstalk, params)
              .then( function ( result ) {
                appEnvironment.createConfigTemplate( elasticBeanstalk, configFile, _.keys(configFile.app.Environments)[0]) // Project-Liger
                .then( function ( result ) {
                  if ( result === true ) {
                    return logger.info('Already Initialized');
                  } else {
                    return logger.info('Initialized');
                  }
                })
                .fail( function ( err ) {
                  return logger.error('Error: ' + err);
                })
              })
              .fail( function ( err ) { return logger.error(err) });
          }
        })
        .fail( function ( err ) {
          return logger.error(err);
        });
    } else {
      if ( program.config ) {
        logger.info('file', program.config);
      } else {
        logger.info('Need file');
      }
    }

  });

program
  .command('deploy')
  .description('Deploy ebs application')
  .action(function ( env ) {
    if ( !program.environment ) {
      logger.error('Error: Need environment name flag -e or --environment to deploy unless default is set');
      return;
    } else {
      var versionLabel = '0.0.1';
      // envname -> _.keys(configFile.app.Environments)[0]

      // check env goes avter put obj?
      // appEnvironment.checkEnv(elasticBeanstalk, configFile.app.ApplicationName, _.keys(configFile.app.Environments)[0] )
      //   .then( function ( result ) {
      //     console.log(result);
      //     var versionLabel = '0.0.1'; // have to set this from package.json file
      //     if ( !result ) {
      //       // create env
      //       // carry version label from this to the createApplicationVersion
      //       appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, program.environment)
      //         .then( function ( result ) { return winston.info('All Done Initializing') })
      //         .fail( function ( err ) { return winston.error(err) });
      //     } else {
          var keyName = moment().unix() + '-projectliger' + '.zip';
          s3Bucket.zipToBuffer('./', keyName)
            .then( function ( outputBuffer ) {
              var bucketParams = {
                Bucket: configFile.aws.Bucket,
                Key: keyName,
                Body: outputBuffer,
                ContentType: 'application/zip'
              };
              s3.putObject(bucketParams, function ( err, data ) {
                if ( err ) return logger.error(err);
                console.log(data);
                var params = {
                  ApplicationName: configFile.app.ApplicationName,
                  VersionLabel: versionLabel,
                  AutoCreateApplication: true,
                  Description: configFile.app.Description,
                  SourceBundle: {
                    S3Bucket: configFile.aws.Bucket,
                    S3Key: keyName
                  }
                };
                elasticBeanstalk.createApplicationVersion(params, function ( err, data ) {
                  if ( err ) return logger.info('Error: ' + err);
                  logger.info(data);
                  appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, program.environment)
                    .then( function ( result ) { return logger.info('All Done Initializing') })
                    .fail( function ( err ) { return logger.error(err) });

                });
              })
            })
          // }
        // })
        // .fail( function ( err ) { return logger.error(err) });
      // upload zip and createapp version
    }
  });

program
  .command('checkdns')
  .description('Check if cname is avalible')
  .action( function ( env ) {
    var params = {};
    if ( !program.cname ) {
      logger.error('Error: no name to check');
    } else {
      params.CNAMEPrefix = program.cname;
      elasticBeanstalk.checkDNSAvailability(params)
        .on('success', function (response) {
          logger.info('CNAME is Avalible');
          logger.info('Will deploy as ' + response.data.FullyQualifiedCNAME );
        })
        .on('error', function (response) {
          return logger.error('Error: ' + response.message);
        })
        .send();
    }
  });

program
  .command('validate')
  .description('Check if config settings are valid')
  .action( function ( env ) {
    if ( fileExists ) {
      var params = {
        ApplicationName: configFile.app.ApplicationName,
        EnvironmentName: 'Project-Liger-Prod',
        OptionSettings: []
      };

      appEnvironment.mapOptions(params)
        .then( function ( result ) {
        elasticBeanstalk.validateConfigurationSettings(result, function ( err, data ) {
          if ( err ) return logger.error('Error: ' + err.message);
          logger.info(data);
        });
        })
        .fail( function ( err ) {
          logger.info('Error: ' + err);
        });

    } else {
      return logger.error('Need a config file to validate');
    }
  });

program
  .command('createtemplate')
  .description('Create a Config template')
  .action( function ( env ) {
    if ( fileExists ) {
      var params = {
        ApplicationName: configFile.app.ApplicationName,
        SolutionStackName: configFile.app.AllEnvironments.SolutionStackName,
        OptionSettings: [],
        TemplateName: 'Project-Liger'
      };

      appEnvironment.mapOptions(params, configFile)
        .then( function ( result ) {
          elasticBeanstalk.createConfigurationTemplate(result, function ( err, data ) {
            if ( err ) return logger.info('Error: ' + err);
            logger.info(data);
          });
        })
        .fail( function ( err ) {
          logger.info('Error: ' + err);
        });
    }
  });

program
  .command('generateconfig')
  .description('Generate Config File')
  .action( function ( env ) {
    // testing
    var params = {
      ApplicationName: configFile.app.ApplicationName,
      EnvironmentName: 'Project-Liger-Prod',
      VersionLabel: '0.0.1',
      TemplateName: 'Project-Liger',
      OptionSettings: [
        {
          Namespace: 'Project-Liger-Production',
          OptionName: 'CnamePrefix',
          Value: 'project-liger-production'
        },
     //    { 'aws:elasticbeanstalk:application:environment': { MYAPP_ENV_NAME: 'production', NODE_ENV: 'production' },
     // 'aws:autoscaling:launchconfiguration': { InstanceType: 't1.micro' } } }
      ]
    };
    // appEnvironment.mapOptions(params, configFile.app.Environments)
    //   .then( function ( result ) {
    //     console.log(result.OptionSettings[1]);
    //   })
    //   .fail( function ( err ) { logger.error(err)})
  });

// this needs to be last
program.parse(process.argv);

// use validate?? maybe
function checkFile ( fileName ) {
  var deferred = Q.defer();

  return deferred.promise;
}
