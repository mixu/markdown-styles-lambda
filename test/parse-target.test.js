var assert = require('assert');
var parseTarget = require('../lib/parse-target.js');

describe('parseTarget tests', function() {

  it('parses user/repo', function() {
    assert.deepEqual(parseTarget('user/repo'), {
      user: 'user',
      repo: 'repo',
      branch: 'master',
    });
  });

  it('parses user/repo#branch', function() {
    assert.deepEqual(parseTarget('user/repo#branch'), {
      user: 'user',
      repo: 'repo',
      branch: 'branch',
    });
  });

  it('parses user/repo - name of task', function() {
    assert.deepEqual(parseTarget('user/repo - name of task'), {
      user: 'user',
      repo: 'repo',
      branch: 'master',
      name: 'name of task',
    });
  });

  it('parses user/repo#branch - name of task', function() {
    assert.deepEqual(parseTarget('user/repo#branch - name of task'), {
      user: 'user',
      repo: 'repo',
      branch: 'branch',
      name: 'name of task',
    });
  });

});
