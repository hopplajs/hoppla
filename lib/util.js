var isObjectLike = function(obj) {
  return typeof obj == "object" && obj != null;
};

var isObject = function(obj) {
  return isObjectLike(obj) && obj.length == null;
};

var mergeDeep = function(destination = {}, source) {
  Object.keys(source).forEach(key => {
    var value = source[key];
    if (isObject(value)) {
      value = mergeDeep(destination[key], value);
    }

    destination[key] = value;
  });

  return destination;
};

// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// (There was an example for this escape function =))
var escapeRegExp = function (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

module.exports = {
  mergeDeep,
  escapeRegExp
};
