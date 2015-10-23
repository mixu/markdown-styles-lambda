var assert = require('assert');
var url = require('url');
var Task = require('../lib/task');

describe('task tests', function() {

  it('can copy files', function() {

    // copy images from /input
    task.fromFs('/input/**/*.png')
        .pipe(task.toFs('s3://bucket/path'));

  });

  it('can render markdown files', function() {

  // generate markdown
  task.fromFs('/input/*.md')
      .pipe(task.generateMarkdown({
        layout: __dirname + '/layout'
      }))
      .pipe(task.toFs('s3://bucket/path'));


  });

});
