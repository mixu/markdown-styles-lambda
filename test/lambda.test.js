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

    assert.deepEqual(l._taskNames, {
      'foo/bar#master - task-1': true,
      'foo/abc#master - task-1': true,
      'foo/bar#master - task-2': true
    });
    assert.deepEqual(l._targetToTasks, {
      'foo/bar#master': [ 'foo/bar#master - task-1', 'foo/bar#master - task-2' ],
      'foo/abc#master': [ 'foo/abc#master - task-1' ]
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

  it('accepts the AWS test payload', function(done) {
    var payload = {
      "Records": [
        {
          "EventVersion": "1.0",
          "EventSubscriptionArn": "arn:aws:sns:EXAMPLE",
          "EventSource": "aws:sns",
          "Sns": {
            "SignatureVersion": "1",
            "Timestamp": "1970-01-01T00:00:00.000Z",
            "Signature": "EXAMPLE",
            "SigningCertUrl": "EXAMPLE",
            "MessageId": "95df01b4-ee98-5cb9-9903-4c221d41eb5e",
            "Message": "Hello from SNS!",
            "MessageAttributes": {
              "Test": {
                "Type": "String",
                "Value": "TestString"
              },
              "TestBinary": {
                "Type": "Binary",
                "Value": "TestBinary"
              }
            },
            "Type": "Notification",
            "UnsubscribeUrl": "EXAMPLE",
            "TopicArn": "arn:aws:sns:EXAMPLE",
            "Subject": "TestInvoke"
          }
        }
      ]
    };

    var l = new Lambda();
    l.snsHandler()(payload, done);
  });

  it('works with tasks dependencies');

  it('can match and start multiple tasks at the same time');

  it('task.s3 should set the contentType based on file exts so one can upload pngs and other files');

  it('task.github should accept { buffer: false }');
  it('task.github should accept { read: false }');
  it('task.github should accept { base: somebase }');
  it('task.s3 should accept readable streams');

  it('task.fromFs should accept { buffer: false }');
  it('task.fromFs should accept { read: false }');
  it('task.fromFs should accept { base: somebase }');
  it('task.toFs should accept readable streams');

});
