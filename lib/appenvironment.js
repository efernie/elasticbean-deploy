// app environment
var Q = require('q'),
    _ = require('lodash'),
    winston = require('winston'),
    moment = require('moment'),
    archiver = require('archiver'),
    logger = new (winston.Logger)({
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          timestamp: function ( time ) {
            return moment().format('MMMM Do YYYY, h:mm:ss a');
          }
        })
      ]
    });

/**
 * [checkEnv description]
 * @param  {[type]} elasticBeanstalk [description]
 * @param  {[type]} appName          [description]
 * @param  {[type]} envName          [description]
 * @return {[type]}                  [description]
 */
exports.checkEnv = function checkEnv ( elasticBeanstalk, appName, envName, versionLabel ) {
  var deferred = Q.defer(),
      params = {
        ApplicationName: appName,
        EnvironmentNames: [
          envName
        ],
        IncludeDeleted: false
      },
      hasConfig = false;

  elasticBeanstalk.describeEnvironments(params, function ( err, data ) {
    if ( err ) return deferred.reject(err.message);
    if ( data ) {
      if ( data.Environments.length === 0 ) {
        deferred.resolve(false);
      } else {
        _.each( data.Environments, function ( envs ) {
          if ( envs.EnvironmentName === envName ) {
            hasConfig = true;
          }
        });
        if ( hasConfig ) {
          deferred.resolve(true);
        } else {
          deferred.resolve(false);
        }
      }
    }
  });

  return deferred.promise;
}

/**
 * [createEnv description]
 * @param  {[type]} elasticBeanstalk [description]
 * @param  {[type]} configFile       [description]
 * @param  {[type]} versionLabel     [description]
 * @return {[type]}                  [description]
 */
exports.createEnv = function createEnv ( elasticBeanstalk, configFile, versionLabel, envName, templateName, preSwap ) {
  var deferred = Q.defer(),
      params = {
        ApplicationName: configFile.app.ApplicationName,
        EnvironmentName: envName,
        VersionLabel: versionLabel,
        TemplateName: templateName
      };

  params.CNAMEPrefix = _.find(configFile.app.environments, { envName: templateName }).CnamePrefix;

  if ( preSwap ) {
    params.CNAMEPrefix = params.CNAMEPrefix + moment().unix();
  }
  // this would be for one of additions to the env
  // add individual options for the env
  // OptionSettings: [
  //   {
  //     Namespace: 'STRING_VALUE',
  //     OptionName: 'STRING_VALUE',
  //     Value: 'STRING_VALUE',
  //   },
  //   // ... more items ...
  // ],


  elasticBeanstalk.createEnvironment(params, function ( err, data ) {
    if ( err ) return deferred.reject(err);
    if ( preSwap ) {
      data.newCNAME = params.CNAMEPrefix;
    }
    deferred.resolve(data);
  });

  return deferred.promise;
}

exports.updateEnvironment = function updateEnvironment ( elasticBeanstalk, configFile, versionLabel, envName, templateName  ) {
  var deferred = Q.defer(),
      params = {
        EnvironmentName: envName,
        VersionLabel: versionLabel,
        TemplateName: templateName
      }

  elasticBeanstalk.updateEnvironment( params, function ( err, data ) {
    if ( err ) return deferred.reject(err);
    deferred.resolve(data);
  });

  return deferred.promise;
}

/**
 * [createConfigTemplate description]
 * @param  {[type]} elasticBeanstalk [description]
 * @param  {[type]} templateName     [description]
 * @return {[type]}                  [description]
 */
exports.createConfigTemplate = function createConfigTemplate ( elasticBeanstalk, configFile, templateName ) {
  var self = this,
      deferred = Q.defer(),
      params = {
        ApplicationName: configFile.app.ApplicationName,
        SolutionStackName: configFile.app.AllEnvironments.SolutionStackName,
        Description: configFile.app.Description,
        OptionSettings: [],
        TemplateName: templateName || configFile.app.TemplateName
      },
      checkParams = {};

  checkParams = _.cloneDeep(params);
  delete checkParams.SolutionStackName;
  delete checkParams.OptionSettings;

  elasticBeanstalk.describeConfigurationSettings(checkParams, function ( err, data ) {
    if ( err ) {
      // means no config template
      // should cycle through Environments in config file
      self.mapOptions(params, configFile)
        .then( function ( result ) {
          elasticBeanstalk.createConfigurationTemplate(result, function ( err, data ) {
            if ( err ) return deferred.reject(err);
            deferred.resolve(data);
          });
        })
        .fail( function ( err ) {
          return deferred.reject(err);
        });
    }

    if ( data ) {
      return deferred.resolve(true);
    }
  });


  return deferred.promise;
}

/**
 * [mapOptions description]
 * @param  {[type]} params     [description]
 * @param  {[type]} configFile [description]
 * @return {[type]}            [description]
 */
