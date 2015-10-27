var url = require('url');
var Orchestrator = require('orchestrator');
var identify = require('identify-github-event');
var Task = require('./task');

function parseTarget(target) {
  var parts = url.parse('fake://' + target);
  return {
    user: parts.host,
    repo: parts.path ? parts.path.replace(/^\//, '') : '',
    branch: parts.hash ? parts.hash.substr(1) : 'master',
  };
}

function Lambda() {
  this.tasks = [];
  this._config = {};
}

Lambda.prototype.config = function(key, config) {
  if (arguments.length === 0) {
    return this._config;
  } else if (arguments.length === 2) {
    this._config[key] = config;
  } else {
    this._config = key;
  }
  return this;
};

Lambda.prototype.task = function(target, deps, fn) {
  // allow calling task(target, fn)
  if (arguments.length === 2) {
    fn = deps;
    deps = [];
  }
  var parts = parseTarget(target);
  // push task
  this.tasks.push({
    user: parts.user,
    repo: parts.repo,
    branch: parts.branch,
    deps: deps,
    fn: fn
  });
};

Lambda.prototype.getTasks = function(event) {
  var self = this,
      user = event.user,
      repo = event.repo,
      branch = event.branch;

  var tasks = this.tasks.filter(function(task) {
    return task.user === user &&
           task.repo === repo &&
           task.branch === branch;
  }).map(function(spec, i) {
    var task = new Task({
      config: self._config,
      user: user,
      repo: repo,
      branch: branch
    });
    return {
      name: 'task-' + i,
      // if the task wants two params, convert it into a two-param callback that
      // looks like a one-item callback to Orchestrator
      fn: spec.fn.length < 2 ? function() { return spec.fn(task); } :
                          function(onDone) { return spec.fn(task, onDone); },
    };
  });
  return tasks;
};

Lambda.prototype.exec = function(event, onDone) {
  // event can also be a string
  if (typeof event === 'string') {
    event = parseTarget(event);
  } else {
    event = {
      user: event.repository.owner.name,
      repo: event.repository.name,
      branch: event.ref.substr('refs/heads/'.length),
    };
  }
  // onDone can also be a AWS context or empty
  if (typeof onDone !== 'function') {
    onDone = (onDone ? onDone.done : function(err) {
      console.log('[markdown-styles-lambda] All tasks done!');
      if (err) {
        throw err;
      }
    });
  }

  // find the tasks that match the event
  var tasks = this.getTasks(event);
  if (tasks.length === 0) {
    console.log('[markdown-styles-lambda] No tasks matched ' + event.user + '/' + event.repo + '#' + event.branch);
    return onDone();
  }

  // add the tasks to orchestrator
  var orchestrator = new Orchestrator();
  tasks.forEach(function(task) {
    orchestrator.add(task.name, task.fn);
  });
  // run the tasks using orchestrator against the current repository
  orchestrator.start(tasks.map(function(t) {
    console.log('[markdown-styles-lambda] Running task ' + t.name + ' targeting ' + event.user + '/' + event.repo + '#' + event.branch);
    return t.name;
  }), onDone);
};

Lambda.prototype.identifyGithubEvent = identify;

Lambda.create = Lambda.prototype.create = function() {
  return new Lambda();
};

module.exports = Lambda;
