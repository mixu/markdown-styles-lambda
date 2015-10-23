module.exports = function() {
  // return a readable stream that globs
  var started = false;
  var results;

  return pi.readable.obj(function() {
    var stream = this;
    if (!started) {
      started = true;
      glob({
          authenticate: opts.authenticate, // ??
          user: opts.user, // ??
          repo: opts.repo, // ??
          glob: opts.glob
        }, function(err, files) {
          if (err) {
            stream.emit('error', err);
          }
          results = files;
          stream.push(results.length > 0 ? results.shift() : null);
        });
    } else {
      stream.push(results.length > 0 ? results.shift() : null);
    }
  });
};
