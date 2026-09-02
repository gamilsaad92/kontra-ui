function jestImportMetaShim() {
  return {
    name: 'jest-import-meta-env-shim',
    visitor: {
      MetaProperty(path) {
        if (path.node.meta?.name === 'import' && path.node.property?.name === 'meta') {
          path.replaceWithSourceString('({ env: {} })');
        }
      },
    },
  };
}

module.exports = {
  presets: [
   ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript'
  ],
  plugins: process.env.NODE_ENV === 'test' ? [jestImportMetaShim] : [],
};
