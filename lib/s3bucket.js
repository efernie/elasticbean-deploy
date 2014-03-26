// s3 stuffs
var Q = require('q'),
    _ = require('lodash'),
    fs = require('fs'),
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
 * [checkBucket description]
 * @param  {[type]} s3         [description]
 * @param  {[type]} bucketName [description]
 * @return {[type]}            [description]
 */
exports.checkBucket = function checkBucket ( s3, bucketName ) {
  var deferred = Q.defer(),
      bucketHere = false;
  console.log(this);
  s3.listBuckets({}, function ( err, data ) {
    if ( err ) return winston.error(err);
    _.each( data.Buckets, function ( bucket ) {
      if ( bucket.Name === bucketName ) {
        bucketHere = true;
      }
    });

    deferred.resolve(bucketHere);
  });

  return deferred.promise;
}

/**
 * [createBucket description]
 * @param  {[type]} s3         [description]
 * @param  {[type]} bucketName [description]
 * @param  {[type]} region     [description]
 * @return {[type]}            [description]
 */
exports.createBucket = function createBucket ( s3, bucketName, region ) {
  var deferred = Q.defer();
  var params = {
    Bucket: bucketName,
    ACL: 'private'//,
    // CreateBucketConfiguration: {
    //   LocationConstraint: region //'us-east-1'
    // }
  };

  this.checkBucket(s3, bucketName)
    .then( function ( result ) {
      if ( !result ) {
        s3.createBucket(params, function(err, data) {
          if (err) return winston.error(err); deferred.reject(err);
          logger.info(data);
          deferred.resolve(true);
        });
      } else {
        deferred.resolve(true);
      }
    })
    .fail( function ( err ) { return deferred.reject(err) });;

  return deferred.promise;
}

/**
 * [putInBucket description]
 * @param  {[type]} s3 [description]
 * @return {[type]}    [description]
 */
exports.putInBucket = function putInBucket ( s3 ) {
  var deferred = Q.defer();

  s3.putObject(bucketParams, function ( err, data ) {
    if ( err ) return winston.error(err);
    winston.info(data);
    deferred.resolve(data);
  });

  return deferred.promise;
}

/**
 * [zipToBuffer description]
 * @param  {[type]} folderLocation [description]
 * @param  {[type]} outputFileName [description]
 * @return {[type]}                [description]
 */
exports.zipToBuffer = function zipToBuffer ( folderLocation, outputFileName ) {
  var deferred = Q.defer(),
      outputPath = outputFileName,
      srcDirectory = folderLocation,
      output = fs.createWriteStream(outputPath),
      zipArchive = archiver('zip'),
      outputBuffer;

  output.on('close', function () {
    logger.info('Done with the zip', outputPath);
    outputBuffer = fs.readFileSync(outputPath);
    deferred.resolve(outputBuffer);
  });

  zipArchive.pipe(output);

  zipArchive.on('entry', function ( e ) {
    logger.info('Entry Event: ' + e.name);
  });

  zipArchive.bulk([
    { src: [ '**/*' ], cwd: srcDirectory, expand: true }
  ]);

  zipArchive.finalize( function ( err, bytes ) {
    if ( err ) {
      winston.error(err);
      throw err;
    }

    logger.log('done:', base, bytes);
  });

  return deferred.promise;
}
