const REGION = 'ap-northeast-1';

var moment = require('moment');
var async = require('async');

var AWS = require('aws-sdk');
AWS.config.loadFromPath('secrets/credentials.json');
AWS.config.region = REGION

function shouldStart(instance) {
  var startTag = getTag(instance, 'Start');

  var now = moment().utcOffset("+09:00");
  var month = now.get('month') + 1;
  var start = moment(now.get('year') + '-' + month + '-' + now.get('date') + ' ' + startTag.Value + ' +09:00', 'YYYY-MM-DD HH:mm Z');

  // see alse: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#describeInstances-property
  return now >= start && instance.State.Name === 'stopped'
}

function shouldStop(instance) {
  var stopTag = getTag(instance, 'Stop')

  var now = getDate();
  var stop = getDate(stopTag.Value)

  // see alse: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#describeInstances-property
  return now > stop && instance.State.Name === 'running'
}

function getTag(instance, keyName) {
  return instance.Tags.filter(function(tag) {
    return tag.Key === keyName
  });
}

function getDate(time24) {
  var now = moment().utcOffset("+09:00");
  if (!time24) return now;

  var month = now.get('month') + 1;
  return moment(
    now.get('year') + '-' + month + '-' + now.get('date') + ' ' +
    time24 + ' +09:00', 'YYYY-MM-DD HH:mm Z'
  );
}

function handleInstance(ec2, instance, toHandle, callback) {
  var params = {
    InstanceIds: [
      instance.InstanceId
    ],
  };

  if (toHandle === 'start') {
    ec2.startInstances(params, function(err, data) {
      if (err) console.log(err, err.stack);
      callback();
    });
  } else if (toHandle === 'stop') {
    ec2.stopInstances(params, function(err, data) {
      if (err) console.log(err, err.stack);
      callback();
    });
  }
}

// main
exports.handler = function(event, context) {
  console.log("Start to shutdown/start your EC2 Instances.");

  var ec2 = new AWS.EC2();
  params = {
    Filters: [
      {
        Name: 'tag-key',
        Values: ['Start']
      }
    ]
  };

  ec2.describeInstances(params, function(err, data) {
    if (err) console.log(err, err.stack);
    else {
      async.forEach(data.Reservations, function(reservation, callback) {
        var instance = reservation.Instances[0];
        console.log('Instance: id = ' + instance.InstanceId)

        if (shouldStart(instance)) {
          console.log('Start instance: id = ' + instance.InstanceId);
          handleInstance(ec2, instance, 'start', function() { callback(); });
        } else if (shouldStop(instance)) {
          console.log('Stop instance: id = ' + instance.InstanceId);
          handleInsrance(ec2, instance, 'stop', function() { callback(); });
        }
      }, function() {
        console.log('ALL done.');
        context.succeed('OK');
      });
    }
  });
};
