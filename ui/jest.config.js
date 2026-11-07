module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  transform: {
   '^.+\\.(mjs|[jt]sx?)$': 'babel-jest'
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  }
};
