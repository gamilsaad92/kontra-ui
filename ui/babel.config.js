const replaceImportMetaForJest = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
        path.replaceWith(t.identifier('process'));
      }
    },
  },
});

module.exports = {
  presets: [
   ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript'
  ],
  // Vite owns import.meta in production. Jest loads the same page through
  // Babel, where replacing import.meta with process keeps the pure logic
  // exports testable without changing the browser bundle.
  plugins: process.env.NODE_ENV === 'test' ? [replaceImportMetaForJest] : [],
};
