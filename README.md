# Elastic Beanstalk Deploy

[![GitHub version](https://badge.fury.io/gh/efernie%2Felasticbean-deploy.png)](http://badge.fury.io/gh/efernie%2Felasticbean-deploy)
[![Dependency Status](https://gemnasium.com/efernie/elasticbean-deploy.svg)](https://gemnasium.com/efernie/elasticbean-deploy)

# Warning
This is very rough, I will be posting to npm soon.
Also there are somethings speciffic to me testing this out so I wouldn't suggest using this right now
Right now this is specifically for node.js deployments.

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