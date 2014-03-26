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
      hasVersion = false,
      versionsArr = [];

  elasticBeanstalk.describeEnvironments(params, function ( err, data ) {
    if ( err ) return deferred.reject(err.message);
    if ( data ) {
      if ( data.Environments.length === 0 ) {
        deferred.resolve(false);
      } else {
        deferred.resolve(true);
        // console.log(data);
        // this will be for if version labels are the same
        // _.each( data.Environments, function ( envs ) {
        //   if ( envs.VersionLabel === versionLabel ) {
        //     versionsArr.push(envs);
        //     hasVersion = true;
        //   }
        // });

        // if ( hasVersion ) {
        //   // same version
        //   // update env
        //   deferred.resolve()
        // } else {
        //   // means create env
        //   deferred.resolve(true);
        // }
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
exports.createEnv = function createEnv ( elasticBeanstalk, configFile, versionLabel, envName, templateName ) {
  var deferred = Q.defer(),
      params = {
        ApplicationName: configFile.app.ApplicationName,
        EnvironmentName: envName,
        VersionLabel: versionLabel,
        TemplateName: templateName
      };

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
    winston.info(data);
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
        TemplateName: configFile.app.TemplateName || templateName
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

exports.getEnvEvents = function getEnvEvents ( elasticBeanstalk, envName ) {
  var deferred = Q.defer();

  return deferred.promise;
}
