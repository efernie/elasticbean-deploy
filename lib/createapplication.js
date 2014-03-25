// create the application
var Q = require('q');

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

exports.listSolutions = function listSolutions ( elasticBeanstalk ) {
  var deferred = Q.defer();
  elasticBeanstalk.listAvailableSolutionStacks({}, function ( err, data ) {
    if (err) return deferred.reject(err);  winston.error(err);
    deferred.resolve(data.SolutionStacks);
  });

  return deferred.promise;
}
