var pi = require('pipe-iterators');
var mds = require('markdown-styles');

function Task(opts) {
  this.user = opts.user;
  this.repo = opts.repo;
  this.branch = opts.branch;
  this.config = opts.config;
}

Task.prototype.github = function(glob) {
  return pi.pipeline([
    githubGlobStream({
      authenticate: this.config.github,
      user: this.user,
      repo: this.repo,
      branch: this.branch,
      glob: glob
    }),
    pi.thru.obj(function(file, enc, done) {
      var stream = this;
      var url = file[0].download_url;
      https.get(url, function(res) {
        console.log('Got response: ' + res.statusCode);
        var buffer = '';
        res.on('data', function(data) {
          buffer += data.toString();
        });
        res.once('end', function() {
          stream.push( {
            // TODO can this just be / (as long as input and output are set??)
            path: __dirname + '/readme.md',
            stat: {},
            contents: buffer,
          });
          done();
        });
      }).on('error', function(e) { done(e); });
    }),
  ]);
};

// idea:
// pretend that the files are in __dirname/input/ <-- + trim glob base by default
// pretend that the files are written to __dirname/output/ <- replace with s3 path or output path

// idea 2:
// to test, download events from a repo, then run them thru!


// idea 3:
// also match against the commit contents to avoid unnecessary builds

Task.prototype.generateMarkdown = function(opts) {
  return mds.pipeline({
    'header-links': true,
    input: __dirname,
    output: __dirname,
    isSingleFile: false,
    layout: __dirname + '/layout'
  });
};

Task.prototype.s3 = function(target) {
  var parts = url.parse(target);
  var bucket = parts.host;
  var key = parts.path;

  return pi.thru.obj(function(file, enc, onDone) {
    var stream = this;
    s3.putObject({
        Bucket: bucket,
        Key: key + file.path,
        Body: file.contents,
        ContentType: 'text/html'
      }, function(err) {
        onDone(err);
      });
  }).pipe(pi.devNull());
};

Task.prototype.fromFs = function(glob) {
  return pi.pipeline([
    glob.stream(glob),
    pi.filter(function(filename) {
      var stat = fs.statSync(filename);
      return stat.isFile();
    }),
    fromFs()
  ]);
};

Task.prototype.toFs = function(output) {
  return pi.pipeline([
    setFsPath({
      input: '/',
      output: output,
    }),
    toFs(),
    pi.devNull()
  ]);
};

module.exports = Task;
