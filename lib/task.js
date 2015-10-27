var fs = require('fs');
var path = require('path');
var pi = require('pipe-iterators');
var mds = require('markdown-styles');
var wildglob = require('wildglob');
var fromFs = require('./stream/from-fs');
var toFs = require('./stream/to-fs');
var githubGlob = require('./stream/github-glob');
var parse = require('glob-parse');
var xtend = require('xtend');
var AWS = require('aws-sdk');

function Task(opts) {
  this.user = opts.user || '';
  this.repo = opts.repo || '';
  this.branch = opts.branch || '';
  this._config = opts.config || {};
}

Task.prototype.config = function(key, config) {
  if (arguments.length === 0) {
    return this._config;
  } else if (arguments.length === 2) {
    this._config[key] = config;
  } else {
    this._config = key;
  }
  return this;
};

Task.prototype.github = function(glob) {
  return pi.pipeline([
    githubGlob({
      authenticate: this._config.github,
      user: this.user,
      repo: this.repo,
      branch: this.branch,
      glob: glob
    }),
    pi.thru.obj(function(file, enc, done) {
      var stream = this;
      var url = file.download_url;
      https.get(url, function(res) {
        console.log('Got response: ' + res.statusCode);
        var buffer = '';
        res.on('data', function(data) {
          buffer += data.toString();
        });
        res.once('end', function() {
          stream.push( {
            // path relative to the github repo root
            path: '/' + file.path,
            stat: {},
            contents: buffer,
          });
          done();
        });
      }).on('error', function(e) { done(e); });
    }),
  ]);
};

// idea 3:
// also match against the commit contents to avoid unnecessary builds (probably overkill for v1)

Task.prototype.generateMarkdown = function(argv) {
  var resolved = mds.resolveArgs(xtend({}, argv));

  return mds.pipeline({
    'header-links': typeof argv['header-links'] === 'boolean' ? argv['header-links'] : true,
    input: '/',
    output: '/',
    isSingleFile: false,
    layout: resolved.layout,
    'asset-path': argv['asset-path'],
    meta: argv.meta || {},
    highlight: resolved.highlight,
    partials: resolved.partials,
    helpers: resolved.helpers,
  });
};

Task.prototype.s3 = function(target) {
  var parts = url.parse(target);
  var bucket = parts.host;
  var key = parts.path;

  var s3 = new AWS.S3(this._config.s3 ? this._config.s3 : {});

  return pi.writable.obj(function(file, enc, onDone) {
    var stream = this;
    s3.putObject({
        Bucket: bucket,
        Key: key + file.path,
        Body: file.contents,
        ContentType: 'text/html'
      }, function(err) {
        onDone(err);
      });
  });
};

Task.prototype.fromFs = function(glob, basename) {
  var base = basename || parse.basename(glob);
  if (base.charAt(base.length - 1) !== path.sep) {
    base += path.sep;
  }
  return pi.pipeline([
    wildglob.stream(glob),
    pi.filter(function(filename) {
      var stat = fs.statSync(filename);
      return stat.isFile();
    }),
    fromFs(),
    pi.mapKey('path', function(path) {
      return path.substr(0, base.length) === base ?
             '/' + path.substr(base.length) : path;
    })
  ]);
};

Task.prototype.toFs = toFs;

module.exports = Task;