exports.mapOptions = function mapOptions ( params, configFile ) {
  var deferred = Q.defer();

  _.each( configFile.app.AllEnvironments.OptionSettings, function ( settings, key ) {
  // _.each( configFile, function ( settings, key ) {
    _.each( settings, function ( value, setKey ) {
      var obj = {
        Namespace: key
      };

      obj.OptionName = setKey;

      if ( typeof value === 'boolean' ) {
        value = '' + value;
      }

      if ( typeof value === 'number' ) {
        value += '';
      }
      obj.Value = value;
      params.OptionSettings.push(obj);
    });
  });

  deferred.resolve(params);

  return deferred.promise;
}

exports.initConfigs = function initConfigs ( elasticBeanstalk, configFile ) {
  var self = this,
      deferred = Q.defer(),
      numberofConfigs = 0,
      completedConfigs = 0,
      configsArr = [];

  _.each(configFile.app.environments, function ( configs ) {
    numberofConfigs++;
    configsArr.push(configs);
  });

  _.each( configsArr, function ( envConfigs ) {
    self.checkEnv(elasticBeanstalk, configFile.app.ApplicationName, envConfigs.envName)
      .then( function ( result ) {
        if ( !result ) {
          var mergedConfig = _.merge(configFile.app.AllEnvironments.OptionSettings, envConfigs.OptionSettings);

          // should move this outside
          self.createConfigTemplate( elasticBeanstalk, configFile, envConfigs.envName)
            .then( function ( createResult ) {
              completedConfigs++;
              logger.info( '\u001b[32m Config: ' + envConfigs.envName  + ' \u221A \u001b[0m');
              if ( completedConfigs === numberofConfigs ) {
                console.log('done');
              }
            }).fail( function ( err ) { console.log(err) });
        } else {
          completedConfigs++;
          // green color
          logger.info( '\u001b[32m Config: ' + envConfigs.envName  + ' \u221A \u001b[0m');
        }

        if ( completedConfigs === numberofConfigs ) {
          console.log('done');
        }
      })
      .fail( function ( err ) { console.log(err) });

  });

  return deferred.promise;
}

exports.checkEnvStatus = function checkEnvStatus ( elasticBeanstalk, envName ) {
  var self = this,
      deferred = Q.defer(),
      params = {
        EnvironmentNames: [
          envName
        ]
      }

  elasticBeanstalk.describeEnvironments( params, function ( err, data ) {
    if ( err ) {
      logger.error('some err checking health?' ,err);
      return deferred.reject(err);
    }

    switch ( data.Environments[0].Health ) {
      case 'Green':
        deferred.resolve(true);
      break;
      case 'Red':
        deferred.reject('Something went wrong with your server');
      break;
      default:
        logger.info('Env Health Status Update: ' + data.Environments[0].Health + ' - ' + data.Environments[0].Status);
        deferred.resolve(false);
      break;
    }

  });

  return deferred.promise;
}

// should add a secondary interval if red check again for another say 2 mins
exports.constantHealthCheck = function constantHealthCheck ( elasticBeanstalk, envName ) {
  var self = this,
      deferred = Q.defer();

  var healthInterval = setInterval( function () {
    self.checkEnvStatus(elasticBeanstalk, envName)
      .then( function ( result ) {
        if ( result ) {
          deferred.resolve(true);
          clearInterval(healthInterval);
        }
      }).fail( function ( err ) {
        clearInterval(healthInterval);
        return deferred.reject(err);
      });
  }, 3500);

  return deferred.promise;
}

exports.swapEnvNames = function swapEnvNames ( elasticBeanstalk, newEnvName, oldEnvName ) {
  var self = this,
      deferred = Q.defer(),
      params = {
        DestinationEnvironmentName: newEnvName,
        SourceEnvironmentName: oldEnvName
      };

  logger.info('Starting Swap');

  setTimeout( function () {
    elasticBeanstalk.swapEnvironmentCNAMEs(params, function ( err, data ) {
      if ( err ) return deferred.reject(err);
      logger.info('Swap Completed');
      deferred.resolve(data);
    });
  }, 10000);

  return deferred.promise;
}

exports.terminateEnv = function terminateEnv ( elasticBeanstalk, envName ) {
  var deferred = Q.defer(),
      params = {
        EnvironmentName: envName
      };

  elasticBeanstalk.terminateEnvironment(params, function ( err, data ) {
    if ( err ) return deferred.reject(err);
    deferred.resolve(true);
  });

  return deferred.promise;
}

exports.checkDNS = function checkDNS ( elasticBeanstalk, cname ) {
  var deferred = Q.defer(),
      params = {
        CNAMEPrefix: cname
      };

  elasticBeanstalk.checkDNSAvailability(params)
    .on('success', function ( response ) {
      logger.info('CNAME is Avalible');
      logger.info('Will deploy as ' + response.data.FullyQualifiedCNAME );
      deferred.resolve(true);
    })
    .on('error', function ( response ) {
      return deferred.reject(response.message); //logger.error('Error: ' + response.message);
    })
    .send();

  return deferred.promise;
}

exports.getEnvConfig = function getEnvConfig ( configFile ) {
  var deferred = Q.defer();

  return deferred.promise;
}

exports.getEnvEvents = function getEnvEvents ( elasticBeanstalk, envName ) {
  var deferred = Q.defer();

  return deferred.promise;
}
