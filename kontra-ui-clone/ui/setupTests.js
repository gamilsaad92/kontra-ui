import '@testing-library/jest-dom';

const { randomUUID } = require('node:crypto');

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto || globalThis, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
}
