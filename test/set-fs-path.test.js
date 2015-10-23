var assert = require('assert'),
    pi = require('pipe-iterators'),
    setOutputPath = require('../lib/set-fs-path');

describe('set output path', function() {

  it('can set a basic output path for files', function(done) {
    pi.fromArray([{ path: '/input/bar.md' }, { path: '/input/baz.md' }])
      .pipe(setOutputPath({
        input: '/input/*.md',
        output: '/output',
      }))
      .pipe(pi.toArray(function(results) {
        assert.deepEqual(results, [
          {
            path: '/output/bar.html',
          },
          {
            path: '/output/baz.html',
          }
        ]);
        done();
      }));
  });

  it('can set a basic output path for subdirectories', function(done) {
    pi.fromArray([{ path: '/input/bar/baz.md' }, { path: '/input/a/b/c.md' }])
      .pipe(setOutputPath({
        input: '/input/**/*.md',
        output: '/output',
      }))
      .pipe(pi.toArray(function(results) {
        assert.deepEqual(results, [
          {
            path: '/output/bar/baz.html',
          },
          {
            path: '/output/a/b/c.html',
          }
        ]);
        done();
      }));
  });
});

