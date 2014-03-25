// app environment
var Q = require('q'),
    _ = require('lodash');

exports.checkEnv = function checkEnv ( elasticBeanstalk, appName, envName ) {
  var deferred = Q.defer(),
      params = {
        ApplicationName: appName,
        EnvironmentNames: [
          envName
        ],
        IncludeDeleted: false
      };

  elasticBeanstalk.describeEnvironments(params, function ( err, data ) {
    if ( err ) return deferred.reject(err.message);
    if ( data ) {
      if ( data.Environments.length === 0 ) {
        deferred.resolve(false);
      } else {
        deferred.resolve(true);
      }
    }
  });

  return deferred.promise;
}

exports.createEnv = function createEnv ( elasticBeanstalk, configFile ) {
  var deferred = Q.defer();
  var params = {
    ApplicationName: configFile.app.ApplicationName,
    EnvironmentName: 'Project-Liger-Prod',
    VersionLabel: '0.0.1',
    TemplateName: 'Project-Liger'
  };

  elasticBeanstalk.createEnvironment(params, function ( err, data ) {
    if ( err ) return logger.error(err);
    winston.info(data);
    deferred.resolve(data);
  });

  return deferred.promise;
}

exports.mapOptions = function mapOptions ( params, configFile ) {
  var deferred = Q.defer();

  _.each( configFile.app.AllEnvironments.OptionSettings, function ( settings, key ) {
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
