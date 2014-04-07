#!/usr/bin/env node
var program = require('commander'),
    fs = require('fs'),
    Q = require('q'),
    _ = require('lodash'),
    semver = require('semver'),
    clc = require('cli-color'),
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

  // should get ENV vars if wanted
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
  .option('-t  --templatename <name>', 'set template name')
  .option('-e, --environment <name>', 'set which environment name');

program.on('--help', function () {
  console.log(' Examples:');
  console.log('');
  console.log('   Initialize Application:');
  console.log('     $ ebs-deploy init                         # Creates an application');
  console.log('     $ ebs-deploy init -c somename.json        # Creates an application with different config file name');
  console.log('');
  console.log('   Deploy Application:');
  console.log('     $ ebs-deploy deploy -e <Environment Name> # Deploy application');
  console.log('     $ ebs-deploy zdtdeploy -e <Environment Name> # Zero-Downtime Deploy application');
  console.log('');
});

/**
 * Steps:
 *   1. Check if application exists
 *     a. if it does move on to env (step 2)
 *     b. if not create the application
 *   2. Check if
 *
 *   last is create env with uploaded version to s3
 *
 *    SHould add node version from package.json file
 */
program
  .command('init')
  .description('Initialize ebs application, config and creates the buckets')
  .action( function ( env ) {
    var appName = configFile.app.ApplicationName;
    if ( fileExists ) {
      // need to loop over envs arr
      // should move these into functions that can be accessed from any others incase
      application.checkApplication(elasticBeanstalk, appName)
        .then( function ( result ) {
          if ( result ) {
            appEnvironment.initConfigs(elasticBeanstalk, configFile)
              .then( function ( result ) {
                return logger.info(result);
              })
              .fail( function ( err ) { return logger.error(err) });
          } else {
            var params = {
              ApplicationName: configFile.app.ApplicationName,
              Description: configFile.app.Description
            };
            application.createApplication(elasticBeanstalk, params)
              .then( function ( result ) {
                appEnvironment.initConfigs(elasticBeanstalk, configFile)
                  .then( function ( result ) {
                    return logger.info(result);
                  })
                  .fail( function ( err ) { return logger.error(err) });
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
  .option('-e <name>')
  .action(function ( env ) {
    var currentTime = moment().unix(),
        versionLabel = JSON.parse(fs.readFileSync('package.json','utf8')).version,// should get this from package.json or use zip file name
        keyName;

    // should also check environment if in config file and on aws
    if ( !program.environment ) {
      logger.error('Error: Need environment name flag -e or --environment to deploy unless default is set');
      return;
    } else {
      // should check if env is here for say staging then maybe?
      keyName = currentTime + '_' + versionLabel + '_' + configFile.app.ApplicationName + '.zip'; // either in config file or package.json
      s3Bucket.zipAndSave( s3, keyName, configFile)
        .then( function ( saveResult ) {
          logger.info('Saved properly');

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
            // should check if version is already here if here append a letter to the version label
            elasticBeanstalk.createApplicationVersion(params, function ( err, data ) {
              if ( err ) {
                versionLabel + 'a';
                // need to work on this

                // should re upload with a different app version just attach a letter on the end ie: 0.0.1a
                console.log(err);
                return logger.info('Error with Creating Application Version: ' + err);
              } else {
                logger.info('Created app version: On:', data.DateCreated);
                // should check env and move this into another file
                appEnvironment.checkEnv(elasticBeanstalk, configFile.app.ApplicationName, program.environment )
                  .then( function ( result ) {
                    logger.info('Environment is Here - ' + result);
                    if ( !result ) {
                      logger.info('Creating Environment');
                        // appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, program.environment, configFile.app.TemplateName)
                        appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, program.environment, program.environment)
                        .then( function ( result ) {
                          // run check for env health using program.environment
                          appEnvironment.constantHealthCheck(elasticBeanstalk, program.environment)
                            .then( function ( finResult ) {
                              return logger.info('Finished Deploying New Environment');
                            }).fail( function ( err ) { return logger.error('ENV Health Status red')/* something might be wrong with your server*/ });
                        })
                        .fail( function ( err ) { return logger.error('Error creating env: ' + err) });
                    } else {
                      logger.info('Updating Environment');
                        // appEnvironment.updateEnvironment(elasticBeanstalk, configFile, versionLabel, program.environment, configFile.app.TemplateName)
                        appEnvironment.updateEnvironment(elasticBeanstalk, configFile, versionLabel, program.environment, program.environment)
                        .then( function ( result ) {
                          appEnvironment.constantHealthCheck(elasticBeanstalk, program.environment)
                            .then( function ( finResult ) {
                              return logger.info('Finished Deploying Update');
                            }).fail( function ( err ) { return logger.error('ENV Health Status red') });
                        })
                        .fail( function ( err ) { return logger.error(err.message) });
                    }
                    // need updateEnvironment but for zero downtime need to create one and switch cnames
                  })
                  .fail( function ( err ) {
                    return logger.error(err);
                  });
              }

            });
        }).fail( function ( err ) { throw new Error(err) });
    }
  });

program
  .command('zdtdeploy')
  .description('Zero downtime deploy')
  .option('-e <name>')
  .action( function () {
    // also run a check if there is no env to swap with switch to regluar deploy
    var currentTime = moment().unix(),
        versionLabel = JSON.parse(fs.readFileSync('package.json','utf8')).version, // should get this from package.json or use zip file name
        oldEnvName, newEnvName, keyName;


    // should also check environment if in config file and on aws
    if ( !program.environment ) {
      return logger.error('Error: Need environment name flag -e or --environment to deploy unless default is set');
    } else {
      appEnvironment.zdtEnvCheck(elasticBeanstalk, configFile.app.ApplicationName, program.environment, configFile)
        .then( function ( newENVNameData ) {
          oldEnvName = newENVNameData.current.envName;
          newEnvName = newENVNameData.newENV.envName;

          // should check if env is here for say staging then maybe?
          keyName = currentTime + '_' + versionLabel + '_' + configFile.app.ApplicationName + '.zip'; // either in config file or package.json
          s3Bucket.zipAndSave( s3, keyName, configFile)
            .then( function ( saveResult ) {
              logger.info('Saved properly');
              logger.info('Using Version: ' + versionLabel);

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
                // should check if version is already here if here append a letter to the version label
                elasticBeanstalk.createApplicationVersion(params, function ( err, data ) {
                  if ( err ) {
                    // versionLabel + 'a';
                    console.log(semver.inc(versionLabel, 'minor'));
                    // need to work on this

                    // should re upload with a different app version just attach a letter on the end ie: 0.0.1a
                    return logger.info('Error with Creating Application Version: ' + err);
                  } else {
                    logger.info('Created app version: On: ' + data.ApplicationVersion.DateCreated);
                    logger.info('Using ENV name: ' + newEnvName);
                    // should check env and move this into another file
                    appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, newEnvName, program.environment, true)
                      .then( function ( createResult ) {
                        // console.log('create result ', createResult.newCNAME);
                        appEnvironment.constantHealthCheck(elasticBeanstalk, newEnvName)
                          .then( function ( finResult ) {
                            appEnvironment.swapEnvNames( elasticBeanstalk, newEnvName, oldEnvName)
                              .then( function ( swapResult ) {
                                appEnvironment.constantHealthCheck(elasticBeanstalk, newEnvName)
                                  .then( function ( finSwapResult ) {
                                    // maybe have this? might be overkill
                                    // appEnvironment.terminateEnv( elasticBeanstalk, oldEnvName)
                                    // .then( function ( result ) {
                                    //   appEnvironment.constantHealthCheckTerm(elasticBeanstalk, oldEnvName)
                                    //     .then( function ( result ) {
                                    //       logger.info('Old Env Terminated');
                                          return logger.info('Finished Deploying Updated Environment');
                                        // }).fail( function ( err ) { throw new Error(err) });
                                    // })
                                  }).fail( function ( err ) { throw new Error(err) });
                              }).fail( function ( err ) { throw new Error(err) });
                            // once new env is created switch old env to some name
                          }).fail( function ( err ) {
                            // things seem to go red after a change to a server config file should
                            // run another check as backup
                            // this might not mean what it is for this
                            return logger.error('ENV Health Status red');/* something might be wrong with your server*/
                          });
                      })
                      .fail( function ( err ) {
                        throw new Error(err);
                      });
                  }

                });
            }).fail( function ( err ) { throw new Error(err) });

        }).fail( function ( err ) { return logger.error(err) });
    }
  });

program
  .command('zdtdeployy')
  .description('Zero downtime deploy')
  .option('-e <name>')
  .action( function () {
    // also run a check if there is no env to swap with switch to regluar deploy
    var currentTime = moment().unix(),
        oldEnvName = program.environment, // temp
        newEnvName = program.environment + '-0', // should run a check for dns/cname
        versionLabel = JSON.parse(fs.readFileSync('package.json','utf8')).version,// should get this from package.json or use zip file name
        keyName;


    // should also check environment if in config file and on aws
    if ( !program.environment ) {
      return logger.error('Error: Need environment name flag -e or --environment to deploy unless default is set');
    } else {
      // should check if env is here for say staging then maybe?
      keyName = currentTime + configFile.app.ApplicationName + '.zip'; // either in config file or package.json
      s3Bucket.zipAndSave( s3, keyName, configFile)
        .then( function ( saveResult ) {
          logger.info('Saved to S3 properly and removed zip from local');

            // move this into a function to get passed result
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
            // should check if version is already here if here append a letter to the version label
            elasticBeanstalk.createApplicationVersion(params, function ( err, data ) {
              if ( err ) {
                versionLabel + 'a';
                // need to work on this
                // should re upload with a different app version just attach a letter on the end ie: 0.0.1a
                return logger.info('Error with Creating Application Version: ' + err);
              } else {
                logger.info('Created app version: On: ' + data.ApplicationVersion.DateCreated);
                // should check env and move this into another file
                appEnvironment.createEnv(elasticBeanstalk, configFile, versionLabel, newEnvName, program.environment, true)
                  .then( appEnvironment.constantHealthCheck(elasticBeanstalk, newEnvName) )
                  .then( appEnvironment.swapEnvNames( elasticBeanstalk, newEnvName, oldEnvName) )
                  .then( appEnvironment.constantHealthCheck(elasticBeanstalk, newEnvName) )
                  .then( appEnvironment.terminateEnv( elasticBeanstalk, oldEnvName) )
                  .then( function ( result ) { return logger.info('Finished Deploying Updated Environment') })
                  .fail( function ( err ) { throw new Error(err); })
              }

            });
        }).fail( function ( err ) { throw new Error(err) });
    }
  });

program
  .command('updateconfig')
  .description('Update Configuration File')
  .action( function () {
    var params = {
      ApplicationName: 'Project-Liger',
      TemplateName: 'Project-Liger-Staging',
      OptionSettings: [
        {
          Namespace: 'aws:elb:loadbalancer',
          OptionName: 'LoadBalancerPortProtocol',
          Value: 'TCP'
        },
        {
          Namespace: 'aws:elb:loadbalancer',
          OptionName: 'LoadBalancerHTTPPort',
          Value: '80'
        },
        {
          Namespace: 'aws:elb:policies',
          OptionName: 'Stickiness Policy',
          Value: 'false'

        }
      ],
      // OptionsToRemove: [
      //   {
      //     Namespace: 'STRING_VALUE',
      //     OptionName: 'STRING_VALUE',
      //   },
      //   // ... more items ...
      // ],
    };
    elasticBeanstalk.updateConfigurationTemplate(params, function ( err, data ) {
      if (err) return console.log(err, err.stack);
      console.log(data);
    });
  });

program
  .command('checkenvhealth')
  .description('Check ENV Health')
  .action( function () {
    if ( program.environment ) {
      appEnvironment.checkEnvStatus(elasticBeanstalk, program.environment)
        .then( function ( result ) {
          if ( result ) {
            logger.info('Health Check - Green');
          } else {
            logger.info('Health Check', result);
          }
        }).fail( function ( err ) { return logger.error( err )});
    } else {
      return logger.error('Error: Need environment name flag -e or --environment to deploy unless default is set')
    }
  });

program
  .command('checkdns')
  .description('Check if cname is avalible')
  .action( function ( env ) {
    var params = {};
    if ( !program.cname ) {
      return logger.error('Error: no name to check');
    } else {
      params.CNAMEPrefix = program.cname;
      elasticBeanstalk.checkDNSAvailability(params)
        .on('success', function ( response ) {
          logger.info('CNAME is Avalible');
          logger.info('Will deploy as ' + response.data.FullyQualifiedCNAME );
        })
        .on('error', function ( response ) {
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
        EnvironmentName: 'Project-Liger-Prod', // this should be looped over each seperate env
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
        TemplateName: configFile.app.TemplateName
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
  .description('Generate Config File    *** Not Implimented yet ***')
  .action( function ( env ) {
    appEnvironment.zdtEnvCheck(elasticBeanstalk, configFile.app.ApplicationName, 'Project-Liger-Staging', configFile)
        .then( function ( newENVNameData ) {
          oldEnvName = newENVNameData.current.envName;
          newEnvName = newENVNameData.newENV.envName;
          console.log(oldEnvName, newEnvName);
        });
    // appEnvironment.getAppVersions(elasticBeanstalk, configFile.app.ApplicationName, JSON.parse(fs.readFileSync('package.json','utf8')).version)
    //   .then( function ( versionResult ) {
    //     console.log(versionResult);
    //   }).fail( function ( err ) { logger.error(err) });
  });

// this needs to be last
program.parse(process.argv);
