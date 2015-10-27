var fs = require('fs');
var path = require('path');
var url = require('url');
var pi = require('pipe-iterators');
var mds = require('markdown-styles');
var wildglob = require('wildglob');
var fromFs = require('./stream/from-fs');
var toFs = require('./stream/to-fs');
var githubGlob = require('./stream/github-glob');
var parse = require('glob-parse');
var xtend = require('xtend');
var AWS = require('aws-sdk');
var https = require('https');

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

function fromAsync(callable) {
  var called = false;
  var returned = false;
  var eof = false;
  var arr;

  if (!called) {
    callable(function(err, results) {
      returned = true;
      if (err) {
        stream.emit('error', err);
        eof = true;
        this.push(null);
        return;
      }
      arr = Array.isArray(results) ? results : [results];
      item = arr.shift();
      stream.push(item);
    });
    called = true;
  }

  var stream = pi.readable.obj(function() {
    var item;
    if (!returned) {
      return;
    }

    if (arr.length > 0) {
      do {
        item = arr.shift();
      } while(typeof item !== 'undefined' && this.push(item))
    }
    if (arr.length === 0 && !eof) {
      // pushing null signals EOF
      eof = true;
      this.push(null);
    }
  });

  return stream;
}

var gglob = require('glob-github');

Task.prototype.github = function(glob) {
  var self = this;

  var readable = fromAsync(function(onDone) {
        console.log('[Github API] Matching against Github Contents API with glob ' + glob);
        gglob({
        authenticate: self._config.github,
        user: self.user,
        repo: self.repo,
        branch: self.branch,
        glob: glob
      }, function(err, results, meta) {
        console.log('[Github API] Glob match ' + glob + ' completed. API limit remaining: ' + meta.limit);
        onDone(err, results);
      });
    }).pipe(
//    githubGlob({
//      authenticate: self._config.github,
//      user: self.user,
//      repo: self.repo,
//      branch: self.branch,
//      glob: glob
//    }),
  pi.thru.obj(function(file, enc, done) {
      console.log('[Github API] Fetching file ' + file.download_url);
      var stream = this;
      var url = file.download_url;
      https.get(url, function(res) {
        console.log('[Github API] Got response: ' + res.statusCode + ' for ' + file.download_url);
        var buffer = '';
        res.on('data', function(data) {
          buffer += data.toString();
        });
        res.once('end', function() {
          console.log('[Github API] Downloaded ' + buffer.length + ' bytes for ' + file.download_url);
          stream.push({
            // path relative to the github repo root
            path: '/' + file.path,
            stat: {},
            contents: buffer,
          });
          done();
        });
      }).on('error', function(e) {
        console.log('ERR', e);
        done(e);
      });
    })
  );

  return readable;
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
  var key = parts.path.substr(1);
  var s3 = new AWS.S3(this._config.s3 ? this._config.s3 : {});

  return pi.writable.obj(function(file, enc, onDone) {
    var stream = this;
    console.log('[S3] Writing ' + file.path + ' -> s3://' + bucket + '/' + key + file.path);
    s3.putObject({
        Bucket: bucket,
        Key: key + file.path,
        Body: file.contents,
        ContentType: 'text/html'
      }, function(err, data) {
        console.log('[S3] Wrote ' + file.path + ' -> s3://' + bucket + '/' + key + file.path);
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
