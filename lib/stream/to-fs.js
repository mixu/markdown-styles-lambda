var path = require('path'),
    fs = require('fs'),
    pi = require('pipe-iterators'),
    mkdirp = require('mkdirp');

function dest(output) {
  if (output.charAt(output.length - 1) === '/') {
    output = output.substr(0, output.length - 1);
  }
  var seen = {};

  return pi.writable.obj(function(file, enc, onDone) {
    file.path = output + file.path;
    var writeDir = path.dirname(file.path);

    (seen[writeDir] ? function(a, onDone) { onDone(null); } : mkdirp)(
      writeDir, function(err) {
        if (err) {
          return onDone(err);
        }
        seen[writeDir] = true;
        fs.writeFileSync(file.path, file.contents);
        onDone();
      }
    );
  });
}

module.exports = dest;
