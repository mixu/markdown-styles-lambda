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
    var originalPath = file.path;
    file.path = output + file.path;
    var writeDir = path.dirname(file.path);

    function log() {
      console.log('[FS] Wrote ' + originalPath + ' -> ' + file.path);
    }

    (seen[writeDir] ? function(a, onDone) { onDone(null); } : mkdirp)(
      writeDir, function(err) {
        if (err) {
          return onDone(err);
        }
        seen[writeDir] = true;
        if (!pi.isReadable(file.contents)) {
          fs.writeFile(file.path, file.contents, log);
        } else {
          file.contents.pipe(fs.createWriteStream(file.path)).once('finish', log);
        }
        onDone();
      }
    );
  });
}

module.exports = dest;
