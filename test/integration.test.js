var assert = require('assert');
var Task = require('../lib/task');
var fixture = require('file-fixture');
var pi = require('pipe-iterators');

describe('integration tests', function() {

  // markdown and copy task output mapper
  it('takes the part after the glob basepath and appends it to the output path', function(done) {
    var tmpdir = fixture.dir({
      'abc/foo.md': '# Hello',
      'abc/bar/baz.md': '# Hello'
    });
    var task = new Task({});
     task.fromFs(tmpdir + '/**/*.md')
          .pipe(pi.map(function(item) { return item.path; }))
          .pipe(pi.toArray(function(results) {
            assert.deepEqual(results, [ '/abc/foo.md', '/abc/bar/baz.md' ]);
            done();
          }));
  });

  it('can explicitly set the glob base, no trailing slash', function(done) {
    var tmpdir = fixture.dir({
      'abc/foo.md': '# Hello',
      'abc/bar/baz.md': '# Hello'
    });
    var task = new Task({});
     task.fromFs(tmpdir + '/**/*.md', { base: tmpdir + '/abc'})
          .pipe(pi.map(function(item) { return item.path; }))
          .pipe(pi.toArray(function(results) {
            assert.deepEqual(results, [ '/foo.md', '/bar/baz.md' ]);
            done();
          }));
  });

  it('can explicitly set the glob base, with trailing slash', function(done) {
    var tmpdir = fixture.dir({
      'abc/foo.md': '# Hello',
      'abc/bar/baz.md': '# Hello'
    });
    var task = new Task({});
     task.fromFs(tmpdir + '/**/*.md', { base: tmpdir + '/abc/' })
          .pipe(pi.map(function(item) { return item.path; }))
          .pipe(pi.toArray(function(results) {
            assert.deepEqual(results, [ '/foo.md', '/bar/baz.md' ]);
            done();
          }));
  });

  // markdown task
  it('accepts a builtin layout', function(done) {
    var tmpdir = fixture.dir({
      'abc/foo.md': '# Hello',
    });
    var task = new Task({});
     task.fromFs(tmpdir + '/**/*.md')
          .pipe(task.generateMarkdown({ layout: 'github' }))
          .pipe(pi.map(function(item) { return item.contents; }))
          .pipe(pi.toArray(function(results) {
            assert.deepEqual(results[0], '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">\n    <title>Hello</title>\n    <link type="text/css" rel="stylesheet" href="../assets/css/github-markdown.css">\n    <link type="text/css" rel="stylesheet" href="../assets/css/pilcrow.css">\n    <link type="text/css" rel="stylesheet" href="../assets/css/hljs-github.min.css"/>\n  </head>\n  <body>\n    <article class="markdown-body"><h1 id="hello"><a class="header-link" href="#hello"></a>Hello</h1>\n    </article>\n  </body>\n</html>\n');
            done();
          }));
  });

  it('accepts a custom layout with an absolute path to a layout', function(done) {
    var tmpdir = fixture.dir({
      'abc/layout/page.html': '"{{title}}"\n{{> content}}',
      'abc/foo.md': '# Hello\nfoo',
    });
    var task = new Task({});
     task.fromFs(tmpdir + '/abc/**/*.md')
          .pipe(task.generateMarkdown({ layout: tmpdir + '/abc/layout' }))
          .pipe(pi.map(function(item) { return item.contents; }))
          .pipe(pi.toArray(function(results) {
            assert.deepEqual(results[0], '"Hello"\n<h1 id="hello"><a class="header-link" href="#hello"></a>Hello</h1>\n<p>foo</p>\n');
            done();
          }));
  });
});
