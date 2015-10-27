var assert = require('assert');
var fs = require('fs');
var url = require('url');
var Task = require('../lib/task');
var fixture = require('file-fixture');
var pi = require('pipe-iterators');
var crypto = require('crypto');

function md5(filename) {
  var hash = crypto.createHash('md5');
  hash.update(fs.readFileSync(filename));
  return hash.digest('hex');
}

describe('task tests', function() {

  var conf = {
      config: {},
      user: 'user',
      repo: 'repo',
      branch: 'branch'
  };

  it('can copy files', function(done) {
    var tmpdir = fixture.dir({
      '1.png': 'image',
      'sub/2.png': 'image'
    });

    var out = fixture.dirname();

    // copy images from /input
    var task = new Task(conf);
   task.fromFs(tmpdir + '/**/*.png')
        .pipe(task.toFs(out))
        .once('finish', function() {
          console.log(md5(out + '/1.png'));
          console.log(md5(out + '/sub/2.png'));
          done();
        });
  });

  it('can render markdown files', function(done) {
    var tmpdir = fixture.dir({
      'foo.md': '# Hello',
      'bar/baz.md': '# Hello'
    });

    var out = fixture.dirname();

    // generate markdown
    var task = new Task(conf);
    task.fromFs(tmpdir + '/**/*.md')
      .pipe(task.generateMarkdown({
        layout: __dirname + '/../layout'
      }))
      .pipe(task.toFs(out))
      .once('finish', function() {
        console.log(md5(out + '/foo.html'));
        console.log(md5(out + '/bar/baz.html'));
        done();
      });


  });

});
