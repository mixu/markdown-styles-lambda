var url = require('url');
var Orchestrator = require('orchestrator');
var identify = require('identify-github-event');
var Task = require('./task');
var parseTarget = require('./parse-target.js');
var xtend = require('xtend');

var instances = [];

function Lambda() {
  this._orchestrator = new Orchestrator();
  this._targetToTasks = {};
  this._taskNames = {};
  this._config = {};
  // track all Lambdas to allow for the CLI to find them
  instances.push(this);
}

Lambda.prototype.config = function(key, config) {
  if (arguments.length === 0) {
    return this._config;
  } else if (arguments.length === 2) {
    this._config[key] = xtend(this._config[key] || {}, config);
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
    var name;
    // if the task has a task name, use the full string as the task name
    if (target.name) {
      name = str;
    } else {
      var counter = 1;
      do {
        name = str + ' - task-' + counter++;
      } while(self._taskNames[name]);
    }

    self._taskNames[name] = true;

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
    self._orchestrator.add(name, deps, runner);
    if (!self._targetToTasks[fullTarget]) {
      self._targetToTasks[fullTarget] = [ name ];
    } else {
      self._targetToTasks[fullTarget].push(name);
    }
  });
};

Lambda.prototype.getTasksByEvent = function(event) {
  var user = event.user,
      repo = event.repo,
      branch = event.branch;

  var fullTarget = event.user + '/' + event.repo + '#' + event.branch;
  return this._targetToTasks[fullTarget] || [];
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
    taskNames = this.getTasksByEvent(target);
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
  var self = this;
  if (typeof events === 'string') {
    events = [events];
  }
  var matchAll = arguments.length === 0 || events.indexOf('*') !== -1 ;
  return function(event, context) {
    var unwrappedEvent = {};
    console.log('[markdown-styles-lambda] Received event:', JSON.stringify(event, null, 2));
    try {
      unwrappedEvent = JSON.parse(event.Records[0].Sns.Message);
    } catch (e) {
      console.log('[markdown-styles-lambda] Could not parse SNS message payload as JSON.');
    }
    console.log('[markdown-styles-lambda] Unwrapped event:', JSON.stringify(unwrappedEvent));
    var eventType = self.identifyGithubEvent(unwrappedEvent);
    if (matchAll || events.indexOf(eventType) !== -1) {
      self.exec(unwrappedEvent, context);
    } else {
      console.log('[markdown-styles-lambda] Did nothing with ' + eventType);
      context.success();
    }
  };
}

Lambda.identifyGithubEvent = Lambda.prototype.identifyGithubEvent = identify;

Lambda.create = Lambda.prototype.create = function() {
  return new Lambda();
};

Lambda.instances = function() {
  return instances;
};

module.exports = Lambda;
