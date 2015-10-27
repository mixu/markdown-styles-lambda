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
    var task = new Task({ config: conf });
   task.fromFs(tmpdir + '/**/*.png')
        .pipe(task.toFs(out))
        .once('finish', function() {
          assert.equal(md5(out + '/1.png'), '78805a221a988e79ef3f42d7c5bfd418');
          assert.equal(md5(out + '/sub/2.png'), '78805a221a988e79ef3f42d7c5bfd418');
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
        // md5's differ due to asset paths
        assert.equal(md5(out + '/foo.html'), '5849e4bcda8f53c1d9060f4c93e9f076');
        assert.equal(md5(out + '/bar/baz.html'), '05120429b8adf353ceeec87915cab669');
        done();
      });
  });

});
