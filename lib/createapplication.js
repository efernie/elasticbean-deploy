// create the application
var Q = require('q');

/**
 * [checkApplication description]
 * @param  {[type]} elasticBeanstalk [description]
 * @param  {[type]} appName          [description]
 * @return {[type]}                  [description]
 */
exports.checkApplication = function checkApplication ( elasticBeanstalk, appName ) {
  var deferred = Q.defer(),
      params = {
        ApplicationNames: [
          appName
        ]
      };

  elasticBeanstalk.describeApplications(params, function ( err, data ) {
    if ( err ) return deferred.reject(err.message);
    if ( data ) {
      if ( data.Applications.length === 0 ) {
        deferred.resolve(false);
      } else {
        deferred.resolve(true);
      }
    }
  });

  return deferred.promise;
}

/**
 * [listSolutions description]
 * @param  {[type]} elasticBeanstalk [description]
 * @return {[type]}                  [description]
 */
exports.listSolutions = function listSolutions ( elasticBeanstalk ) {
  var deferred = Q.defer();
  elasticBeanstalk.listAvailableSolutionStacks({}, function ( err, data ) {
    if (err) return deferred.reject(err);
    deferred.resolve(data.SolutionStacks);
  });

  return deferred.promise;
}

/**
 * [createApplication description]
 * @param  {[type]} elasticBeanstalk [description]
 * @param  {[type]} params           [description]
 * @return {[type]}                  [description]
 */
exports.createApplication = function createApplication ( elasticBeanstalk, params ) {
  var deferred = Q.defer();

  elasticBeanstalk.createApplication(params, function ( err, data ) {
    if ( err ) return deferred.reject(err.message);
    deferred.resolve(data);
  });

  return deferred.promise;
}
