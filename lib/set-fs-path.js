var path = require('path'),
    pi = require('pipe-iterators');

module.exports = function(opts) {
  return pi.map(function(item) {
    var outputDir;

    outputDir = path.normalize(path.dirname(item.path).replace(opts.input, opts.output + path.sep));
    var extension = path.extname(item.path);
    // path: full path to the output file
    item.path = path.normalize(outputDir + path.sep + path.basename(item.path, extension) + '.html');

    return item;
  });
};
