var path = require('path');
var glob = require('glob-github');
var lambda = require('./lib/lambda').create();
var pi = require('pipe-iterators');
var AWS = require('aws-sdk');

lambda.config(require('./config.json'));

lambda.task('mixu/cssbook#master', function(task, onDone) {
  var credentials = new AWS.SharedIniFileCredentials({profile: 'user2'});
    task.config('s3', {
      region: 'us-west-2',
      credentials: credentials
    });

  var layout = __dirname + '/layouts/cssbook';
  // generate markdown
  task.github('/input/*.md')
      .pipe(task.generateMarkdown({
        layout: layout,
        'highlight-problem': layout + '/highlighters/problem.js',
        'highlight-snippet': layout + '/highlighters/snippet.js',
        'highlight-inline-snippet': layout + '/highlighters/inline-snippet.js',
        'highlight-snippet-matrix': layout + '/highlighters/snippet-matrix.js',
        'highlight-spoiler': layout + '/highlighters/spoiler.js',
      }))
     .pipe(task.s3('s3://cablecar-test/test'))
      .once('error', function(err) {
        onDone(err);
      })
      .once('finish', function() {
        onDone();
      });
});

exports.handler = function(event, context) {
  console.log('Received event:', event);
  if (lambda.identifyGithubEvent(event.Records[0].Sns.Message) === 'PushEvent') {
    lambda.exec(event.Records[0].Sns.Message, context);
  } else {
    console.log('Did nothing');
    context.success();
  }
};

process.on('uncaughtException', function(err) {
  throw err;
});

if (process.argv.indexOf('--target') > -1) {
  lambda.exec(process.argv[process.argv.indexOf('--target') + 1]);
}
