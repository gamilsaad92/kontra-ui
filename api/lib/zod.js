function chain() {
  return {
    parse: data => data,
    optional() { return this; },
    min() { return this; },
    positive() { return this; },
    int() { return this; },
    default() { return this; }
  };
}

const z = {
  object: () => ({
    parse: data => data,
    partial() { return this; }
  }),
  string: chain,
  number: chain,
  enum: () => chain(),
  array: () => chain(),
  record: () => ({ parse: data => data }),
  any: chain
};

module.exports = { z };
