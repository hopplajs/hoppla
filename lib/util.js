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

module.exports = {
  mergeDeep
};
