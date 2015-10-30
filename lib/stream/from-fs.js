var fs = require('fs'),
    pi = require('pipe-iterators'),
    xtend = require('xtend');

function read(opts) {
  opts = xtend({
    read: true,
    buffer: true,
  }, opts);
  return pi.thru.obj(function(file, enc, onDone) {
    var stat = fs.statSync(file);
    if (stat.isFile()) {
      var result = {
        path: file,
        stat: stat,
        contents: null,
      }
      if (!opts.read) {
        this.push(result);
      } else {
        if (opts.buffer) {
          result.contents = fs.readFileSync(file, 'utf8')
        } else {
          result.contents = fs.createReadStream(file);
        }
        this.push(result);
      }
    }
    onDone();
  });
}

module.exports = read;
