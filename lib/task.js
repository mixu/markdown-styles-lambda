var fs = require('fs');
var url = require('url');
var pi = require('pipe-iterators');
var mds = require('markdown-styles');
var wildglob = require('wildglob');
var fromFs = require('./stream/from-fs');
var toFs = require('./stream/to-fs');
var parse = require('glob-parse');
var xtend = require('xtend');
var AWS = require('aws-sdk');
var https = require('https');
var mime = require('mime-types');

function Task(opts) {
  this.user = opts.user || '';
  this.repo = opts.repo || '';
  this.branch = opts.branch || '';
  this._config = xtend({}, opts.config || {});
}

Task.prototype.config = function(key, config) {
  if (arguments.length === 0) {
    return this._config;
  } else if (arguments.length === 2) {
    if (typeof config === 'string' || typeof config === 'boolean' || typeof config === 'number') {
      this._config[key] = config;
    } else {
      this._config[key] = xtend(this._config[key] || {}, config);
    }
  } else {
    this._config = key;
  }
  return this;
};

var gglob = require('glob-github');

Task.prototype.github = function(glob, opts) {
  opts = xtend({
    read: true,
    buffer: true,
    base: parse.basename(glob)
  }, opts);
  var self = this;
  if (opts.base.charAt(opts.base.length - 1) !== '/') {
    opts.base += '/';
  }
  var readable = pi.fromAsync(function(onDone) {
    console.log('[Github API] Matching against Github Contents API with glob ' + glob);
    gglob({
      authenticate: self._config.github,
      user: self.user,
      repo: self.repo,
      branch: self.branch,
      glob: glob
    }, function(err, results, meta) {
      if (err) {
        console.error('[Github API] Returned error:', err);
      }
      console.log('[Github API] Glob match ' + glob + ' completed. Matched ' + results.length + ' files. API limit remaining: ' + meta.limit);
      onDone(null, results);
    });
  }).pipe(
  pi.thru.obj(function(file, enc, done) {
      // path relative to the basepath of the glob
      var path = file.path;
      if (path.charAt(0) !== '/') {
        path = '/' + path;
      }
      var stripPath = path.substr(0, opts.base.length) === opts.base ? path.substr(opts.base.length) : path;
      // ensure that the first character is a /
      if (stripPath.charAt(0) !== '/') {
        stripPath = '/' + stripPath;
      }
      if (!opts.read) {
        stream.push({
          path: stripPath,
          stat: {},
          contents: file,
        });
        return done();
      }
      console.log('[Github API] Fetching file ' + file.download_url);
      var stream = this;
      var url = file.download_url;
      https.get(url, function(res) {
        console.log('[Github API] Got response: ' + res.statusCode + ' for ' + file.download_url);
        if (opts.buffer) {
          var buffer = '';
          res.on('data', function(data) {
            buffer += data.toString();
          });
          res.once('end', function() {
            console.log('[Github API] Downloaded ' + buffer.length + ' bytes for ' + file.download_url);
            stream.push({
              path: stripPath,
              stat: {},
              contents: buffer,
            });
            done();
          });
        } else {
          stream.push({
            path: stripPath,
            stat: {},
            contents: res,
          });
          done();
        }
      }).on('error', function(e) {
        console.log('ERR', e);
        done(e);
      });
    })
  );

  return readable;
};

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
  // S3 can write to `/foo/bar`, but only paths like `foo/bar` show up in the S3 UI and work for static site hosting
  var key = (parts.path && parts.path.charAt(0) === '/' ? parts.path.substr(1) : '');
  var s3 = new AWS.S3(this._config.s3 ? this._config.s3 : {});

  return pi.writable.obj(function(file, enc, onDone) {
    var stream = this;
    var contentType = mime.lookup(file.path) || 'text/html';
    var fileKey = (key + file.path).replace(/^\/+/, '');
    console.log('[S3] Writing ' + file.path + ' -> s3://' + bucket + '/' + fileKey + ' as ' + contentType);
    s3.putObject({
        Bucket: bucket,
        Key: fileKey,
        Body: file.contents,
        ContentType: contentType
      }, function(err, data) {
        console.log('[S3] Wrote ' + file.path + ' -> s3://' + bucket + '/' + fileKey );
        onDone(err);
      });
  });
};

Task.prototype.fromFs = function(glob, opts) {
  opts = xtend({
    base: parse.basename(glob)
  }, opts);
  if (opts.base.charAt(opts.base.length - 1) !== '/') {
    opts.base += '/';
  }
  return pi.pipeline([
    wildglob.stream(glob),
    pi.filter(function(filename) {
      var stat = fs.statSync(filename);
      return stat.isFile();
    }),
    fromFs(opts),
    pi.mapKey('path', function(path) {
      // path relative to the basepath of the glob
      var stripPath = path.substr(0, opts.base.length) === opts.base ? path.substr(opts.base.length) : path;
      // ensure that the first character is a /
      if (stripPath.charAt(0) !== '/') {
        stripPath = '/' + stripPath;
      }
      return stripPath;
    })
  ]);
};

Task.prototype.toFs = toFs;

module.exports = Task;
