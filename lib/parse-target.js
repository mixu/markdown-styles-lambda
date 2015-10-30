module.exports = function parseTarget(target) {
  var parts = target.match(/([^\/]+)\/([^# ]+)(.*)/);
  if (!parts) {
    return { user: '', repo: '', branch: 'master' };
  }
  var result = {
    user: parts[1],
    repo: parts[2],
  }
  if (!parts[3]) {
    result.branch = 'master';
    return result;
  }
  var branch = parts[3].match(/#([^ ]+)(.*)/);
  if (branch) {
    result.branch = branch[1];
    result.name = branch[2].replace(/^( -)? /, '');
  } else {
    result.branch = 'master';
    result.name = parts[3].replace(/^( -)? /, '');
  }
  if (!result.name) {
    delete result.name;
  }
  return result;
};
