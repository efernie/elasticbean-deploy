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
 */
program
  .command('init')
  .description('Initialize ebs application')
  .action(function ( env ) {
    var appName = configFile.app.ApplicationName;
    if ( fileExists ) {
      application.checkApplication(elasticBeanstalk, appName)
        .then( function ( result ) {
          if ( result ) {
            appEnvironment.checkEnv(elasticBeanstalk, appName, _.keys(configFile.app.Environments)[0])
              .then( function ( result ) {
                if ( !result ) {
                  s3Bucket.checkBucket(s3, configFile.aws.Bucket)
                    .then( function ( result ) {
                      if ( !result ) {
                        // s3Bucket.createBucket(s3, configFile.aws.Bucket, "") //configFile.aws.Region
                        //   .then( function ( result ) {
                        //     console.log(result);
                        //   })
                      } else {
                        // appEnvironment.createEnv(elasticBeanstalk, configFile);

                        // actually need
                        s3Bucket.zipToBuffer('./')
                          .then( function ( outputBuffer ) {
                            var keyName = moment().unix() + 'projectliger.zip';
                            var bucketParams = {
                              Bucket: configFile.aws.Bucket,
                              Key: keyName, // this is the name
                              Body: outputBuffer,
                              ContentType: 'application/zip',
                              Metadata: {
                                Name: 'projectliger.zip'
                              }
                            };
                            s3.putObject(bucketParams, function ( err, data ) {
                              if ( err ) return winston.error(err);
                              console.log(data);
                              var params = {
                                ApplicationName: configFile.app.ApplicationName,
                                VersionLabel: '0.0.1',
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
                              });
                            })
                          })
                      }
                    })
                } else {
                  return logger.info('Already Initialized');
                }
              })
              .fail( function ( err ) {
                return logger.error('Error: ' + err);
              })
            // move on to next check
          } else {
            // seperate this into a function
            var params = {
              ApplicationName: configFile.app.ApplicationName,
              Description: configFile.app.Description
            };
            elasticBeanstalk.createApplication(params, function ( err, data ) {
              if ( err ) {
                return logger.error(err.message);
              }
              logger.info(data);
            });
          }
        })
        .fail( function ( err ) {
          return logger.error(err);
        });
      // logger.info(configFile);
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
      // upload zip and createapp version
      logger.info('environment', program.environment);
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

      appEnvironment.mapOptions(params)
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
  })

// this needs to be last
program.parse(process.argv);

// function checkEnv ( applicationName, envName ) {
//   var deferred = Q.defer(),
//       params = {
//         ApplicationName: applicationName,
//         EnvironmentNames: [
//           envName
//         ],
//         IncludeDeleted: false
//       };

//   elasticBeanstalk.describeEnvironments(params, function ( err, data ) {
//     if ( err ) return deferred.reject(err.message);
//     if ( data ) {
//       if ( data.Environments.length === 0 ) {
//         deferred.resolve(false);
//       } else {
//         deferred.resolve(true);
//       }
//     }
//   });

//   return deferred.promise;
// }

// function createEnv () {
//   var deferred = Q.defer();
//   var params = {
//     ApplicationName: configFile.app.ApplicationName,
//     EnvironmentName: 'Project-Liger-Prod',
//     VersionLabel: '0.0.1',
//     TemplateName: 'Project-Liger'
//   };

//   elasticBeanstalk.createEnvironment(params, function ( err, data ) {
//     if ( err ) return logger.error(err);
//     winston.info(data);
//     deferred.resolve(data);
//   });

//   return deferred.promise;
// }

// function mapOptions ( params ) {
//   var deferred = Q.defer();

//   _.each( configFile.app.AllEnvironments.OptionSettings, function ( settings, key ) {
//     _.each( settings, function ( value, setKey ) {
//       var obj = {
//         Namespace: key
//       };

//       obj.OptionName = setKey;

//       if ( typeof value === 'boolean' ) {
//         value = '' + value;
//       }

//       if ( typeof value === 'number' ) {
//         value += '';
//       }
//       obj.Value = value;
//       params.OptionSettings.push(obj);
//     });
//   });

//   deferred.resolve(params);

//   return deferred.promise;
// }

// use validate?? maybe
function checkFile ( fileName ) {
  var deferred = Q.defer();

  return deferred.promise;
}

// function checkBucket ( bucketName ) {
//   var deferred = Q.defer(),
//       bucketHere = false;

//   s3.listBuckets({}, function ( err, data ) {
//     if ( err ) return winston.error(err);
//     _.each( data.Buckets, function ( bucket ) {
//       if ( bucket.Name === bucketName ) {
//         bucketHere = true;
//       }
//     });

//     deferred.resolve(bucketHere);
//   });

//   return deferred.promise;
// }

// function createBucket ( bucketName, region ) {
//   var deferred = Q.defer();
//   var params = {
//     Bucket: bucketName,
//     ACL: 'private'//,
//     // CreateBucketConfiguration: {
//     //   LocationConstraint: region //'us-east-1'
//     // }
//   };
//   console.log(params);
//   s3.createBucket(params, function(err, data) {
//     if (err) return winston.error(err); deferred.reject(err);
//     logger.info(data);
//     deferred.resolve(true);
//   });

//   return deferred.promise;
// }

// function zipToBuffer ( folderLocation, outputFileName, zipName ) {
//   var deferred = Q.defer(),
//       outputPath = 'all.zip',
//       srcDirectory = './',
//       output = fs.createWriteStream(outputPath),
//       zipArchive = archiver('zip'),
//       outputBuffer;

//   output.on('close', function() {
//     logger.info('done with the zip', outputPath);
//     outputBuffer = fs.readFileSync(outputPath);
//     deferred.resolve(outputBuffer);
//   });

//   zipArchive.pipe(output);

//   zipArchive.bulk([
//     { src: [ '**/*' ], cwd: srcDirectory, expand: true }
//   ]);

//   zipArchive.finalize(function ( err, bytes ) {
//     if ( err ) {
//       winston.error(err);
//       throw err;
//     }

//     logger.log('done:', base, bytes);
//   });

//   return deferred.promise;
// }
