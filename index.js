var path = require('path');
var AWS = require('aws-sdk');
var glob = require('glob-github');

//var credentials = new AWS.SharedIniFileCredentials({profile: 'user2'});
//AWS.config.credentials = credentials;

AWS.config.region = 'us-west-2';

var lambda = require('markdown-styles-lambda').create();

lambda.config(require('./config.json'));

lamdba.task('mixu/singlepageapp#master', function(task) {

  task.config('s3', {
    region: 'us-west-2'
  });

  // generate markdown
  task.github('/input/*.md')
      .pipe(task.generateMarkdown({
        layout: __dirname + '/layout'
      }))
      .pipe(task.s3('s3://cablecar-test/test'));

  // copy images from /input
  task.github('/input/**/*.png')
      .pipe(task.s3('s3://cablecar-test/test/'));
});

exports.handler = function(event, context) {
  console.log('Received event:', event);
  if (lambda.identifyGithubEvent(event.Records[0].Sns.Message) === 'PushEvent') {
    lambda.exec(event.Records[0].Sns.Message, context);
  }
};
