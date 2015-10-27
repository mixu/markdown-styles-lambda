var assert = require('assert');
var url = require('url');
var Lambda = require('../lib/lambda');
var Task = require('../lib/task');

function pushEvent(target) {
  var parts = url.parse('fake://' + target);

  return {
    type: 'PushEvent',
    "ref": "refs/heads/" + parts.hash.substr(1),
    "repository": {
      "name": parts.path.replace(/^\//, ''),
      "full_name": parts.host + parts.path,
      "owner": {
        "name": parts.host,
      },
    }
  };
}

describe('lambda tests', function() {

  // task matching
  it('given a github event, it only runs matching builds', function(done) {
    var l = new Lambda();
    var calls = 0;

    l.task('foo/bar#master', function() {
      calls++;
    });

    l.task('foo/abc#master', function() {
      calls++;
    });

    l.task('foo/bar#master', function() {
      calls++;
    });

    l.exec(pushEvent('foo/bar#master'), function() {
      assert.equal(calls, 2);
      done();
    });
  });

  it('can filter on branch', function(done) {
    var l = new Lambda();
    var calls = 0;

    l.task('foo/bar#master', function() {
      calls++;
    });

    l.task('foo/bar#gh-pages', function() {
      calls++;
    });

    l.exec(pushEvent('foo/bar#gh-pages'), function() {
      assert.equal(calls, 1);
      done();
    });
  });

  it('task constructor intercepts and merges input on .github and .s3', function() {
    var opts = {
      s3: { region: 'foo' },
      github: { type: 'oauth', token: '' },
    };
    var task = new Task({ config: opts });

    assert.deepEqual(task.config(), opts);
    var opts2 = { s3: 'foo', github: opts.github };
    task.config('s3', 'foo')
    assert.deepEqual(task.config(), opts2);
    task.config({ foo: 'bar'})
    assert.deepEqual(task.config(), {foo: 'bar'});
  });

  it('works with tasks dependencies');

});
