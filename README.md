# Elastic Beanstalk Deploy (for node.js apps)

[![GitHub version](https://badge.fury.io/gh/efernie%2Felasticbean-deploy.png)](http://badge.fury.io/gh/efernie%2Felasticbean-deploy)
[![Dependency Status](https://gemnasium.com/efernie/elasticbean-deploy.svg)](https://gemnasium.com/efernie/elasticbean-deploy)

This cli module was build to deploy node.js apps from the command line to Amazon's Elastic Beanstalk Environment. I specifically built this to work with codeship for continuous integration.

# Warning
This is very rough, I will be posting to npm soon. I will be writing tests also. I just wanted to get this working to get my enviornment set up for work. Also there are somethings speciffic to me testing this out so I wouldn't suggest using this right now
Right now this is specifically for node.js deployments.

## Commands
* This will be change to something more readable
```
  Usage: elasticbean-deploy [options] [command]

  Commands:

    init                   Initialize ebs application, config and creates the buckets
    deploy [options]       Deploy ebs application
    zdtdeploy              Zero downtime deploy    *** Not Implimented yet ***
    checkdns               Check if cname is avalible
    validate               Check if config settings are valid
    createtemplate         Create a Config template
    generateconfig         Generate Config File    *** Not Implimented yet ***

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -c, --config <file>       set config path. defaults to elasticconfig.json
    -n, --cname <name>        cname to check
    -t --templatename <name>  set template name
    -e, --environment <name>  set which environment name

 Examples:

   Initialize Application:
     $ elasticbean-deploy init                         # Creates an application
     $ elasticbean-deploy init -c somename.json        # Creates an application with different config file name

   Deploy Application:
     $ elasticbean-deploy deploy -e <Environment Name> # Deploy application
```

## Example Config File

This is specifically node.js config

```
{
  "aws": {
    "AccessKey": "aws-access-key",
    "SecretKey": "aws-secret",
    "Region": "us-east-1",
    "Bucket": "some bucket name"
  },
  "app": {
    "VersionsToKeep": 25,
    "ApplicationName": "Some App Name",
    "Description": "Description of your app",
    "AllEnvironments": {
      "SolutionStackName": "64bit Amazon Linux 2014.02 running Node.js",
      "OptionSettings": {
        "aws:autoscaling:launchconfiguration": {
          "Ec2KeyName": "keyname", // key name so you can ssh into your instances
          "InstanceType": "t1.micro",
          "IamInstanceProfile": "aws-elasticbeanstalk-ec2-role"
        },
        "aws:autoscaling:asg": {
          "MinSize": 1,
          "MaxSize": 4
        },
        "aws:elasticbeanstalk:application": {
          "Application Healthcheck URL": "/"
        },
        "aws:elasticbeanstalk:hostmanager": {
          "LogPublicationControl": true
        },
        "aws:elasticbeanstalk:container:nodejs": {
          "NodeCommand": "npm start",
          "ProxyServer": "none",
          "GzipCompression": true
        },
        "aws:elb:policies": {
          "Stickiness Policy": true
        },
        "aws:elasticbeanstalk:sns:topics": {
          "Notification Endpoint": "name@email.com", // notifications email
          "Notification Protocol": "email"
        }
      }
    },
    "Environments": { // this is changing
      "Application-Prod": { // config for you different environments
        "CnamePrefix": "application-prod",
        "OptionSettings": {
          "aws:elasticbeanstalk:application:environment": {
            "MYAPP_ENV_NAME": "production",
            "NODE_ENV": "production"
          },
          "aws:autoscaling:launchconfiguration": {
            "InstanceType": "t1.micro"
          }
        }
      }
    }
  }
}

```