var fs = require('fs');
var pi = require('pipe-iterators');
var mds = require('markdown-styles');
var wildglob = require('wildglob');
var fromFs = require('./stream/from-fs');
var toFs = require('./stream/to-fs');
var githubGlob = require('./stream/github-glob');
var parse = require('glob-parse');
var xtend = require('xtend');

function Task(opts) {
  this.user = opts.user;
  this.repo = opts.repo;
  this.branch = opts.branch;
  this.config = opts.config;
}

Task.prototype.github = function(glob) {
  return pi.pipeline([
    githubGlob({
      authenticate: this.config.github,
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

  return pi.pipeline(
    pi.thru.obj(function(file, enc, onDone) {
      var stream = this;
      s3.putObject({
          Bucket: bucket,
          Key: key + file.path,
          Body: file.contents,
          ContentType: 'text/html'
        }, function(err) {
          onDone(err);
        });
    }),
    pi.devNull()
  );
};

Task.prototype.fromFs = function(glob) {
  var base = parse.basename(glob);
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

Task.prototype.toFs = function(output) {
  if (output.charAt(output.length - 1) === '/') {
    output = output.substr(0, output.length - 1);
  }
  return pi.pipeline(
    pi.mapKey('path', function(path) {
      return output + path;
    }).once('finish', function() { console.log('mapkey'); console.trace(); }),
    toFs().once('finish', function() { console.log('tofs'); console.trace(); }),
    pi.devnull().once('finish', function() { console.log('devnull'); console.trace(); })
  );
};

module.exports = Task;
