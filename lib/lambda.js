var url = require('url');
var Orchestrator = require('orchestrator');
var identify = require('identify-github-event');
var Task = require('./task');

function parseTarget(target) {
  var result = target.match(/([^\/]+)\/([^# ]+)(.*)/);
  if (!result) {
    return { user: '', repo: '', branch: '' };
  }
  if (!result[3]) {
    return {
      user: result[1],
      repo: result[2],
      branch: 'master',
    };
  }
  var rest = result[3].match(/#?([^ ]*)( -)? (.*)/);
  return {
    user: result[1],
    repo: result[2],
    branch: rest[1] || 'master',
    name: rest[3],
  };
}

var instances = [];

function Lambda() {
  this._orchestrator = new Orchestrator();
  this._targetToTasks = {};
  this._taskNames = {};
  this._config = {};
  this._counter = 1;
  // track all Lambdas to allow for the CLI to find them
  instances.push(this);
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

Lambda.prototype.task = function(names, deps, fn) {
  var self = this;
  if (arguments.length < 2) {
    throw new Error('.task(target, [deps], fn) requires a target and a function!');
  }
  // allow calling task(name, fn)
  if (arguments.length === 2) {
    fn = deps;
    deps = [];
  }
  // names can also be an array of strings
  (Array.isArray(names) ? names : [names]).forEach(function(str) {
    var target = parseTarget(str);
    var fullTarget = target.user + '/' + target.repo + '#' + target.branch;
    var name = target.name || 'task-' + self._counter++;
    self._taskNames[str] = true;

    function noArgs() {
      return fn(new Task({
        config: self._config,
        user: target.user,
        repo: target.repo,
        branch: target.branch,
        name: name,
      }));
    }
    function oneArg(onDone) {
      return fn(new Task({
        config: self._config,
        user: target.user,
        repo: target.repo,
        branch: target.branch,
        name: name,
      }), onDone);
    }
    // if the task wants two params, convert it into a two-param callback that
    // looks like a one-item callback to Orchestrator
    var runner = fn.length < 2 ? noArgs : oneArg;
    self._orchestrator.add(str, deps, runner);
    if (!self._targetToTasks[fullTarget]) {
      self._targetToTasks[fullTarget] = [ str ];
    } else {
      self._targetToTasks[fullTarget].push(str);
    }
  });
};

Lambda.prototype.getTasksByEvent = function(event) {
  var self = this,
      user = event.user,
      repo = event.repo,
      branch = event.branch;

  var fullTarget = event.user + '/' + event.repo + '#' + event.branch;
  return this._targetToTasks[fullTarget];
};

Lambda.prototype.exec = function(event, onDone) {
  var self = this;
  var taskNames = [];
  if (typeof event === 'string' || (Array.isArray(event) && event.length > 0)) {
    // string targets can either be 1) a task name or 2) a repo target
    (Array.isArray(event) ? event : [event]).forEach(function(str) {
      var target = parseTarget(str);
      var fullTarget = target.user + '/' + target.repo + '#' + target.branch;
      if (self._orchestrator.hasTask(str)) {
        taskNames.push(str);
      } else if (self._targetToTasks[fullTarget]) {
        taskNames = taskNames.concat(self._targetToTasks[fullTarget]);
      }
    });
  } else if (typeof event === 'object') {
    var target = identify.target(event);
    // find the tasks that match the event
    tasks = this.getTasksByEvent(target);
  } else {
    console.log('[markdown-styles-lambda] No target event or task was specified.');
    this.printKnownTasks();
    if (typeof onDone === 'function') {
      onDone();
    }
    return;
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

  if (taskNames.length === 0) {
    console.log('[markdown-styles-lambda] No tasks matched ' +
      (Array.isArray(event) && event.length === 1 ? JSON.stringify(event[0]) : JSON.stringify(event))
    );
    this.printKnownTasks();
    return onDone();
  }
  taskNames.forEach(function(str) {

    console.log('[markdown-styles-lambda] Running task ' + str);
  });

  // run the tasks using orchestrator against the current repository
  this._orchestrator.start(taskNames, onDone);
};

Lambda.prototype.printKnownTasks = function() {
  var self = this;
  console.log('[markdown-styles-lambda] Known targets: ');
  console.log('  ' + Object.keys(this._targetToTasks).join('\n  '));
  console.log('[markdown-styles-lambda] Known tasks: ');
  console.log('  ' + Object.keys(this._taskNames).join('\n  '));
};

Lambda.prototype.snsHandler = function(events) {
  if (typeof events === 'string') {
    events = [events];
  }
  var matchAll = events.indexOf('*') !== -1 || arguments.length === 0;
  return function(event, context) {
    console.log('[markdown-styles-lambda] Received event:', event);
    var eventType = lambda.identifyGithubEvent(event.Records[0].Sns.Message);
    if (matchAll || events.indexOf(eventType) !== -1) {
      lambda.exec(event.Records[0].Sns.Message, context);
    } else {
      console.log('[markdown-styles-lambda] Did nothing with ' + eventType);
      context.success();
    }
  };
}

Lambda.prototype.identifyGithubEvent = identify;

Lambda.create = Lambda.prototype.create = function() {
  return new Lambda();
};

Lambda.instances = function() {
  return instances;
};

module.exports = Lambda;
