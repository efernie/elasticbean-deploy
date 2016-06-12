# Elastic Beanstalk Deploy (for node.js apps)

[![GitHub version](https://badge.fury.io/gh/efernie%2Felasticbean-deploy.png)](http://badge.fury.io/gh/efernie%2Felasticbean-deploy)
[![Dependency Status](https://gemnasium.com/efernie/elasticbean-deploy.svg)](https://gemnasium.com/efernie/elasticbean-deploy)

This cli module was build to deploy node.js apps from the command line to Amazon's Elastic Beanstalk Environment. I specifically built this to work with codeship for continuous integration.

# Install
```npm install -g elasticbean-deploy```

# Warning
This is very rough I will be writing tests also. I just wanted to get this working to get my environment set up for work. Also there are somethings specific to me testing this out so I wouldn't suggest using this right now
right now this is specifically for node.js deployments.

## Commands
* This will be change to something more readable

```shell
  Usage: elasticbean-deploy [options] [command]

  Commands:

    init                   Initialize ebs application, config and creates the buckets
    deploy [options]       Deploy ebs application
    zdtdeploy [options]    Zero downtime deploy
    checkenvhealth         Check ENV Health
    checkdns               Check if cname is avalible
    validate               Check if config settings are valid
    createtemplate         Create a Config template
    generateconfig         Generate Config File    *** Not Implimented yet ***

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -c, --config <file>       set config path. defaults to elasticconfig.json
    -n, --cname <name>        cname to check
    -t  --templatename <name>  set template name
    -e, --environment <name>  set which environment name

 Examples:

   Initialize Application:
     $ ebs-deploy init                         # Creates an application
     $ ebs-deploy init -c somename.json        # Creates an application with different config file name

   Deploy Application:
     $ ebs-deploy deploy -e <Environment Name> # Deploy application
     $ ebs-deploy zdtdeploy -e <Environment Name> # Zero-Downtime Deploy application

```

### Command Descriptions

#### ```ebs-deploy init```
This one


## Example Config File

This is specifically node.js config

```javascript
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
          "ProxyServer": "none", // nginx or apache but nginx is recommended
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
    "environments": [
      {
        "envName": "Application-Prod" ,
          "CnamePrefix": "application-prod",
          "OptionSettings": {
            "aws:elasticbeanstalk:application:environment": {
              "MYAPP_ENV_NAME": "production",
              "NODE_ENV": "production"
            },
            "aws:autoscaling:launchconfiguration": {
              "InstanceType": "t1.micro" // You would probably want a little something bigger than a micro
            }
          }
      },
      {
        "envName": "Application-Staging",
          "CnamePrefix": "application-staging",
          "OptionSettings": {
            "aws:elasticbeanstalk:application:environment": {
              "MYAPP_ENV_NAME": "staging",
              "NODE_ENV": "staging"
            },
            "aws:autoscaling:launchconfiguration": {
              "InstanceType": "t1.micro"
            }
          }
      }
    ]
  }
}

```
